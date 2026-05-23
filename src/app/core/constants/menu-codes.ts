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
  ClassMappings: 'CLASS_MAPPINGS',
  Subjects: 'SUBJECTS',
  AcademicYears: 'ACADEMIC_YEARS',
  Attendance: 'ATTENDANCE',
  Homework: 'HOMEWORK',
  FeesStructure: 'FEES_STRUCTURE',
  FeesClassAmounts: 'FEES_CLASS_AMOUNTS',
  FeesCollection: 'FEES_COLLECTION',
  SalaryStructure: 'SALARY_STRUCTURE',
  SalaryEmployees: 'SALARY_EMPLOYEES',
  SalaryPayroll: 'SALARY_PAYROLL',
} as const;

export type MenuCode = (typeof MenuCodes)[keyof typeof MenuCodes];
