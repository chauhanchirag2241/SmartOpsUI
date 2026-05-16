import { MODULE_PERMISSIONS } from './permission-ui.config';

export interface NavItemConfig {
  label: string;
  icon: string;
  route: string;
  section?: string;
  /** Show menu when user has this single permission */
  permission?: string;
  /** Show menu when user has any of these permissions */
  permissions?: string[];
  badge?: string;
  danger?: boolean;
}

export const NAV_ITEMS: NavItemConfig[] = [
  { section: 'Overview', label: 'Dashboard', icon: 'grid_view', route: '/dashboard' },
  {
    section: 'Academics',
    label: 'Students',
    icon: 'group',
    route: '/students',
    permissions: [...MODULE_PERMISSIONS.students.nav],
  },
  {
    label: 'Classes',
    icon: 'domain',
    route: '/classes',
    permissions: [...MODULE_PERMISSIONS.classes.nav],
  },
  {
    label: 'Subjects',
    icon: 'school',
    route: '/subjects',
    permissions: [...MODULE_PERMISSIONS.subjects.nav],
  },
  {
    label: 'Academic Years',
    icon: 'calendar_month',
    route: '/academic-years',
    permissions: [...MODULE_PERMISSIONS.academicYears.nav],
  },
  {
    label: 'Teachers',
    icon: 'co_present',
    route: '/teachers',
    permissions: [...MODULE_PERMISSIONS.teachers.nav],
  },
  {
    label: 'Attendance',
    icon: 'person_check',
    route: '/attendance',
    permissions: [...MODULE_PERMISSIONS.attendance.nav],
  },
];

export const ROUTE_PERMISSIONS: Record<string, string | undefined> = {
  '/dashboard': undefined,
  '/students': MODULE_PERMISSIONS.students.read,
  '/classes': MODULE_PERMISSIONS.classes.read,
  '/subjects': MODULE_PERMISSIONS.subjects.read,
  '/academic-years': MODULE_PERMISSIONS.academicYears.read,
  '/teachers': MODULE_PERMISSIONS.teachers.read,
  '/attendance': MODULE_PERMISSIONS.attendance.read,
};
