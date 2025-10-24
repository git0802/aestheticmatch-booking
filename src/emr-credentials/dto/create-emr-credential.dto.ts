import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export enum EmrProviderDto {
  MINDBODY = 'MINDBODY',
  NEXTECH = 'NEXTECH',
  MODMED = 'MODMED',
  PATIENTNOW = 'PATIENTNOW',
}

export class CreateEmrCredentialDto {
  @IsEnum(EmrProviderDto)
  provider: EmrProviderDto;

  @IsOptional()
  @IsString()
  label?: string;

  @IsObject()
  @IsNotEmpty()
  credentials: Record<string, any>;
}
