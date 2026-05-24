export const DashboardWidgetCodes = {
  StudentsStat: 'STUDENTS_STAT',
  TeachersStat: 'TEACHERS_STAT',
  ClassesStat: 'CLASSES_STAT',
  SubjectsStat: 'SUBJECTS_STAT',
  FeesCollected: 'FEES_COLLECTED',
  FeesPending: 'FEES_PENDING',
  SalaryDisbursed: 'SALARY_DISBURSED',
  AttendanceRate: 'ATTENDANCE_RATE',
  AttendanceDetail: 'ATTENDANCE_DETAIL',
  FeesByClass: 'FEES_BY_CLASS',
  SalaryStatus: 'SALARY_STATUS',
  RecentStudents: 'RECENT_STUDENTS',
  TeachersList: 'TEACHERS_LIST',
  HomeworkDue: 'HOMEWORK_DUE',
  ClassesOverview: 'CLASSES_OVERVIEW',
  AlertsActions: 'ALERTS_ACTIONS',
} as const;

export type DashboardWidgetCode =
  (typeof DashboardWidgetCodes)[keyof typeof DashboardWidgetCodes];
