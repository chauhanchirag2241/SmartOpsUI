import { MenuCodes } from './menu-codes';

/** Fallback when API menu row has no route (e.g. stale cache or manual menu insert). */
export const MENU_ROUTE_BY_CODE: Record<string, string> = {
  [MenuCodes.Dashboard]: '/dashboard',
  [MenuCodes.Students]: '/students',
  [MenuCodes.Teachers]: '/teachers',
  [MenuCodes.Classes]: '/classes',
  [MenuCodes.ClassMappings]: '/class-subject-teacher-mapping',
  [MenuCodes.Subjects]: '/subjects',
  [MenuCodes.AcademicYears]: '/academic-years',
  [MenuCodes.Attendance]: '/attendance',
  [MenuCodes.Homework]: '/homework',
  [MenuCodes.FeesStructure]: '/fees-structure',
  [MenuCodes.FeesClassAmounts]: '/fees-class-amounts',
  [MenuCodes.FeesCollection]: '/fees-collection',
  [MenuCodes.SalaryStructure]: '/salary-structure',
  [MenuCodes.SalaryEmployees]: '/salary-employees',
  [MenuCodes.SalaryPayroll]: '/salary-payroll',
  [MenuCodes.LeaveStaff]: '/leave/staff',
  [MenuCodes.LeaveStudent]: '/leave/students',
  [MenuCodes.MyActions]: '/my-actions',
  [MenuCodes.Notices]: '/notices',
  [MenuCodes.Users]: '/configuration/users',
  [MenuCodes.Roles]: '/configuration/roles',
  [MenuCodes.Settings]: '/settings',
};

export function resolveMenuRoute(code: string, route?: string | null): string | null {
  const trimmed = route?.trim();
  if (trimmed) {
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }
  const key = code?.trim().toUpperCase();
  if (!key) {
    return null;
  }
  return MENU_ROUTE_BY_CODE[key] ?? null;
}
