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

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(private prisma: PrismaService) {}

  async create(
    createAppointmentDto: CreateAppointmentDto,
    user: User,
  ): Promise<Appointment> {
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
    });
    if (!practice) {
      throw new NotFoundException('Practice not found');
    }

    return this.prisma.appointment.create({
      data: {
        ...createAppointmentDto,
        date: new Date(createAppointmentDto.date),
      },
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

    const updateData: Prisma.AppointmentUpdateInput = {
      ...updateAppointmentDto,
    };
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
