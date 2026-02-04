export interface ModmedCredentialResponse {
  success: boolean;
  token?: string;
  expiresAt?: string;
  practiceId?: string;
  error?: string;
}

export interface ModmedPatientInfo {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
}

export interface ModmedAppointmentInfo {
  id: string;
  patientId: string;
  providerId: string;
  locationId: string;
  appointmentTypeId: string;
  startDateTime: string;
  endDateTime: string;
  status: string;
}

export interface ModmedProviderInfo {
  id: string;
  firstName: string;
  lastName: string;
  specialty?: string;
}

export interface ModmedLocationInfo {
  id: string;
  name: string;
  address?: string;
}

export interface ModmedAppointmentTypeInfo {
  id: string;
  name: string;
  duration: number;
}
