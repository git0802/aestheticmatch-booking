import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { EmrProviderDto } from './create-emr-credential.dto';

export class UpdateEmrCredentialDto {
  @IsOptional()
  @IsEnum(EmrProviderDto)
  provider?: EmrProviderDto;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsObject()
  @IsNotEmpty()
  credentials?: Record<string, any>;
}
