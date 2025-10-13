import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdatePracticeDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

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
