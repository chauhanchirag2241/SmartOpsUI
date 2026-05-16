import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { tenantGuard } from './core/guards/tenant.guard';
import { permissionGuard } from './core/guards/permission.guard';
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
        data: { permission: 'student.read' },
        loadComponent: () =>
          import('./features/students/students.component').then((m) => m.StudentsComponent),
      },
      {
        path: 'teachers',
        canActivate: [permissionGuard],
        data: { permission: 'teacher.read' },
        loadComponent: () =>
          import('./features/teachers/teachers.component').then((m) => m.TeachersComponent),
      },
      {
        path: 'classes',
        canActivate: [permissionGuard],
        data: { permission: 'class.read' },
        loadComponent: () =>
          import('./features/class-management/class-management.component').then(
            (m) => m.ClassManagementComponent,
          ),
      },
      {
        path: 'subjects',
        canActivate: [permissionGuard],
        data: { permission: 'subject.read' },
        loadComponent: () =>
          import('./features/subjects/subjects.component').then((m) => m.SubjectsComponent),
      },
      {
        path: 'attendance',
        canActivate: [permissionGuard],
        data: { permission: 'attendance.read' },
        loadComponent: () =>
          import('./features/attendance/attendance.component').then((m) => m.AttendanceComponent),
      },
      {
        path: 'academic-years',
        canActivate: [permissionGuard],
        data: { permission: 'academicyear.read' },
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
        loadComponent: () => import('./auth/login/login.component').then((m) => m.LoginComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
