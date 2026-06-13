import { canonicalMenuCode } from './menu-code-aliases';
import { MenuCodes } from './menu-codes';

/** Legacy routes from before Teachers → Employees rename. */
const LEGACY_ROUTE_ALIASES: Record<string, string> = {
  '/teachers': '/employees',
};

/** Fallback when API menu row has no route (e.g. stale cache or manual menu insert). */
export const MENU_ROUTE_BY_CODE: Record<string, string> = {
  [MenuCodes.Dashboard]: '/dashboard',
  [MenuCodes.Students]: '/students',
  [MenuCodes.Employees]: '/employees',
  TEACHERS: '/employees',
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
  const key = canonicalMenuCode(code);
  const trimmed = route?.trim();
  let resolved: string | null;
  if (trimmed) {
    resolved = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  } else if (!key) {
    return null;
  } else {
    resolved = MENU_ROUTE_BY_CODE[key] ?? null;
  }
  return resolved ? (LEGACY_ROUTE_ALIASES[resolved] ?? resolved) : null;
}
