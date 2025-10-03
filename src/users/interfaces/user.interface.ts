export interface CreateUserData {
  workosId: string;
  email: string;
  firstName: string;
  lastName: string;
  role?: 'CONCIERGE' | 'OPS_FINANCE' | 'OPS_MARKETING';
}

export interface UpdateUserData {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: 'CONCIERGE' | 'OPS_FINANCE' | 'OPS_MARKETING';
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
