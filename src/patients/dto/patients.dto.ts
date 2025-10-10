import {
  IsString,
  IsEmail,
  IsOptional,
  IsUUID,
  IsDateString,
  IsBoolean,
  MaxLength,
  MinLength,
  Matches,
  IsNotEmpty,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  IsArray,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

// Custom validator for age verification
@ValidatorConstraint({ name: 'isAdult', async: false })
export class IsAdultConstraint implements ValidatorConstraintInterface {
  validate(dateString: string) {
    const birthDate = new Date(dateString);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    const actualAge =
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
        ? age - 1
        : age;

    return actualAge >= 18 && actualAge <= 120;
  }

  defaultMessage() {
    return 'Patient must be at least 18 years old and no more than 120 years old';
  }
}

// Custom validator for E.164 phone numbers
@ValidatorConstraint({ name: 'isValidPhoneNumber', async: false })
export class IsValidPhoneNumberConstraint
  implements ValidatorConstraintInterface
{
  validate(phone: string) {
    if (!phone || phone.trim() === '') {
      return true; // Phone is optional
    }

    // E.164 format validation: starts with + followed by 1-15 digits
    const e164Regex = /^\+[1-9]\d{1,14}$/;

    // Also accept some common formats for backward compatibility
    const usFormatRegex = /^\(\d{3}\)\s\d{3}-\d{4}$/; // (555) 123-4567
    const plainDigitsRegex = /^\d{10,15}$/; // 10-15 digits

    return (
      e164Regex.test(phone) ||
      usFormatRegex.test(phone) ||
      plainDigitsRegex.test(phone)
    );
  }

  defaultMessage() {
    return 'Phone number must be in valid international format (e.g., +1234567890)';
  }
}

export class CreatePastSurgeryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  surgeryType: string;

  @IsDateString()
  @IsNotEmpty()
  surgeryDate: string;

  @IsOptional()
  @IsString()
  details?: string;
}

export class PastSurgeryResponseDto {
  id: string;
  patientId: string;
  surgeryType: string;
  surgeryDate?: Date;
  details?: string;
  createdAt: Date;
}

export class CreateAllergyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  allergyName: string;

  @IsOptional()
  @IsEnum(['mild', 'moderate', 'severe'])
  severity?: 'mild' | 'moderate' | 'severe';

  @IsOptional()
  @IsString()
  details?: string;
}

export class AllergyResponseDto {
  id: string;
  patientId: string;
  allergyName: string;
  severity: 'mild' | 'moderate' | 'severe';
  details?: string;
  createdAt: Date;
}

export class CreateMedicationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  medicationName: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  dosage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  frequency?: string;

  @IsOptional()
  @IsString()
  details?: string;
}

export class MedicationResponseDto {
  id: string;
  patientId: string;
  medicationName: string;
  dosage?: string;
  frequency?: string;
  details?: string;
  createdAt: Date;
}

export class CreatePatientDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @MaxLength(255)
  @Matches(/^[a-zA-Z\s'-]+$/, {
    message: 'Name can only contain letters, spaces, hyphens, and apostrophes',
  })
  name: string;

  @IsDateString()
  @Validate(IsAdultConstraint)
  dob: string;

  @IsEmail({}, { message: 'Please provide a valid email address' })
  @MaxLength(255)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(25)
  @Validate(IsValidPhoneNumberConstraint)
  phone?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsUUID(4)
  amReferralId: string;

  @IsBoolean()
  consentFormsSigned: boolean;

  @IsBoolean()
  privacyNoticeAcknowledged: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePastSurgeryDto)
  pastSurgeries?: CreatePastSurgeryDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAllergyDto)
  allergies?: CreateAllergyDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMedicationDto)
  medications?: CreateMedicationDto[];
}

export class UpdatePatientDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @MaxLength(255)
  @Matches(/^[a-zA-Z\s'-]+$/, {
    message: 'Name can only contain letters, spaces, hyphens, and apostrophes',
  })
  name?: string;

  @IsOptional()
  @IsDateString()
  @Validate(IsAdultConstraint)
  dob?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(25)
  @Validate(IsValidPhoneNumberConstraint)
  phone?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID(4)
  amReferralId?: string;

  @IsOptional()
  @IsBoolean()
  consentFormsSigned?: boolean;

  @IsOptional()
  @IsBoolean()
  privacyNoticeAcknowledged?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePastSurgeryDto)
  pastSurgeries?: CreatePastSurgeryDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAllergyDto)
  allergies?: CreateAllergyDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMedicationDto)
  medications?: CreateMedicationDto[];
}

export class PatientResponseDto {
  id: string;
  name: string;
  dob: Date;
  email: string;
  phone?: string;
  notes?: string;
  amReferralId: string;
  consentFormsSigned?: boolean;
  privacyNoticeAcknowledged?: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
  pastSurgeries?: PastSurgeryResponseDto[];
  allergies?: AllergyResponseDto[];
  medications?: MedicationResponseDto[];
}
