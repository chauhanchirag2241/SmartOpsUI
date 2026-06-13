export interface IDashboardLayout {
  scopeLabel: string;
  academicYearLabel?: string;
  schoolName?: string;
  widgets: IDashboardWidgetLayoutItem[];
}

export interface IDashboardWidgetLayoutItem {
  code: string;
  name: string;
  category: string;
  defaultSize: string;
  displayOrder: number;
  requiredMenuCode: string;
}

export interface IDashboardResponse {
  scopeLabel: string;
  visibleWidgets: string[];
  summary?: IDashboardSummary;
  attendanceToday?: IAttendanceToday;
  salary?: ISalaryDashboard;
  recentStudents?: IRecentStudent[];
  employees?: IDashboardEmployee[];
  /** @deprecated use employees */
  teachers?: IDashboardEmployee[];
  homeworkDue?: IHomeworkDue[];
  classesOverview?: IClassOverview[];
  alerts?: IDashboardAlerts;
  totalSubjects: number;
}

export interface IDashboardSummary {
  totalStudents: number;
  totalEmployees?: number;
  /** @deprecated use totalEmployees */
  totalTeachers: number;
  totalClasses: number;
  attendanceMarkedToday: number;
  averageAttendancePercent: number;
  scopeLabel: string;
}

export interface IAttendanceToday {
  present: number;
  absent: number;
  leave: number;
  late: number;
  presentPercent: number;
  dateLabel: string;
  periodLabel: string;
}

export interface ISalaryDashboard {
  disbursedAmount: number;
  pendingAmount: number;
  paidCount: number;
  pendingCount: number;
  periodLabel: string;
  categories: ISalaryCategory[];
}

export interface ISalaryCategory {
  label: string;
  subLabel: string;
  amount: number;
  isPaid: boolean;
}

export interface IRecentStudent {
  id: string;
  initials: string;
  name: string;
  detail: string;
  badge: string;
  badgeTone: string;
}

export interface IDashboardEmployee {
  initials: string;
  name: string;
  detail: string;
  status: string;
  statusTone: string;
}

/** @deprecated use IDashboardEmployee */
export type IDashboardTeacher = IDashboardEmployee;

export interface IHomeworkDue {
  title: string;
  subtitle: string;
  dueLabel: string;
  dueTone: string;
}

export interface IClassOverview {
  displayName: string;
  studentCount: number;
  present: number;
  late: number;
  absent: number;
  onLeave: number;
  feeCollectedToday: number;
}

export interface IDashboardAlerts {
  items: IDashboardAlertItem[];
}

export interface IDashboardAlertItem {
  icon: string;
  title: string;
  subtitle: string;
  tone: string;
}
