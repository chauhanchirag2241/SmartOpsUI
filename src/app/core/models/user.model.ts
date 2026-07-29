export type UserRole = 'admin' | 'teacher' | 'student' | 'Admin' | 'Accountant';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roles?: string[];
  roleId?: string;
  token?: string;
}
