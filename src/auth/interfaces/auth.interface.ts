export interface WorkOSConfig {
  apiKey: string;
  clientId: string;
  redirectUri: string;
}

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profilePictureUrl?: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  user: User;
  accessToken: string;
  refreshToken?: string;
  impersonator?: {
    email: string;
    reason?: string;
  };
}

export interface JwtPayload {
  sub: string;
  email: string;
  firstName?: string;
  lastName?: string;
  emailVerified: boolean;
  iat?: number;
  exp?: number;
}
