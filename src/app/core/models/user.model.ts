export type UserRole = 'admin' | 'teacher' | 'Admin' | 'Accountant' | 'SmartOpsAdmin' | 'School Admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roles?: string[];
  roleId?: string;
  token?: string;
}
