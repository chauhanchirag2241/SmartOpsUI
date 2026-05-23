import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { tenantGuard } from './core/guards/tenant.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { MenuCodes } from './core/constants/menu-codes';
import { AdminLayoutComponent } from './layout/admin-layout/admin-layout.component';
import { AuthLayoutComponent } from './layout/auth-layout/auth-layout.component';

export const routes: Routes = [
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
        path: 'teachers',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.Teachers, permission: 'view' },
        loadComponent: () =>
          import('./features/teachers/teachers.component').then((m) => m.TeachersComponent),
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
        path: 'attendance',
        canActivate: [permissionGuard],
        data: { menuCode: MenuCodes.Attendance, permission: 'view' },
        loadComponent: () =>
          import('./features/attendance/attendance.component').then((m) => m.AttendanceComponent),
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
