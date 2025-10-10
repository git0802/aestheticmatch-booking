import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePatientDto,
  UpdatePatientDto,
  PatientResponseDto,
} from './dto/patients.dto';
import { Patient } from './interfaces/patient.interface';
import { Prisma } from '@prisma/client';

@Injectable()
export class PatientsService {
  constructor(private prisma: PrismaService) {}

  async create(
    createPatientDto: CreatePatientDto,
    userId: string,
  ): Promise<PatientResponseDto> {
    try {
      // Check if the user exists first
      const userExists = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true },
      });

      if (!userExists) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      // Build the create data object using proper Prisma types
      const createData: any = {
        name: createPatientDto.name,
        email: createPatientDto.email,
        phone: createPatientDto.phone,
        notes: createPatientDto.notes,
        amReferralId: createPatientDto.amReferralId,
        consentFormsSigned: createPatientDto.consentFormsSigned,
        privacyNoticeAcknowledged: createPatientDto.privacyNoticeAcknowledged,
        dob: new Date(createPatientDto.dob),
        createdBy: userId,
        updatedBy: userId,
      };

      // Add past surgeries if provided
      if (
        createPatientDto.pastSurgeries &&
        createPatientDto.pastSurgeries.length > 0
      ) {
        createData.pastSurgeries = {
          create: createPatientDto.pastSurgeries.map((surgery) => ({
            surgeryType: surgery.surgeryType,
            surgeryDate: surgery.surgeryDate
              ? new Date(surgery.surgeryDate)
              : null,
            details: surgery.details,
          })),
        };
      }

      // Add allergies if provided
      if (createPatientDto.allergies && createPatientDto.allergies.length > 0) {
        createData.allergies = {
          create: createPatientDto.allergies.map((allergy) => ({
            allergyName: allergy.allergyName,
            severity: allergy.severity || 'mild',
            details: allergy.details,
          })),
        };
      }

      // Add medications if provided
      if (createPatientDto.medications && createPatientDto.medications.length > 0) {
        createData.medications = {
          create: createPatientDto.medications.map((medication) => ({
            medicationName: medication.medicationName,
            dosage: medication.dosage,
            frequency: medication.frequency,
            details: medication.details,
          })),
        };
      }

      const patient = await this.prisma.patient.create({
        data: createData,
        include: {
          pastSurgeries: true,
          allergies: true,
          medications: true,
        } as any,
      });

      return this.formatPatientResponse(patient);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const target = error.meta?.target as string[];
          if (target?.includes('email')) {
            throw new ConflictException('Email already exists');
          }
          if (target?.includes('am_referral_id')) {
            throw new ConflictException('AM Referral ID already exists');
          }
        }
      }
      throw error;
    }
  }

  async findAll(params?: {
    skip?: number;
    take?: number;
    cursor?: Prisma.PatientWhereUniqueInput;
    where?: Prisma.PatientWhereInput;
    orderBy?: Prisma.PatientOrderByWithRelationInput;
  }): Promise<PatientResponseDto[]> {
    const { skip, take, cursor, where, orderBy } = params || {};

    const patients = await this.prisma.patient.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy,
      include: {
        pastSurgeries: true,
        allergies: true,
        medications: true,
      } as any,
    });

    return patients.map(this.formatPatientResponse);
  }

  async findOne(id: string): Promise<PatientResponseDto> {
    const patient = await this.prisma.patient.findUnique({
      where: { id },
      include: {
        pastSurgeries: true,
        allergies: true,
        medications: true,
      } as any,
    });

    if (!patient) {
      throw new NotFoundException(`Patient with ID ${id} not found`);
    }

    return this.formatPatientResponse(patient);
  }

  async findByEmail(email: string): Promise<PatientResponseDto> {
    const patient = await this.prisma.patient.findUnique({
      where: { email },
      include: {
        pastSurgeries: true,
        allergies: true,
        medications: true,
      } as any,
    });

    if (!patient) {
      throw new NotFoundException(`Patient with email ${email} not found`);
    }

    return this.formatPatientResponse(patient);
  }

  async findByAmReferralId(amReferralId: string): Promise<PatientResponseDto> {
    const patient = await this.prisma.patient.findUnique({
      where: { amReferralId },
      include: {
        pastSurgeries: true,
        allergies: true,
        medications: true,
      } as any,
    });

    if (!patient) {
      throw new NotFoundException(
        `Patient with AM Referral ID ${amReferralId} not found`,
      );
    }

    return this.formatPatientResponse(patient);
  }

  async update(
    id: string,
    updatePatientDto: UpdatePatientDto,
    userId: string,
  ): Promise<PatientResponseDto> {
    try {
      // Build the update data object without the nested fields
      const updateData: any = {
        ...(updatePatientDto.name !== undefined && {
          name: updatePatientDto.name,
        }),
        ...(updatePatientDto.email !== undefined && {
          email: updatePatientDto.email,
        }),
        ...(updatePatientDto.phone !== undefined && {
          phone: updatePatientDto.phone,
        }),
        ...(updatePatientDto.notes !== undefined && {
          notes: updatePatientDto.notes,
        }),
        ...(updatePatientDto.amReferralId !== undefined && {
          amReferralId: updatePatientDto.amReferralId,
        }),
        ...(updatePatientDto.consentFormsSigned !== undefined && {
          consentFormsSigned: updatePatientDto.consentFormsSigned,
        }),
        ...(updatePatientDto.privacyNoticeAcknowledged !== undefined && {
          privacyNoticeAcknowledged: updatePatientDto.privacyNoticeAcknowledged,
        }),
        ...(updatePatientDto.dob && { dob: new Date(updatePatientDto.dob) }),
        updatedBy: userId,
      };

      // Update past surgeries if provided
      if (updatePatientDto.pastSurgeries) {
        updateData.pastSurgeries = {
          deleteMany: {},
          create: updatePatientDto.pastSurgeries.map((surgery) => ({
            surgeryType: surgery.surgeryType,
            surgeryDate: surgery.surgeryDate
              ? new Date(surgery.surgeryDate)
              : null,
            details: surgery.details,
          })),
        };
      }

      // Update allergies if provided
      if (updatePatientDto.allergies) {
        updateData.allergies = {
          deleteMany: {},
          create: updatePatientDto.allergies.map((allergy) => ({
            allergyName: allergy.allergyName,
            severity: allergy.severity || 'mild',
            details: allergy.details,
          })),
        };
      }

      // Update medications if provided
      if (updatePatientDto.medications) {
        updateData.medications = {
          deleteMany: {},
          create: updatePatientDto.medications.map((medication) => ({
            medicationName: medication.medicationName,
            dosage: medication.dosage,
            frequency: medication.frequency,
            details: medication.details,
          })),
        };
      }

      const patient = await this.prisma.patient.update({
        where: { id },
        data: updateData,
        include: {
          pastSurgeries: true,
          allergies: true,
          medications: true,
        } as any,
      });

      return this.formatPatientResponse(patient);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException(`Patient with ID ${id} not found`);
        }
        if (error.code === 'P2002') {
          const target = error.meta?.target as string[];
          if (target?.includes('email')) {
            throw new ConflictException('Email already exists');
          }
          if (target?.includes('am_referral_id')) {
            throw new ConflictException('AM Referral ID already exists');
          }
        }
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.patient.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException(`Patient with ID ${id} not found`);
        }
      }
      throw error;
    }
  }

  async count(where?: Prisma.PatientWhereInput): Promise<number> {
    return this.prisma.patient.count({ where });
  }

  private formatPatientResponse(patient: any): PatientResponseDto {
    return {
      id: patient.id,
      name: patient.name,
      dob: patient.dob,
      email: patient.email,
      phone: patient.phone,
      notes: patient.notes,
      amReferralId: patient.amReferralId,
      consentFormsSigned: patient.consentFormsSigned,
      privacyNoticeAcknowledged: patient.privacyNoticeAcknowledged,
      createdBy: patient.createdBy,
      updatedBy: patient.updatedBy,
      createdAt: patient.createdAt,
      updatedAt: patient.updatedAt,
      pastSurgeries:
        patient.pastSurgeries?.map((surgery: any) => ({
          id: surgery.id,
          patientId: surgery.patientId,
          surgeryType: surgery.surgeryType,
          surgeryDate: surgery.surgeryDate,
          details: surgery.details,
          createdAt: surgery.createdAt,
        })) || [],
      allergies:
        patient.allergies?.map((allergy: any) => ({
          id: allergy.id,
          patientId: allergy.patientId,
          allergyName: allergy.allergyName,
          severity: allergy.severity,
          details: allergy.details,
          createdAt: allergy.createdAt,
        })) || [],
      medications:
        patient.medications?.map((medication: any) => ({
          id: medication.id,
          patientId: medication.patientId,
          medicationName: medication.medicationName,
          dosage: medication.dosage,
          frequency: medication.frequency,
          details: medication.details,
          createdAt: medication.createdAt,
        })) || [],
    };
  }
}
