export interface MindBodyClientData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth?: Date;
}

export interface MindBodyClientResponse {
  id: string;
  mindbodyId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}
