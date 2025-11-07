import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsEnum,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EmrProvider } from '@prisma/client';

export class ServiceFeeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  serviceName: string;

  // Local DTO enum to validate against; values match Prisma enum ServiceType
  @IsEnum({
    consult: 'consult',
    surgery: 'surgery',
    non_surgical: 'non_surgical',
  })
  @IsNotEmpty()
  serviceType: 'consult' | 'surgery' | 'non_surgical';

  @IsNumber()
  @Min(0)
  price: number;
}

export class PracticeAvailabilityDto {
  @IsString()
  @IsNotEmpty()
  startDateTime: string; // ISO 8601 datetime string

  @IsString()
  @IsNotEmpty()
  endDateTime: string; // ISO 8601 datetime string
}

export class EmrCredentialDto {
  @IsEnum(EmrProvider)
  @IsNotEmpty()
  provider: EmrProvider;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  locationId?: string;

  @IsString()
  @IsNotEmpty()
  apiKey: string;

  @IsOptional()
  @IsString()
  siteId?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  baseUrl?: string;
}

export class CreatePracticeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => EmrCredentialDto)
  emrCredential?: EmrCredentialDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceFeeDto)
  serviceFees?: ServiceFeeDto[];

  @IsOptional()
  @IsString()
  @MaxLength(50)
  emrType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  mindbodyStaffId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  mindbodyLocationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  mindbodySessionTypeId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PracticeAvailabilityDto)
  availabilities?: PracticeAvailabilityDto[];
}
