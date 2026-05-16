export const MenuCodes = {
  Dashboard: 'DASHBOARD',
  Schools: 'SCHOOLS',
  Users: 'USERS',
  Roles: 'ROLES',
  Settings: 'SETTINGS',
  Academics: 'ACADEMICS',
  Students: 'STUDENTS',
  Teachers: 'TEACHERS',
  Classes: 'CLASSES',
  Subjects: 'SUBJECTS',
  AcademicYears: 'ACADEMIC_YEARS',
  Attendance: 'ATTENDANCE',
} as const;

export type MenuCode = (typeof MenuCodes)[keyof typeof MenuCodes];
