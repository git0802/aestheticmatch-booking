export interface CreateUserData {
  workosId: string;
  email: string;
  firstName: string;
  lastName: string;
  role?: 'CONCIERGE' | 'OPS_FINANCE' | 'ADMIN';
}

export interface UpdateUserData {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: 'CONCIERGE' | 'OPS_FINANCE' | 'ADMIN';
}

export interface UserResponse {
  id: string;
  workosId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}
