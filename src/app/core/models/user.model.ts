export type UserRole = 'admin' | 'teacher' | 'student' | 'parent' | 'Admin' | 'Accountant';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roles?: string[];
  roleId?: string;
  roleCode?: string;
  token?: string;
}
