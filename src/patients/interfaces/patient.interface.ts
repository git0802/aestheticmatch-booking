export interface Patient {
  id: string;
  name: string;
  dob: Date;
  email: string;
  phone?: string;
  notes?: string;
  amReferralId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePatientRequest {
  name: string;
  dob: string;
  email: string;
  phone?: string;
  notes?: string;
  amReferralId: string;
}

export interface UpdatePatientRequest {
  name?: string;
  dob?: string;
  email?: string;
  phone?: string;
  notes?: string;
  amReferralId?: string;
}
