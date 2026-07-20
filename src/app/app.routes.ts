import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { tenantGuard } from './core/guards/tenant.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { MenuCodes } from './core/constants/menu-codes';
import { AdminLayoutComponent } from './layout/admin-layout/admin-layout.component';
import { AuthLayoutComponent } from './layout/auth-layout/auth-layout.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'auth/login' },
  {
    path: '',
    component: AdminLayoutComponent,
    canActivate: [tenantGuard, authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'students',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.Students, permission: 'view' },
        loadComponent: () =>
          import('./features/students/students.component').then((m) => m.StudentsComponent),
      },
      {
        path: 'students/:id/history',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.Students, permission: 'view', entityKind: 'student' },
        loadComponent: () =>
          import('./shared/pages/entity-history/entity-history.component').then(
            (m) => m.EntityHistoryComponent,
          ),
      },
      {
        path: 'employees/:id/history',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.Employees, permission: 'view', entityKind: 'employee' },
        loadComponent: () =>
          import('./shared/pages/entity-history/entity-history.component').then(
            (m) => m.EntityHistoryComponent,
          ),
      },
      {
        path: 'classes/:id/history',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.Classes, permission: 'view', entityKind: 'class' },
        loadComponent: () =>
          import('./shared/pages/entity-history/entity-history.component').then(
            (m) => m.EntityHistoryComponent,
          ),
      },
      {
        path: 'subjects/:id/history',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.Subjects, permission: 'view', entityKind: 'subject' },
        loadComponent: () =>
          import('./shared/pages/entity-history/entity-history.component').then(
            (m) => m.EntityHistoryComponent,
          ),
      },
      {
        path: 'teachers',
        redirectTo: 'employees',
        pathMatch: 'full',
      },
      {
        path: 'employees',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.Employees, permission: 'view' },
        loadComponent: () =>
          import('./features/employees/employees.component').then((m) => m.EmployeesComponent),
      },
      {
        path: 'classes',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.Classes, permission: 'view' },
        loadComponent: () =>
          import('./features/class-management/class-management.component').then(
            (m) => m.ClassManagementComponent,
          ),
      },
      {
        path: 'class-subject-teacher-mapping',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.ClassMappings, permission: 'view' },
        loadComponent: () =>
          import('./features/class-subject-teacher-mapping/class-subject-teacher-mapping.component').then(
            (m) => m.ClassSubjectTeacherMappingComponent,
          ),
      },
      {
        path: 'subjects',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.Subjects, permission: 'view' },
        loadComponent: () =>
          import('./features/subjects/subjects.component').then((m) => m.SubjectsComponent),
      },
      {
        path: 'timetable/periods',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.PeriodMaster, permission: 'view' },
        loadComponent: () =>
          import('./features/timetable/periods/periods.component').then((m) => m.PeriodsComponent),
      },
      {
        path: 'timetable/periods/:id/history',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.PeriodMaster, permission: 'view', entityKind: 'period' },
        loadComponent: () =>
          import('./shared/pages/entity-history/entity-history.component').then(
            (m) => m.EntityHistoryComponent,
          ),
      },
      {
        path: 'timetable/grid',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.ClassTimetable, permission: 'view' },
        loadComponent: () =>
          import('./features/timetable/class-timetable/class-timetable.component').then(
            (m) => m.ClassTimetableComponent,
          ),
      },
      {
        path: 'timetable/my',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.MyTimetable, permission: 'view' },
        loadComponent: () =>
          import('./features/timetable/my-timetable/my-timetable.component').then(
            (m) => m.MyTimetableComponent,
          ),
      },
      {
        path: 'attendance',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.Attendance, permission: 'view' },
        loadComponent: () =>
          import('./features/attendance/attendance.component').then((m) => m.AttendanceComponent),
      },
      {
        path: 'attendance-report',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.AttendanceReport, permission: 'view' },
        loadComponent: () =>
          import('./features/attendance/attendance-report/attendance-report.component').then((m) => m.AttendanceReportComponent),
      },
      {
        path: 'homework',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.Homework, permission: 'view' },
        loadComponent: () =>
          import('./features/homework/homework-shell.component').then((m) => m.HomeworkShellComponent),
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/homework/homework.component').then((m) => m.HomeworkComponent),
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./features/homework/homework-detail.component').then(
                (m) => m.HomeworkDetailComponent,
              ),
          },
        ],
      },
      {
        path: 'fees-structure',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.FeesStructure, permission: 'view' },
        loadComponent: () =>
          import('./features/fees/fee-structure/fee-structure.component').then(
            (m) => m.FeeStructureComponent,
          ),
      },
      {
        path: 'fees-class-amounts',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.FeesClassAmounts, permission: 'view' },
        loadComponent: () =>
          import('./features/fees/class-fee-amounts/class-fee-amounts.component').then(
            (m) => m.ClassFeeAmountsComponent,
          ),
      },
      {
        path: 'fees-collection',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.FeesCollection, permission: 'view' },
        loadComponent: () =>
          import('./features/fees/fee-collection/fee-collection.component').then(
            (m) => m.FeeCollectionComponent,
          ),
      },
      {
        path: 'salary-structure',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.SalaryStructure, permission: 'view' },
        loadComponent: () =>
          import('./features/salary/salary-structure/salary-structure.component').then(
            (m) => m.SalaryStructureComponent,
          ),
      },
      {
        path: 'salary-employees',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.SalaryEmployees, permission: 'view' },
        loadComponent: () =>
          import('./features/salary/employee-salary/employee-salary.component').then(
            (m) => m.EmployeeSalaryComponent,
          ),
      },
      {
        path: 'salary-payroll',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.SalaryPayroll, permission: 'view' },
        loadComponent: () =>
          import('./features/salary/payroll/payroll.component').then((m) => m.PayrollComponent),
      },
      {
        path: 'academic-years',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.AcademicYears, permission: 'view' },
        loadComponent: () =>
          import('./features/academic-year-management/academic-year-management.component').then(
            (m) => m.AcademicYearManagementComponent,
          ),
      },
      {
        path: 'academic-years/:id/history',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.AcademicYears, permission: 'view', entityKind: 'academic-year' },
        loadComponent: () =>
          import('./shared/pages/entity-history/entity-history.component').then(
            (m) => m.EntityHistoryComponent,
          ),
      },
      {
        path: 'academic-periods',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.AcademicPeriods, permission: 'view' },
        loadComponent: () =>
          import('./features/academic-period-management/academic-period-management.component').then(
            (m) => m.AcademicPeriodManagementComponent,
          ),
      },
      {
        path: 'leave/staff',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.LeaveStaff, permission: 'view' },
        loadComponent: () =>
          import('./features/leave/staff-leave.component').then((m) => m.StaffLeaveComponent),
      },
      {
        path: 'leave/students',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.LeaveStudent, permission: 'view' },
        loadComponent: () =>
          import('./features/leave/student-leave.component').then((m) => m.StudentLeaveComponent),
      },
      {
        path: 'my-actions',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.MyActions, permission: 'view' },
        loadComponent: () =>
          import('./features/my-actions/my-actions-shell.component').then((m) => m.MyActionsShellComponent),
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/my-actions/my-actions.component').then((m) => m.MyActionsComponent),
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./features/my-actions/my-action-detail.component').then(
                (m) => m.MyActionDetailComponent,
              ),
          },
        ],
      },
      {
        path: 'front-office/visitors',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.VisitorBook, permission: 'view' },
        loadComponent: () =>
          import('./features/front-office/visitors/visitors.component').then((m) => m.VisitorsComponent),
      },
      {
        path: 'front-office/visitors/:id/history',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.VisitorBook, permission: 'view', entityKind: 'visitor' },
        loadComponent: () =>
          import('./shared/pages/entity-history/entity-history.component').then(
            (m) => m.EntityHistoryComponent,
          ),
      },
      {
        path: 'front-office/phone-logs',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.PhoneLogs, permission: 'view' },
        loadComponent: () =>
          import('./features/front-office/phone-logs/phone-logs.component').then(
            (m) => m.PhoneLogsComponent,
          ),
      },
      {
        path: 'front-office/phone-logs/:id/history',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.PhoneLogs, permission: 'view', entityKind: 'phone-log' },
        loadComponent: () =>
          import('./shared/pages/entity-history/entity-history.component').then(
            (m) => m.EntityHistoryComponent,
          ),
      },
      {
        path: 'front-office/complaints',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.Complaints, permission: 'view' },
        loadComponent: () =>
          import('./features/front-office/complaints/complaints.component').then(
            (m) => m.ComplaintsComponent,
          ),
      },
      {
        path: 'front-office/complaints/:id/history',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.Complaints, permission: 'view', entityKind: 'complaint' },
        loadComponent: () =>
          import('./shared/pages/entity-history/entity-history.component').then(
            (m) => m.EntityHistoryComponent,
          ),
      },
      {
        path: 'front-office/admission-inquiries',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.AdmissionInquiries, permission: 'view' },
        loadComponent: () =>
          import('./features/front-office/admission-inquiries/admission-inquiries.component').then(
            (m) => m.AdmissionInquiriesComponent,
          ),
      },
      {
        path: 'front-office/admission-inquiries/:id/history',
        canActivate: [permissionGuard],
        data: {
          menuCode: MenuCodes.AdmissionInquiries,
          permission: 'view',
          entityKind: 'admission-inquiry',
        },
        loadComponent: () =>
          import('./shared/pages/entity-history/entity-history.component').then(
            (m) => m.EntityHistoryComponent,
          ),
      },
      {
        path: 'front-office/setup',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.FrontOfficeSetup, permission: 'view' },
        loadComponent: () =>
          import('./features/front-office/setup/front-office-setup.component').then(
            (m) => m.FrontOfficeSetupComponent,
          ),
      },
      {
        path: 'notices',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.Notices, permission: 'view' },
        loadComponent: () =>
          import('./features/notices/notices.component').then((m) => m.NoticesComponent),
      },
      {
        path: 'exams/groups',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.ExamGroups, permission: 'view' },
        loadComponent: () =>
          import('./features/exams/exam-groups/exam-groups.component').then(
            (m) => m.ExamGroupsComponent,
          ),
      },
      {
        path: 'exams/list',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.Exams, permission: 'view' },
        loadComponent: () =>
          import('./features/exams/exam-list/exam-list.component').then(
            (m) => m.ExamListComponent,
          ),
      },
      {
        path: 'exams/schedule',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.ExamSchedule, permission: 'view' },
        loadComponent: () =>
          import('./features/exams/exam-schedule/exam-schedule.component').then(
            (m) => m.ExamScheduleComponent,
          ),
      },
      {
        path: 'exams/marks-entry',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.ExamMarksEntry, permission: 'view' },
        loadComponent: () =>
          import('./features/exams/marks-entry/marks-entry.component').then(
            (m) => m.MarksEntryComponent,
          ),
      },
      {
        path: 'exams/results',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.ExamResults, permission: 'view' },
        loadComponent: () =>
          import('./features/exams/exam-results/exam-results.component').then(
            (m) => m.ExamResultsComponent,
          ),
      },
      {
        path: 'exams/hall-tickets',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.ExamHallTickets, permission: 'view' },
        loadComponent: () =>
          import('./features/exams/hall-tickets/hall-tickets.component').then(
            (m) => m.HallTicketsComponent,
          ),
      },
      {
        path: 'exams/grade-setup',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.ExamGradeSetup, permission: 'view' },
        loadComponent: () =>
          import('./features/exams/grade-setup/grade-setup.component').then(
            (m) => m.GradeSetupComponent,
          ),
      },
      {
        path: 'configuration/users',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.Users, permission: 'view' },
        loadComponent: () =>
          import('./features/users/users.component').then((m) => m.UsersComponent),
      },
      {
        path: 'configuration/roles',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.Roles, permission: 'view' },
        loadComponent: () =>
          import('./features/roles/roles.component').then((m) => m.RolesComponent),
      },
      {
        path: 'settings',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.Settings, permission: 'view' },
        loadComponent: () =>
          import('./features/settings/settings.component').then((m) => m.SettingsComponent),
      },
    ],
  },
  {
    path: 'auth',
    component: AuthLayoutComponent,
    children: [
      { path: '', redirectTo: 'login', pathMatch: 'full' },
      {
        path: 'login',
        canActivate: [guestGuard],
        loadComponent: () => import('./auth/login/login.component').then((m) => m.LoginComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'auth/login' },
];
