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
} from 'class-validator';
import { Type } from 'class-transformer';
import { EmrProvider } from '@prisma/client';

export class ServiceFeeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  serviceName: string;

  @IsNumber()
  @Min(0)
  price: number;
}

export class EmrCredentialDto {
  @IsEnum(EmrProvider)
  @IsNotEmpty()
  provider: EmrProvider;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsString()
  @IsNotEmpty()
  apiKey: string;

  @IsString()
  @IsNotEmpty()
  siteId: string;

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
  connectorConfig?: string;

  @IsOptional()
  @IsString()
  feeModel?: string;
}
