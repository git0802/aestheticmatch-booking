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

// Temporary local enum until Prisma Client is regenerated with AppointmentMode
export enum AppointmentModeDto {
  virtual = 'virtual',
  in_person = 'in_person',
}

export class UpdateAppointmentDto {
  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsString()
  practiceId?: string;

  @IsOptional()
  @IsEnum(AppointmentType)
  appointmentType?: AppointmentType;

  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @IsOptional()
  @IsEnum(AppointmentModeDto)
  mode?: AppointmentModeDto;

  @IsOptional()
  @IsDateString()
  date?: string;

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
