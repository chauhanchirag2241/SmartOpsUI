import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { PermissionService } from '../../core/services/permission.service';
import { DashboardWidgetCodes } from '../../core/constants/dashboard-widget-codes';
import { MenuCodes } from '../../core/constants/menu-codes';
import type {
  IAttendanceToday,
  IDashboardResponse,
  IDashboardWidgetLayoutItem,
} from '../../core/models/dashboard.model';

interface QuickAction {
  icon: string;
  label: string;
  route?: string;
  menuCode?: string;
}

export interface DonutSegment {
  color: string;
  dash: string;
  offset: number;
}

const HIDDEN_STORAGE_KEY = 'smartops.dashboard.hidden';
/** 2π × radius 26 — full ring length for dash math */
const DONUT_CIRCUMFERENCE = 2 * Math.PI * 26;
const DONUT_START_OFFSET = -DONUT_CIRCUMFERENCE * 0.25;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatIconModule, RouterLink],
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
  readonly academicYearLabel = signal<string | undefined>(undefined);

  readonly visibleWidgets = computed(() => {
    const hidden = this.hiddenWidgets();
    return this.uniqueLayout().filter((w) => !hidden.has(w.code));
  });

  readonly customizeWidgets = computed(() => this.uniqueLayout());

  readonly classesOverviewTotals = computed(() => {
    const rows = this.data()?.classesOverview ?? [];
    return {
      studentCount: rows.reduce((s, r) => s + r.studentCount, 0),
      present: rows.reduce((s, r) => s + r.present, 0),
      late: rows.reduce((s, r) => s + r.late, 0),
      absent: rows.reduce((s, r) => s + r.absent, 0),
      onLeave: rows.reduce((s, r) => s + r.onLeave, 0),
      feeCollectedToday: rows.reduce((s, r) => s + r.feeCollectedToday, 0),
    };
  });

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
    this.loadHiddenFromStorage();
    this.dashboardService.getLayout().subscribe({
      next: (layout) => {
        this.layout.set(layout.widgets);
        this.academicYearLabel.set(layout.academicYearLabel);
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

  attendanceStatLabel(): string {
    return "Today's attendance · Present + Late";
  }

  formatCurrency(amount: number): string {
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(1)}L`;
    }
    if (amount >= 1000) {
      return `₹${(amount / 1000).toFixed(1)}K`;
    }
    return `₹${Math.round(amount).toLocaleString('en-IN')}`;
  }

  donutSegments(att: IAttendanceToday): DonutSegment[] {
    const total = att.present + att.absent + att.leave + att.late;
    if (total <= 0) {
      return [];
    }

    const parts: { n: number; color: string }[] = [
      { n: att.present, color: '#639922' },
      { n: att.late, color: '#6366F1' },
      { n: att.leave, color: '#EF9F27' },
      { n: att.absent, color: '#e24b4a' },
    ];

    const active = parts.filter((p) => p.n > 0);
    const circ = DONUT_CIRCUMFERENCE;
    let offset = DONUT_START_OFFSET;
    let drawn = 0;
    const segments: DonutSegment[] = [];

    for (let i = 0; i < active.length; i++) {
      const part = active[i];
      const isLast = i === active.length - 1;
      const len = isLast ? circ - drawn : (part.n / total) * circ;
      drawn += len;
      segments.push({
        color: part.color,
        dash: `${len} ${circ - len}`,
        offset,
      });
      offset -= len;
    }
    return segments;
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

  private loadDashboard(): void {
    this.loading.set(true);
    this.dashboardService.getDashboard().subscribe({
      next: (response) => {
        this.data.set(response);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
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
