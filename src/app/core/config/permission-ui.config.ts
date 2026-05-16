/** Permission keys used for nav visibility, routes, and table UI. */
export interface ModulePermissionSet {
  /** Show sidebar item if user has any of these permissions */
  nav: string[];
  /** Required to open the route / view list */
  read: string;
  create?: string;
  update?: string;
  delete?: string;
}

export const MODULE_PERMISSIONS = {
  students: {
    nav: ['student.read', 'student.create', 'student.update', 'student.delete'],
    read: 'student.read',
    create: 'student.create',
    update: 'student.update',
    delete: 'student.delete',
  },
  teachers: {
    nav: ['teacher.read', 'hr.manage'],
    read: 'teacher.read',
    create: 'hr.manage',
    update: 'hr.manage',
    delete: 'hr.manage',
  },
  classes: {
    nav: ['class.read', 'admin.full'],
    read: 'class.read',
    create: 'admin.full',
    update: 'admin.full',
    delete: 'admin.full',
  },
  subjects: {
    nav: ['subject.read', 'admin.full'],
    read: 'subject.read',
    create: 'admin.full',
    update: 'admin.full',
    delete: 'admin.full',
  },
  academicYears: {
    nav: ['academicyear.read', 'admin.full'],
    read: 'academicyear.read',
    create: 'admin.full',
    update: 'admin.full',
    delete: 'admin.full',
  },
  attendance: {
    nav: ['attendance.read', 'attendance.mark'],
    read: 'attendance.read',
    create: 'attendance.mark',
    update: 'attendance.mark',
  },
} as const satisfies Record<string, ModulePermissionSet>;

export type ModulePermissionKey = keyof typeof MODULE_PERMISSIONS;
