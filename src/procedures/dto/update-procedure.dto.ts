import {
  IsString,
  IsEnum,
  IsNumber,
  IsArray,
  IsOptional,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProcedureCategory, FeeRule } from './create-procedure.dto';

export class UpdateProcedureDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(ProcedureCategory)
  @IsOptional()
  category?: ProcedureCategory;

  @IsEnum(FeeRule)
  @IsOptional()
  defaultFeeRule?: FeeRule;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @IsOptional()
  feeAmount?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  linkedPractices?: string[];
}
