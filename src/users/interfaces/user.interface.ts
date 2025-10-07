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
  status: string;
  emailVerified: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface GetUsersQuery {
  role?: string;
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedUsersResponse {
  data: UserResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
