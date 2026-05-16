export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  isActive: boolean;
  createdOn: string;
  roles: string[];
  permissions: string[];
}
