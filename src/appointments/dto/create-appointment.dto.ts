import {
  IsString,
  IsEnum,
  IsDateString,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { AppointmentType, AppointmentStatus } from '@prisma/client';

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
}
