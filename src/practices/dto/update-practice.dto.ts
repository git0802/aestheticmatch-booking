import {
  IsString,
  IsOptional,
  MaxLength,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ServiceFeeDto,
  EmrCredentialDto,
  PracticeAvailabilityDto,
} from './create-practice.dto';

export class UpdatePracticeDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

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
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PracticeAvailabilityDto)
  availabilities?: PracticeAvailabilityDto[];

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
}
