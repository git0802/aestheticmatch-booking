import { IsISO8601, IsString, IsUUID } from 'class-validator';

export class CreatePracticeAvailabilityDto {
  @IsISO8601()
  startDateTime: string; // ISO 8601 datetime string

  @IsISO8601()
  endDateTime: string; // ISO 8601 datetime string
}

export class UpdatePracticeAvailabilityDto {
  @IsISO8601()
  startDateTime?: string;

  @IsISO8601()
  endDateTime?: string;
}

export interface PracticeAvailabilityResponse {
  id: string;
  practiceId: string;
  startDateTime: Date;
  endDateTime: Date;
  createdAt: Date;
  updatedAt: Date;
}
