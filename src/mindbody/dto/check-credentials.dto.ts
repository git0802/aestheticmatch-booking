import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CheckCredentialsDto {
  @IsString()
  @IsNotEmpty()
  apiKey: string;

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  // Optional per-account site context; many non-aggregator keys require a specific SiteId
  @IsOptional()
  @IsString()
  siteId?: string;
}
