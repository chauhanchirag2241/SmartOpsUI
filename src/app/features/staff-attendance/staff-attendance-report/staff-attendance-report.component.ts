import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { DepartmentService, DepartmentDto } from '../../../core/services/department.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  StaffAttendanceService,
  StaffAttendanceReportDto,
  StaffAttendanceReportEmployeeDto,
} from '../../../core/services/staff-attendance.service';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { PageChromeDirective } from '../../../shared/directives/page-chrome.directive';

@Component({
  selector: 'app-staff-attendance-report',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    AvatarComponent,
    MatFormFieldModule,
    MatSelectModule,
    PageChromeDirective,
  ],
  templateUrl: './staff-attendance-report.component.html',
  styleUrls: ['./staff-attendance-report.component.css'],
})
export class StaffAttendanceReportComponent implements OnInit {
  private readonly staffAttendance = inject(StaffAttendanceService);
  private readonly departmentService = inject(DepartmentService);
  private readonly snackBar = inject(NotificationService);

  departments = signal<DepartmentDto[]>([]);
  selectedDepartmentId = signal<string>('');
  selectedMonth = signal<number>(new Date().getMonth() + 1);
  selectedYear = signal<number>(new Date().getFullYear());

  searchQuery = signal<string>('');
  chipFilter = signal<string>('all');
  currentView = signal<string>('register');

  reportData = signal<StaffAttendanceReportDto | null>(null);
  loading = signal<boolean>(false);

  years = signal<number[]>([]);

  daysInMonth = computed(() => {
    if (!this.reportData()) return [];
    const month = this.selectedMonth();
    const year = this.selectedYear();
    const days = new Date(year, month, 0).getDate();
    return Array.from({ length: days }, (_, i) => i + 1);
  });

  filteredEmployees = computed(() => {
    const data = this.reportData();
    if (!data) return [];

    let employees = data.employees || [];
    const q = this.searchQuery().toLowerCase();

    if (q) {
      employees = employees.filter(
        (e) =>
          e.employeeName.toLowerCase().includes(q) ||
          (e.departmentName || '').toLowerCase().includes(q),
      );
    }

    if (this.chipFilter() === 'low') {
      employees = employees.filter((e) => this.attendancePct(e) < 75);
    }

    if (this.chipFilter() === 'absent') {
      employees = employees.filter((e) => e.absentDays >= 3);
    }

    return employees;
  });

  kpi = computed(() => {
    const data = this.reportData();
    if (!data) {
      return { workingDays: 0, avgPct: 0, perfect: 0, below75: 0, chronic: 0 };
    }
    const employees = data.employees || [];
    const working = data.totalWorkingDays || 0;
    const pcts = employees.map((e) => this.attendancePct(e));
    const avgPct =
      pcts.length > 0 ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0;
    return {
      workingDays: working,
      avgPct,
      perfect: pcts.filter((p) => p >= 100).length,
      below75: pcts.filter((p) => p < 75).length,
      chronic: employees.filter((e) => e.absentDays >= 5).length,
    };
  });

  ngOnInit(): void {
    const y = new Date().getFullYear();
    this.years.set([y - 1, y, y + 1]);
    this.loadDepartments();
  }

  loadDepartments(): void {
    this.departmentService.getDepartments().subscribe({
      next: (deps) => this.departments.set((deps || []).filter((d) => d.isActive !== false)),
      error: () => this.departments.set([]),
    });
  }

  loadReport(): void {
    this.loading.set(true);
    const deptId = this.selectedDepartmentId() || null;
    this.staffAttendance.getReport(this.selectedMonth(), this.selectedYear(), deptId).subscribe({
      next: (res) => {
        this.reportData.set(res);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        const message =
          err?.status === 403
            ? 'You do not have permission to view the staff attendance report.'
            : typeof err?.error === 'string'
              ? err.error
              : 'Failed to load report data';
        this.snackBar.error(message);
      },
    });
  }

  setChip(filter: string): void {
    this.chipFilter.set(filter);
  }

  setView(view: string): void {
    this.currentView.set(view);
  }

  showToast(msg: string): void {
    this.snackBar.success(msg);
  }

  isSunday(day: number): boolean {
    return new Date(this.selectedYear(), this.selectedMonth() - 1, day).getDay() === 0;
  }

  dayStatus(employee: StaffAttendanceReportEmployeeDto, day: number): string {
    const map = employee.dailyStatus || {};
    return (map as Record<string | number, string>)[day] ?? (map as Record<string, string>)[String(day)] ?? '';
  }

  attendancePct(employee: StaffAttendanceReportEmployeeDto): number {
    const working = this.reportData()?.totalWorkingDays || 0;
    if (working <= 0) return 0;
    const attended = (employee.presentDays || 0) + (employee.lateDays || 0) + (employee.halfDayDays || 0) * 0.5;
    return Math.round((attended / working) * 100);
  }

  monthLabel(): string {
    return `${this.selectedMonth()}/${this.selectedYear()}`;
  }
}
