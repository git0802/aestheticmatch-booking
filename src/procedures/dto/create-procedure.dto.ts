import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsArray,
  IsOptional,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ProcedureCategory {
  SURGICAL = 'SURGICAL',
  NON_SURGICAL = 'NON_SURGICAL',
}

export enum FeeRule {
  TIER_A = 'TIER_A',
  TIER_B = 'TIER_B',
  CONSULT = 'CONSULT',
  SURGERY = 'SURGERY',
}

export class CreateProcedureDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(ProcedureCategory)
  category: ProcedureCategory;

  @IsEnum(FeeRule)
  defaultFeeRule: FeeRule;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  feeAmount: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  linkedPractices?: string[];
}
