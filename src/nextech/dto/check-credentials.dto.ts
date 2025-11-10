import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class NextechCheckCredentialsDto {
  @IsString()
  @IsNotEmpty()
  baseUrl: string;

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  @IsString()
  practiceId?: string;
}
