export type DataScopeType =
  | 'None'
  | 'Global'
  | 'Department'
  | 'Class'
  | 'SubjectClass'
  | 'Self'
  | 'LinkedStudents'
  | 'ModuleOnly'
  | 'Custom';

export interface IUserScope {
  scopeType: DataScopeType;
  scopeVersion: number;
  isGlobalScope: boolean;
  allowedClassIds: string[];
  allowedStudentIds: string[];
  allowedDepartmentIds: string[];
  allowedTeacherIds: string[];
  ownStudentId?: string | null;
  activeAcademicYearId?: string | null;
}

export interface IDashboardSummary {
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  attendanceMarkedToday: number;
  averageAttendancePercent: number;
  scopeLabel: string;
}
