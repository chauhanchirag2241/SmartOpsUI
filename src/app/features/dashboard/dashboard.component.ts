import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { PermissionService } from '../../core/services/permission.service';
import { DashboardWidgetCodes } from '../../core/constants/dashboard-widget-codes';
import { MenuCodes } from '../../core/constants/menu-codes';
import type {
  AttendanceDatePreset,
  IDashboardResponse,
  IDashboardWidgetLayoutItem,
} from '../../core/models/dashboard.model';

interface QuickAction {
  icon: string;
  label: string;
  route?: string;
  menuCode?: string;
}

const HIDDEN_STORAGE_KEY = 'smartops.dashboard.hidden';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [MatIconModule, NgFor, NgIf, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly dashboardService = inject(DashboardService);
  private readonly permissionService = inject(PermissionService);

  readonly W = DashboardWidgetCodes;
  readonly loading = signal(true);
  readonly editing = signal(false);
  readonly layout = signal<IDashboardWidgetLayoutItem[]>([]);
  readonly data = signal<IDashboardResponse | null>(null);
  readonly hiddenWidgets = signal<Set<string>>(new Set());
  readonly scopeLabel = signal('');
  readonly academicYearLabel = signal<string | undefined>(undefined);
  readonly schoolName = signal<string | undefined>(undefined);
  readonly attendancePreset = signal<AttendanceDatePreset>('today');
  readonly attendanceCustomFrom = signal('');
  readonly attendanceCustomTo = signal('');
  readonly attendanceLoading = signal(false);

  readonly showAttendanceFilter = computed(
    () => this.has(this.W.AttendanceRate) || this.has(this.W.AttendanceDetail),
  );

  readonly attendanceFilterOptions: { value: AttendanceDatePreset; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'last7days', label: 'Last 7 days' },
    { value: 'thismonth', label: 'This month' },
    { value: 'lastmonth', label: 'Last month' },
    { value: 'custom', label: 'Custom' },
  ];

  readonly visibleWidgets = computed(() => {
    const hidden = this.hiddenWidgets();
    return this.uniqueLayout().filter((w) => !hidden.has(w.code));
  });

  readonly customizeWidgets = computed(() => this.uniqueLayout());

  private readonly uniqueLayout = computed(() => {
    const seen = new Set<string>();
    return this.layout().filter((w) => {
      if (seen.has(w.code)) {
        return false;
      }
      seen.add(w.code);
      return true;
    });
  });

  ngOnInit(): void {
    const today = new Date().toISOString().slice(0, 10);
    this.attendanceCustomFrom.set(today);
    this.attendanceCustomTo.set(today);
    this.loadHiddenFromStorage();
    this.dashboardService.getLayout().subscribe({
      next: (layout) => {
        this.layout.set(layout.widgets);
        this.scopeLabel.set(layout.scopeLabel);
        this.academicYearLabel.set(layout.academicYearLabel);
        this.schoolName.set(layout.schoolName);
        this.loadDashboard();
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  has(code: string): boolean {
    return this.visibleWidgets().some((w) => w.code === code);
  }

  toggleEdit(): void {
    this.editing.update((v) => !v);
  }

  toggleWidgetVisibility(code: string): void {
    const hidden = new Set(this.hiddenWidgets());
    if (hidden.has(code)) {
      hidden.delete(code);
    } else {
      hidden.add(code);
    }
    this.hiddenWidgets.set(hidden);
    this.persistHidden(hidden);
  }

  isWidgetOn(code: string): boolean {
    return !this.hiddenWidgets().has(code);
  }

  hideWidget(code: string): void {
    const hidden = new Set(this.hiddenWidgets());
    hidden.add(code);
    this.hiddenWidgets.set(hidden);
    this.persistHidden(hidden);
  }

  onAttendancePresetChange(value: string): void {
    const preset = value as AttendanceDatePreset;
    this.attendancePreset.set(preset);
    if (preset !== 'custom') {
      this.loadDashboard(true);
    }
  }

  applyCustomAttendanceRange(): void {
    if (!this.attendanceCustomFrom() || !this.attendanceCustomTo()) {
      return;
    }
    this.loadDashboard(true);
  }

  attendanceStatLabel(): string {
    const period = this.data()?.attendanceToday?.periodLabel;
    return period ? `${period} attendance` : 'Attendance';
  }

  formatCurrency(amount: number): string {
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(1)}L`;
    }
    if (amount >= 1000) {
      return `₹${(amount / 1000).toFixed(1)}K`;
    }
    return `₹${amount.toFixed(0)}`;
  }

  donutDash(present: number, total: number): string {
    const circumference = 163;
    if (total <= 0) {
      return `0 ${circumference}`;
    }
    const filled = Math.round((present / total) * circumference);
    return `${filled} ${circumference}`;
  }

  readonly quickActions: QuickAction[] = [
    { icon: 'person_add', label: 'Add student', route: '/students', menuCode: MenuCodes.Students },
    { icon: 'how_to_reg', label: 'Mark attendance', route: '/attendance', menuCode: MenuCodes.Attendance },
    { icon: 'payments', label: 'Collect fees', route: '/fees-collection', menuCode: MenuCodes.FeesCollection },
    { icon: 'edit_note', label: 'Add homework', route: '/homework', menuCode: MenuCodes.Homework },
  ];

  visibleQuickActions(): QuickAction[] {
    return this.quickActions.filter((a) => {
      if (!a.menuCode) {
        return true;
      }
      return this.permissionService.canView(a.menuCode);
    });
  }

  badgeClass(tone: string): string {
    switch (tone) {
      case 'alert':
        return 'pill pr';
      case 'warn':
        return 'pill pa';
      case 'danger':
        return 'pill pr';
      default:
        return 'pill pg';
    }
  }

  private loadDashboard(attendanceOnly = false): void {
    if (attendanceOnly) {
      this.attendanceLoading.set(true);
    } else {
      this.loading.set(true);
    }

    const preset = this.attendancePreset();
    this.dashboardService
      .getDashboard({
        attendancePreset: preset,
        attendanceFrom: preset === 'custom' ? this.attendanceCustomFrom() : undefined,
        attendanceTo: preset === 'custom' ? this.attendanceCustomTo() : undefined,
      })
      .subscribe({
        next: (response) => {
          this.data.set(response);
          this.loading.set(false);
          this.attendanceLoading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.attendanceLoading.set(false);
        },
      });
  }

  private loadHiddenFromStorage(): void {
    try {
      const raw = localStorage.getItem(HIDDEN_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        this.hiddenWidgets.set(new Set(parsed));
      }
    } catch {
      /* ignore */
    }
  }

  private persistHidden(hidden: Set<string>): void {
    try {
      localStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify([...hidden]));
    } catch {
      /* ignore */
    }
  }
}
