import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { QueryAppointmentsDto } from './dto/query-appointments.dto';
import { Appointment, Prisma } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { User } from '../auth/interfaces/auth.interface';
import { EncryptionService } from '../common/services/encryption.service';
import { MindbodyService } from '../mindbody/mindbody.service';

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
    private mindbody: MindbodyService,
  ) {}

  private hasAppointmentField(field: string): boolean {
    const appointmentModel: any = (
      Prisma as any
    )?.dmmf?.datamodel?.models?.find((m: any) => m.name === 'Appointment');
    return !!appointmentModel?.fields?.some((f: any) => f.name === field);
  }

  async create(
    createAppointmentDto: CreateAppointmentDto,
    user: User,
  ): Promise<Appointment & { emrBookingResult?: any }> {
    // Verify patient exists
    const patient = await this.prisma.patient.findUnique({
      where: { id: createAppointmentDto.patientId },
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    // Verify practice exists
    const practice = await this.prisma.practice.findUnique({
      where: { id: createAppointmentDto.practiceId },
      include: { serviceFees: true },
    });
    if (!practice) {
      throw new NotFoundException('Practice not found');
    }

    // Resolve service fields if serviceFeeId is provided
    let serviceName = createAppointmentDto.serviceName ?? null;
    let serviceType = createAppointmentDto.serviceType ?? null;
    let servicePrice = createAppointmentDto.servicePrice ?? null;
    let feeAmount = createAppointmentDto.feeAmount ?? null;

    if (createAppointmentDto.serviceFeeId) {
      const svc = practice.serviceFees.find(
        (sf) => sf.id === createAppointmentDto.serviceFeeId,
      );
      if (!svc) {
        throw new NotFoundException('Selected service not found for practice');
      }
      serviceName = serviceName ?? (svc as any).serviceName;
      serviceType = serviceType ?? (svc as any).serviceType;
      servicePrice = servicePrice ?? Number((svc as any).price);
    }

    // If feeAmount not provided, derive from global FeeSettings by serviceType
    if (feeAmount == null && serviceType) {
      const settings = await this.prisma.feeSettings.findFirst();
      if (settings) {
        if (serviceType === 'consult') feeAmount = Number(settings.consultFee);
        else if (serviceType === 'surgery')
          feeAmount = Number(settings.surgeryFee);
        else if (serviceType === 'non_surgical')
          feeAmount = Number(settings.nonSurgicalFee);
      } else {
        feeAmount = 0;
      }
    }

    // Check Prisma client support for fields (handles client not regenerated yet)
    const supportsMode = this.hasAppointmentField('mode');

    const createData: any = {
      patientId: createAppointmentDto.patientId,
      practiceId: createAppointmentDto.practiceId,
      appointmentType: createAppointmentDto.appointmentType,
      status: createAppointmentDto.status,
      date: new Date(createAppointmentDto.date),
      isReturnVisit: !!createAppointmentDto.isReturnVisit,
      emrAppointmentId: createAppointmentDto.emrAppointmentId,
    };

    if (supportsMode) {
      createData.mode = (createAppointmentDto as any).mode ?? 'in_person';
    }

    // Conditionally include service-related fields only if supported by client/schema
    if (this.hasAppointmentField('serviceFeeId')) {
      createData.serviceFeeId = createAppointmentDto.serviceFeeId ?? null;
    }
    if (this.hasAppointmentField('serviceName')) {
      createData.serviceName = serviceName ?? null;
    }
    if (this.hasAppointmentField('serviceType')) {
      createData.serviceType = (serviceType as any) ?? null;
    }
    if (this.hasAppointmentField('servicePrice')) {
      createData.servicePrice =
        servicePrice != null ? new Prisma.Decimal(servicePrice) : null;
    }
    if (this.hasAppointmentField('feeAmount')) {
      createData.feeAmount =
        feeAmount != null ? new Prisma.Decimal(feeAmount) : null;
    }

    const created = await this.prisma.appointment.create({
      data: createData,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        practice: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Attempt EMR booking for Mindbody if credentials exist
    let emrBookingResult: any = null;
    try {
      const emr = await (this.prisma as any).emrCredential.findFirst({
        where: {
          ownerId: practice.id,
          ownerType: 'PRACTICE',
          provider: 'MINDBODY',
        },
        orderBy: { createdAt: 'desc' },
      });

      if (emr?.encryptedData) {
        const creds = this.encryption.decryptEmrData(emr.encryptedData);
        /**
         * Resolve Mindbody mapping from practice.connectorConfig
         *
         * Expected connectorConfig structure:
         * {
         *   "mindbody": {
         *     "staffId": 123,          // Required: Staff member ID in Mindbody
         *     "locationId": 456,       // Required: Location ID in Mindbody
         *     "sessionTypeId": 789,    // Default session type (can be overridden)
         *     "serviceTypeMap": {      // Optional: Map service types to session types
         *       "consult": { "sessionTypeId": 100 },
         *       "surgery": { "sessionTypeId": 200 },
         *       "non_surgical": { "sessionTypeId": 300 }
         *     },
         *     "serviceFeeMap": {       // Optional: Map specific services to session types
         *       "service-fee-uuid-1": { "sessionTypeId": 400 },
         *       "service-fee-uuid-2": { "sessionTypeId": 500 }
         *     }
         *   }
         * }
         *
         * Priority order for sessionTypeId:
         * 1. serviceFeeMap[serviceFeeId].sessionTypeId
         * 2. serviceTypeMap[serviceType].sessionTypeId
         * 3. default sessionTypeId
         *
         * For clientId, we use patient.amReferralId (patient's Mindbody client ID)
         */
        let staffId: number | string | undefined;
        let locationId: number | string | undefined;
        let sessionTypeId: number | string | undefined;

        try {
          const cfgRaw = (practice as any).connectorConfig;
          if (cfgRaw) {
            const cfg =
              typeof cfgRaw === 'string' ? JSON.parse(cfgRaw) : cfgRaw;
            const mb = cfg?.mindbody ?? cfg;
            const svcType = (createAppointmentDto as any).serviceType;
            const svcFeeId = (createAppointmentDto as any).serviceFeeId;

            // Extract staff and location IDs
            staffId = mb?.staffId ?? mb?.default?.staffId;
            locationId = mb?.locationId ?? mb?.default?.locationId;

            // Priority: explicit map by serviceFeeId, then by serviceType, then default
            if (svcFeeId && mb?.serviceFeeMap?.[svcFeeId]?.sessionTypeId) {
              sessionTypeId = mb.serviceFeeMap[svcFeeId].sessionTypeId;
              this.logger.log(
                `Using serviceFeeMap sessionTypeId for ${svcFeeId}: ${sessionTypeId}`,
              );
            } else if (
              svcType &&
              mb?.serviceTypeMap?.[svcType]?.sessionTypeId
            ) {
              sessionTypeId = mb.serviceTypeMap[svcType].sessionTypeId;
              this.logger.log(
                `Using serviceTypeMap sessionTypeId for ${svcType}: ${sessionTypeId}`,
              );
            } else {
              sessionTypeId = mb?.sessionTypeId ?? mb?.default?.sessionTypeId;
              this.logger.log(`Using default sessionTypeId: ${sessionTypeId}`);
            }
          }
        } catch (e) {
          this.logger.warn(
            'Failed to parse practice.connectorConfig for Mindbody mapping',
            e,
          );
        }

        // Use patient's amReferralId as the clientId for Mindbody booking
        const clientId = patient.amReferralId;

        this.logger.log(
          `Attempting Mindbody booking for patient ${patient.id} with clientId: ${clientId || 'NOT SET'}`,
        );
        this.logger.log(
          `Practice connectorConfig: ${JSON.stringify((practice as any).connectorConfig)}`,
        );
        this.logger.log(
          `Booking params - staffId: ${staffId}, locationId: ${locationId}, sessionTypeId: ${sessionTypeId}`,
        );

        const bookingResult = await this.mindbody.bookAppointment(
          {
            apiKey: creds.apiKey,
            username: creds.username,
            password: creds.password,
            siteId: creds.siteId,
          },
          {
            startDateTime: created.date.toISOString(),
            notes: `AestheticMatch booking for patient ${created.patientId}`,
            staffId,
            locationId,
            sessionTypeId,
            clientId: clientId || undefined,
            patient: {
              name: (created as any)?.patient?.name ?? null,
              email: (created as any)?.patient?.email ?? null,
              phone: (created as any)?.patient?.phone ?? null,
            },
          },
        );

        emrBookingResult = bookingResult;
        this.logger.log(
          `EMR booking result for appointment ${created.id}:`,
          JSON.stringify(bookingResult),
        );

        if (bookingResult.success && bookingResult.appointmentId) {
          await this.prisma.appointment.update({
            where: { id: created.id },
            data: { emrAppointmentId: bookingResult.appointmentId },
          });
        } else if (!bookingResult.success) {
          this.logger.warn(
            `Mindbody booking skipped/failed for appointment ${created.id}: ${bookingResult.error || 'Unknown error'}`,
          );
        }
      }
    } catch (err) {
      this.logger.error('EMR booking error', err);
      emrBookingResult = {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }

    return { ...created, emrBookingResult } as any;
  }

  async findAll(
    query: QueryAppointmentsDto,
    user: User,
  ): Promise<{
    appointments: Appointment[];
    total: number;
    skip: number;
    take: number;
  }> {
    const skip = query.skip ? parseInt(query.skip) : 0;
    const take = query.take ? parseInt(query.take) : 20;

    // Build where clause based on user role and filters
    const where: Prisma.AppointmentWhereInput = {};

    // Role-based filtering
    if (user.role !== 'ADMIN') {
      // Non-admin users can only see appointments for patients they created
      where.patient = {
        createdBy: user.id,
      };
    }

    // Apply filters
    if (query.patientId) {
      where.patientId = query.patientId;
    }
    if (query.practiceId) {
      where.practiceId = query.practiceId;
    }
    if (query.appointmentType) {
      where.appointmentType = query.appointmentType;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.dateFrom || query.dateTo) {
      where.date = {};
      if (query.dateFrom) {
        where.date.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        where.date.lte = new Date(query.dateTo);
      }
    }
    if (query.search) {
      where.OR = [
        {
          patient: {
            name: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
        },
        {
          practice: {
            name: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
        },
      ];
    }

    const [appointments, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        skip,
        take,
        orderBy: { date: 'desc' },
        include: {
          patient: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          practice: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return {
      appointments,
      total,
      skip,
      take,
    };
  }

  async findOne(id: string, user: User): Promise<Appointment> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            createdBy: true,
          },
        },
        practice: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    // Check permissions
    if (user.role !== 'ADMIN' && appointment.patient.createdBy !== user.id) {
      throw new ForbiddenException('Access denied');
    }

    return appointment;
  }

  async findByPatient(patientId: string, user: User): Promise<Appointment[]> {
    // Verify patient exists and user has access
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    if (user.role !== 'ADMIN' && patient.createdBy !== user.id) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.appointment.findMany({
      where: { patientId },
      orderBy: { date: 'desc' },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        practice: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async findByPractice(practiceId: string, user: User): Promise<Appointment[]> {
    // Verify practice exists
    const practice = await this.prisma.practice.findUnique({
      where: { id: practiceId },
    });

    if (!practice) {
      throw new NotFoundException('Practice not found');
    }

    // Build where clause based on user role
    const where: Prisma.AppointmentWhereInput = { practiceId };

    if (user.role !== 'ADMIN') {
      where.patient = {
        createdBy: user.id,
      };
    }

    return this.prisma.appointment.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        practice: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async update(
    id: string,
    updateAppointmentDto: UpdateAppointmentDto,
    user: User,
  ): Promise<Appointment> {
    const existingAppointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            createdBy: true,
          },
        },
      },
    });

    if (!existingAppointment) {
      throw new NotFoundException('Appointment not found');
    }

    // Check permissions
    if (
      user.role !== 'ADMIN' &&
      existingAppointment.patient.createdBy !== user.id
    ) {
      throw new ForbiddenException('Access denied');
    }

    // If updating patient or practice, verify they exist
    if (updateAppointmentDto.patientId) {
      const patient = await this.prisma.patient.findUnique({
        where: { id: updateAppointmentDto.patientId },
      });
      if (!patient) {
        throw new NotFoundException('Patient not found');
      }
    }

    if (updateAppointmentDto.practiceId) {
      const practice = await this.prisma.practice.findUnique({
        where: { id: updateAppointmentDto.practiceId },
      });
      if (!practice) {
        throw new NotFoundException('Practice not found');
      }
    }

    // Resolve service-related fields if serviceFeeId is being updated
    let resolvedServiceName: string | null | undefined = (
      updateAppointmentDto as any
    ).serviceName;
    let resolvedServiceType: any = (updateAppointmentDto as any).serviceType;
    let resolvedServicePrice: number | null | undefined = (
      updateAppointmentDto as any
    ).servicePrice;
    let resolvedFeeAmount: number | null | undefined = (
      updateAppointmentDto as any
    ).feeAmount;

    const targetPracticeId =
      updateAppointmentDto.practiceId || existingAppointment.practiceId;

    if (typeof (updateAppointmentDto as any).serviceFeeId !== 'undefined') {
      const incomingServiceFeeId = (updateAppointmentDto as any).serviceFeeId;
      if (!incomingServiceFeeId) {
        // Clearing the service selection
        (updateAppointmentDto as any).serviceFeeId = null;
        resolvedServiceName = null;
        resolvedServiceType = null;
        resolvedServicePrice = null;
        resolvedFeeAmount = null;
      } else {
        // Validate service belongs to practice and derive missing fields
        const svc = await (this.prisma as any).serviceFee.findFirst({
          where: { id: incomingServiceFeeId, practiceId: targetPracticeId },
        });
        if (!svc) {
          throw new NotFoundException(
            'Selected service not found for practice',
          );
        }
        if (
          typeof resolvedServiceName === 'undefined' ||
          resolvedServiceName === null
        ) {
          resolvedServiceName = svc.serviceName;
        }
        if (
          typeof resolvedServiceType === 'undefined' ||
          resolvedServiceType === null
        ) {
          resolvedServiceType = svc.serviceType;
        }
        if (
          typeof resolvedServicePrice === 'undefined' ||
          resolvedServicePrice === null
        ) {
          resolvedServicePrice = Number(svc.price);
        }
      }
    }

    // If fee not provided but we have a serviceType, derive from global settings
    if (
      (typeof resolvedFeeAmount === 'undefined' ||
        resolvedFeeAmount === null) &&
      resolvedServiceType
    ) {
      const settings = await (this.prisma as any).feeSettings.findFirst();
      if (settings) {
        if (resolvedServiceType === 'consult')
          resolvedFeeAmount = Number(settings.consultFee);
        else if (resolvedServiceType === 'surgery')
          resolvedFeeAmount = Number(settings.surgeryFee);
        else if (resolvedServiceType === 'non_surgical')
          resolvedFeeAmount = Number(settings.nonSurgicalFee);
      } else {
        resolvedFeeAmount = 0;
      }
    }

    // Build update data and include fields only if supported
    const supportsModeUpdate = this.hasAppointmentField('mode');
    const updateData: Prisma.AppointmentUpdateInput = {} as any;

    // Always-available fields
    if (typeof updateAppointmentDto.patientId !== 'undefined')
      (updateData as any).patientId = updateAppointmentDto.patientId;
    if (typeof updateAppointmentDto.practiceId !== 'undefined')
      (updateData as any).practiceId = updateAppointmentDto.practiceId;
    if (typeof updateAppointmentDto.appointmentType !== 'undefined')
      (updateData as any).appointmentType =
        updateAppointmentDto.appointmentType as any;
    if (typeof updateAppointmentDto.status !== 'undefined')
      (updateData as any).status = updateAppointmentDto.status as any;
    if (typeof updateAppointmentDto.isReturnVisit !== 'undefined')
      (updateData as any).isReturnVisit = updateAppointmentDto.isReturnVisit;
    if (typeof updateAppointmentDto.emrAppointmentId !== 'undefined')
      (updateData as any).emrAppointmentId =
        updateAppointmentDto.emrAppointmentId;

    if (
      supportsModeUpdate &&
      typeof (updateAppointmentDto as any).mode !== 'undefined'
    ) {
      (updateData as any).mode = (updateAppointmentDto as any).mode;
    }

    // Service fields conditionally
    if (
      this.hasAppointmentField('serviceFeeId') &&
      typeof updateAppointmentDto.serviceFeeId !== 'undefined'
    ) {
      (updateData as any).serviceFeeId =
        updateAppointmentDto.serviceFeeId ?? null;
    }
    if (
      this.hasAppointmentField('serviceName') &&
      typeof resolvedServiceName !== 'undefined'
    ) {
      (updateData as any).serviceName = resolvedServiceName;
    }
    if (
      this.hasAppointmentField('serviceType') &&
      typeof resolvedServiceType !== 'undefined'
    ) {
      (updateData as any).serviceType = resolvedServiceType;
    }
    if (
      this.hasAppointmentField('servicePrice') &&
      typeof resolvedServicePrice !== 'undefined'
    ) {
      (updateData as any).servicePrice =
        resolvedServicePrice != null
          ? new Prisma.Decimal(resolvedServicePrice)
          : null;
    }
    if (
      this.hasAppointmentField('feeAmount') &&
      typeof resolvedFeeAmount !== 'undefined'
    ) {
      (updateData as any).feeAmount =
        resolvedFeeAmount != null
          ? new Prisma.Decimal(resolvedFeeAmount)
          : null;
    }
    if (updateAppointmentDto.date) {
      updateData.date = new Date(updateAppointmentDto.date);
    }

    return this.prisma.appointment.update({
      where: { id },
      data: updateData,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        practice: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async remove(id: string, user: User): Promise<{ message: string }> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            createdBy: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    // Check permissions - only admin can delete appointments
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Only administrators can delete appointments',
      );
    }

    await this.prisma.appointment.delete({
      where: { id },
    });

    return { message: 'Appointment deleted successfully' };
  }

  async updateExpiredAppointments(): Promise<{
    updated: number;
    appointments: any[];
  }> {
    const now = new Date();

    // Find expired appointments that are still marked as 'booked'
    const expiredAppointments = await this.prisma.appointment.findMany({
      where: {
        status: 'booked',
        date: {
          lt: now, // Less than current time
        },
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        practice: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (expiredAppointments.length === 0) {
      return { updated: 0, appointments: [] };
    }

    // Update all expired appointments to 'expired'
    const result = await this.prisma.appointment.updateMany({
      where: {
        status: 'booked',
        date: {
          lt: now,
        },
      },
      data: {
        status: 'expired',
      },
    });

    this.logger.log(
      `Updated ${result.count} expired appointments to expired status`,
    );

    return {
      updated: result.count,
      appointments: expiredAppointments.map((apt) => ({
        id: apt.id,
        patientName: apt.patient?.name,
        practiceName: apt.practice?.name,
        date: apt.date,
        appointmentType: apt.appointmentType,
      })),
    };
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT) // Runs daily at midnight
  async handleExpiredAppointments() {
    try {
      const result = await this.updateExpiredAppointments();
      if (result.updated > 0) {
        this.logger.log(
          `Cron job: Updated ${result.updated} expired appointments to canceled status`,
        );
        this.logger.debug(
          `Expired appointments: ${JSON.stringify(result.appointments)}`,
        );
      } else {
        this.logger.log('Cron job: No expired appointments found');
      }
    } catch (error) {
      this.logger.error(
        'Cron job: Error updating expired appointments:',
        error,
      );
    }
  }
}
