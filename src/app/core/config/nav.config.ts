export interface NavItemConfig {
  label: string;
  icon: string;
  route: string;
  section?: string;
  permission?: string;
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
    permission: 'student.read',
  },
  { label: 'Classes', icon: 'domain', route: '/classes', permission: 'class.read' },
  { label: 'Subjects', icon: 'school', route: '/subjects', permission: 'subject.read' },
  {
    label: 'Academic Years',
    icon: 'calendar_month',
    route: '/academic-years',
    permission: 'academicyear.read',
  },
  { label: 'Teachers', icon: 'co_present', route: '/teachers', permission: 'teacher.read' },
  {
    label: 'Attendance',
    icon: 'person_check',
    route: '/attendance',
    permission: 'attendance.read',
  },
  { section: 'Admin', label: 'Roles', icon: 'admin_panel_settings', route: '/roles', permission: 'roles.manage' },
];

export const ROUTE_PERMISSIONS: Record<string, string | undefined> = {
  '/dashboard': undefined,
  '/students': 'student.read',
  '/classes': 'class.read',
  '/subjects': 'subject.read',
  '/academic-years': 'academicyear.read',
  '/teachers': 'teacher.read',
  '/attendance': 'attendance.read',
  '/roles': 'roles.manage',
};
