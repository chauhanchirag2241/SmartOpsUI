export type UserRole = 'admin' | 'teacher' | 'student' | 'parent' | 'SchoolAdmin' | 'PlatformAdmin' | 'Accountant';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roles: string[];
  permissions: string[];
  token?: string;
}
