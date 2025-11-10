export class NextechCredentialResponse {
  success: boolean;
  error?: string;
  token?: string;
  expiresAt?: string;
}

export class NextechPatientInfo {
  patientId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}
