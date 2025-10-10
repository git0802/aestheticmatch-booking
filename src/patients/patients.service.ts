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
        select: { id: true, email: true }
      });
      
      if (!userExists) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      // Extract past surgeries from the DTO
      const { pastSurgeries, ...patientData } = createPatientDto;
      
      const patient = await this.prisma.patient.create({
        data: {
          ...patientData,
          dob: new Date(patientData.dob),
          createdBy: userId,
          updatedBy: userId,
          ...(pastSurgeries && pastSurgeries.length > 0 && {
            pastSurgeries: {
              create: pastSurgeries.map(surgery => ({
                surgeryType: surgery.surgeryType,
                surgeryDate: surgery.surgeryDate ? new Date(surgery.surgeryDate) : null,
                details: surgery.details,
              }))
            }
          })
        },
        include: {
          pastSurgeries: true,
        },
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
      },
    });

    return patients.map(this.formatPatientResponse);
  }

  async findOne(id: string): Promise<PatientResponseDto> {
    const patient = await this.prisma.patient.findUnique({
      where: { id },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with ID ${id} not found`);
    }

    return this.formatPatientResponse(patient);
  }

  async findByEmail(email: string): Promise<PatientResponseDto> {
    const patient = await this.prisma.patient.findUnique({
      where: { email },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with email ${email} not found`);
    }

    return this.formatPatientResponse(patient);
  }

  async findByAmReferralId(amReferralId: string): Promise<PatientResponseDto> {
    const patient = await this.prisma.patient.findUnique({
      where: { amReferralId },
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
      // Extract past surgeries from the DTO
      const { pastSurgeries, ...patientData } = updatePatientDto;

      const patient = await this.prisma.patient.update({
        where: { id },
        data: {
          ...patientData,
          ...(patientData.dob && { dob: new Date(patientData.dob) }),
          updatedBy: userId,
          ...(pastSurgeries && {
            pastSurgeries: {
              deleteMany: {},
              create: pastSurgeries.map(surgery => ({
                surgeryType: surgery.surgeryType,
                surgeryDate: surgery.surgeryDate ? new Date(surgery.surgeryDate) : null,
                details: surgery.details,
              }))
            }
          })
        },
        include: {
          pastSurgeries: true,
        },
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
      pastSurgeries: patient.pastSurgeries?.map((surgery: any) => ({
        id: surgery.id,
        patientId: surgery.patientId,
        surgeryType: surgery.surgeryType,
        surgeryDate: surgery.surgeryDate,
        details: surgery.details,
        createdAt: surgery.createdAt,
      })) || [],
    };
  }
}
