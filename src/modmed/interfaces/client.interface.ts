export interface ModmedAuthCredentials {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  practiceId?: string;
}

export interface ModmedClientData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: Date;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
}

export interface ModmedClientResponse {
  id: string;
  modmedId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
}

export interface ModmedAppointmentData {
  patientId: string;
  providerId: string;
  locationId: string;
  appointmentTypeId: string;
  startDateTime: string;
  duration?: number;
  notes?: string;
  status?: string;
}

export interface ModmedBookingResponse {
  success: boolean;
  appointmentId?: string;
  externalAppointmentId?: string;
  error?: string;
  message?: string;
}
