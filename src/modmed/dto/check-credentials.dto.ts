import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ModmedCheckCredentialsDto {
  @IsString()
  @IsNotEmpty()
  baseUrl: string;

  @IsString()
  @IsNotEmpty()
  clientId: string;

  @IsString()
  @IsNotEmpty()
  clientSecret: string;

  @IsOptional()
  @IsString()
  practiceId?: string;
}
