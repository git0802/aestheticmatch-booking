export interface NextechClientData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth?: Date;
}

export interface NextechClientResponse {
  id: string;
  nextechId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface NextechAuthCredentials {
  baseUrl: string;
  username: string;
  password: string;
  practiceId?: string;
}
