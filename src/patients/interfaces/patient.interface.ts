export interface Patient {
  id: string;
  name: string;
  dob: Date;
  email: string;
  phone?: string;
  notes?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  consentFormsSigned?: boolean;
  privacyNoticeAcknowledged?: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePatientRequest {
  name: string;
  dob: string;
  email: string;
  phone?: string;
  notes?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

export interface UpdatePatientRequest {
  name?: string;
  dob?: string;
  email?: string;
  phone?: string;
  notes?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}
