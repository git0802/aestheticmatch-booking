import {
  IsString,
  IsEnum,
  IsDateString,
  IsOptional,
  IsBoolean,
  IsNumber,
} from 'class-validator';
import {
  AppointmentType,
  AppointmentStatus,
  ServiceType,
} from '@prisma/client';

export class CreateAppointmentDto {
  @IsString()
  patientId: string;

  @IsString()
  practiceId: string;

  @IsEnum(AppointmentType)
  appointmentType: AppointmentType;

  @IsEnum(AppointmentStatus)
  status: AppointmentStatus;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsBoolean()
  isReturnVisit?: boolean;

  @IsOptional()
  @IsString()
  emrAppointmentId?: string;

  // Service selection fields
  @IsOptional()
  @IsString()
  serviceFeeId?: string;

  @IsOptional()
  @IsString()
  serviceName?: string;

  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;

  @IsOptional()
  @IsNumber()
  servicePrice?: number;

  @IsOptional()
  @IsNumber()
  feeAmount?: number;
}
