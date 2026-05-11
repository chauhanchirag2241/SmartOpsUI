import { Component, inject } from '@angular/core';
import { NgFor } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';

interface DashboardStat {
  label: string;
  value: string;
  icon: string;
  trend: string;
  trendDirection: 'up' | 'down';
}

interface AttendanceItem {
  label: string;
  value: string;
  color: string;
}

interface EnrollmentItem {
  month: string;
  value: number;
}

interface ActivityItem {
  initials: string;
  name: string;
  detail: string;
  badge: string;
  tone: 'good' | 'alert' | 'warn';
}

interface FeeItem {
  className: string;
  students: number;
  collected: string;
  total: string;
  percent: number;
  pending: number;
}

interface AlertItem {
  icon: string;
  title: string;
  subtitle: string;
  tone: 'danger' | 'warning' | 'success';
}

interface QuickAction {
  icon: string;
  label: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [MatCardModule, MatIconModule, NgFor],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  readonly auth = inject(AuthService);
  readonly stats: DashboardStat[] = [
    { label: 'Total students', value: '248', icon: 'groups', trend: '+12', trendDirection: 'up' },
    { label: 'Present today', value: '221', icon: 'how_to_reg', trend: '89%', trendDirection: 'up' },
    { label: 'Fees collected', value: 'Rs 1.8L', icon: 'payments', trend: '68%', trendDirection: 'up' },
    { label: 'Fees overdue', value: '32', icon: 'warning', trend: '-3', trendDirection: 'down' },
  ];

  readonly attendance: AttendanceItem[] = [
    { label: 'Present', value: '221', color: '#639922' },
    { label: 'Absent', value: '18', color: '#e24b4a' },
    { label: 'Leave', value: '9', color: '#ef9f27' },
    { label: 'Holiday', value: '0', color: '#d7ddcf' },
  ];

  readonly enrollments: EnrollmentItem[] = [
    { month: 'Apr', value: 22 },
    { month: 'May', value: 18 },
    { month: 'Jun', value: 15 },
    { month: 'Jul', value: 12 },
    { month: 'Aug', value: 8 },
    { month: 'Sep', value: 6 },
    { month: 'Oct', value: 5 },
    { month: 'Nov', value: 7 },
    { month: 'Dec', value: 4 },
    { month: 'Jan', value: 10 },
    { month: 'Feb', value: 14 },
    { month: 'Mar', value: 19 },
  ];

  readonly activities: ActivityItem[] = [
    { initials: 'RP', name: 'Rahul Patel', detail: 'Admitted - Class 10A', badge: 'New', tone: 'good' },
    { initials: 'KD', name: 'Kriti Dave', detail: 'Fee paid - Rs 12,000', badge: 'Paid', tone: 'good' },
    { initials: 'AS', name: 'Arjun Shah', detail: 'Absent - no reason', badge: 'Alert', tone: 'alert' },
    { initials: 'PM', name: 'Priya Modi', detail: 'TC issued - Class 9B', badge: 'TC', tone: 'warn' },
    { initials: 'VJ', name: 'Vivek Joshi', detail: 'Fee overdue - 30 days', badge: 'Due', tone: 'alert' },
  ];

  readonly fees: FeeItem[] = [
    { className: 'Class 10', students: 52, collected: 'Rs 62,400', total: 'Rs 90,000', percent: 69, pending: 16 },
    { className: 'Class 9', students: 48, collected: 'Rs 55,200', total: 'Rs 72,000', percent: 77, pending: 11 },
    { className: 'Class 8', students: 44, collected: 'Rs 48,000', total: 'Rs 66,000', percent: 73, pending: 12 },
    { className: 'Class 7', students: 40, collected: 'Rs 44,000', total: 'Rs 60,000', percent: 73, pending: 10 },
  ];

  readonly alerts: AlertItem[] = [
    { icon: 'payments', title: '32 fees overdue', subtitle: 'Action needed', tone: 'danger' },
    { icon: 'person_off', title: '18 absent today', subtitle: 'No reason given', tone: 'warning' },
    { icon: 'workspace_premium', title: 'Exam in 5 days', subtitle: 'Class 10 - final term', tone: 'success' },
  ];

  readonly quickActions: QuickAction[] = [
    { icon: 'person_add', label: 'Add student' },
    { icon: 'how_to_reg', label: 'Mark attendance' },
    { icon: 'payments', label: 'Collect fees' },
    { icon: 'event_note', label: 'Exam schedule' },
  ];

  enrollmentHeight(value: number): number {
    const max = Math.max(...this.enrollments.map((item) => item.value));
    return Math.max(8, Math.round((value / max) * 76));
  }
}
