export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  mustChangePassword?: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  isActive: boolean;
  createdOn: string;
  roles: string[];
  roleId?: string;
  mustChangePassword?: boolean;
}
