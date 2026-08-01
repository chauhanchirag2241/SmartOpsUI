export type UserRole = 'admin' | 'teacher' | 'student' | 'Admin' | 'Accountant' | 'SmartOpsAdmin' | 'School Admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roles?: string[];
  roleId?: string;
  token?: string;
}
