import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreatePracticeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

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
