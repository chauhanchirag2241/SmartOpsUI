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
  fees?: IFeesDashboard;
  salary?: ISalaryDashboard;
  recentStudents?: IRecentStudent[];
  teachers?: IDashboardTeacher[];
  homeworkDue?: IHomeworkDue[];
  classesOverview?: IClassOverview[];
  alerts?: IDashboardAlerts;
  totalSubjects: number;
}

export interface IDashboardSummary {
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  attendanceMarkedToday: number;
  averageAttendancePercent: number;
  scopeLabel: string;
}

export type AttendanceDatePreset =
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'thismonth'
  | 'lastmonth'
  | 'custom';

export interface IDashboardQuery {
  attendancePreset?: AttendanceDatePreset;
  attendanceFrom?: string;
  attendanceTo?: string;
}

export interface IAttendanceToday {
  present: number;
  absent: number;
  leave: number;
  late: number;
  presentPercent: number;
  dateLabel: string;
  periodLabel: string;
  filterPreset: string;
  fromDate: string;
  toDate: string;
}

export interface IFeesDashboard {
  collectedAmount: number;
  pendingAmount: number;
  overdueCount: number;
  byClass: IFeesByClass[];
}

export interface IFeesByClass {
  className: string;
  percentCollected: number;
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

export interface IDashboardTeacher {
  initials: string;
  name: string;
  detail: string;
  status: string;
  statusTone: string;
}

export interface IHomeworkDue {
  title: string;
  subtitle: string;
  dueLabel: string;
  dueTone: string;
}

export interface IClassOverview {
  className: string;
  sectionLabel: string;
  studentCount: number;
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
