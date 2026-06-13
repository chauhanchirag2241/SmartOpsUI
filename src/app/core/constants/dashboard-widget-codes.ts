export const DashboardWidgetCodes = {
  StudentsStat: 'STUDENTS_STAT',
  EmployeesStat: 'EMPLOYEES_STAT',
  ClassesStat: 'CLASSES_STAT',
  SubjectsStat: 'SUBJECTS_STAT',
  SalaryDisbursed: 'SALARY_DISBURSED',
  AttendanceRate: 'ATTENDANCE_RATE',
  AttendanceDetail: 'ATTENDANCE_DETAIL',
  SalaryStatus: 'SALARY_STATUS',
  RecentStudents: 'RECENT_STUDENTS',
  EmployeesList: 'EMPLOYEES_LIST',
  HomeworkDue: 'HOMEWORK_DUE',
  ClassesOverview: 'CLASSES_OVERVIEW',
  AlertsActions: 'ALERTS_ACTIONS',
} as const;

export type DashboardWidgetCode =
  (typeof DashboardWidgetCodes)[keyof typeof DashboardWidgetCodes];
