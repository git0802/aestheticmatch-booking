import { IsOptional, IsString, IsEnum, IsNumberString } from 'class-validator';
import { Type } from 'class-transformer';
import { ProcedureCategory, FeeRule } from './create-procedure.dto';

export class QueryProceduresDto {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(ProcedureCategory)
  category?: ProcedureCategory;

  @IsOptional()
  @IsEnum(FeeRule)
  feeRule?: FeeRule;

  @IsOptional()
  @IsString()
  practiceId?: string;
}
