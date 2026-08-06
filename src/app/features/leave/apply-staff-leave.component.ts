import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AcademicYearContextService } from '../../core/services/academic-year-context.service';
import { LeaveBalanceDto, LeaveBalanceService } from '../../core/services/leave-balance.service';
import {
  CreateLeaveRequest,
  LeaveApplicant,
  LeaveHalfDay,
  LeaveHalfDaySession,
  LeaveService,
} from '../../core/services/leave.service';
import { LeaveTypeDto, LeaveTypeService } from '../../core/services/leave-type.service';
import { NotificationService } from '../../core/services/notification.service';
import { refreshUi } from '../../core/utils/ui-refresh.util';
import { ActionButtonComponent } from '../../shared/components/action-button/action-button.component';
import { ScopeReadonlyLockComponent } from '../../shared/components/scope-readonly-lock/scope-readonly-lock.component';
import { ToggleSwitchComponent } from '../../shared/components/toggle-switch';
import { PageChromeDirective } from '../../shared/directives/page-chrome.directive';
import { FormFieldComponent } from '../../shared/form-controls/form-field';
import type { FormFieldOption } from '../../shared/form-controls/form-field';
import { getUserFacingApiError } from '../../shared/utils/api-error.util';
import { todayDateOnlyString } from '../../shared/utils/date-only.util';
import { asApproverArray, LeaveApprover } from './leave.shared';
import { isReadOnlyYear } from './workflow-page.util';

interface HalfDayRow {
  date: string;
  selected: boolean;
  session: LeaveHalfDaySession;
}

@Component({
  selector: 'app-apply-staff-leave',
  standalone: true,
  host: { class: 'apply-staff-leave-page form-page-shell' },
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    ActionButtonComponent,
    ScopeReadonlyLockComponent,
    PageChromeDirective,
    FormFieldComponent,
    ToggleSwitchComponent,
  ],
  templateUrl: './apply-staff-leave.component.html',
  styleUrl: './apply-staff-leave.component.css',
})
export class ApplyStaffLeaveComponent implements OnInit {
  private readonly leaveService = inject(LeaveService);
  private readonly leaveTypeService = inject(LeaveTypeService);
  private readonly balanceService = inject(LeaveBalanceService);
  private readonly notify = inject(NotificationService);
  private readonly ayContext = inject(AcademicYearContextService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Output() cancel = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  saving = false;
  loadingApprovers = false;
  loadingApplicant = false;
  loadingTypes = false;
  approvers: LeaveApprover[] = [];
  applicant: LeaveApplicant | null = null;
  leaveTypes: LeaveTypeDto[] = [];
  leaveTypeOptions: FormFieldOption[] = [];
  balances: LeaveBalanceDto[] = [];
  isHalfDay = false;
  halfDayRows: HalfDayRow[] = [];
  sessionOptions: FormFieldOption[] = [
    { label: 'First half', value: 'FirstHalf' },
    { label: 'Second half', value: 'SecondHalf' },
  ];
  form: CreateLeaveRequest = this.emptyForm();

  get readOnly(): boolean {
    return isReadOnlyYear(this.ayContext);
  }

  get employeeName(): string {
    return this.applicant?.employeeName?.trim() || '—';
  }

  get reportingManagerName(): string {
    return this.applicant?.reportingManager?.name?.trim()
      || this.approvers[0]?.name?.trim()
      || '—';
  }

  get selectedLeaveType(): LeaveTypeDto | null {
    const id = this.form.leaveTypeId;
    if (!id) return null;
    return this.leaveTypes.find((t) => t.id === id) ?? null;
  }

  get allowHalfDay(): boolean {
    return this.selectedLeaveType?.allowHalfDay !== false;
  }

  get selectedBalance(): LeaveBalanceDto | null {
    const id = this.form.leaveTypeId;
    if (!id) return null;
    return this.balances.find((b) => b.leaveTypeId === id) ?? null;
  }

  get remainingBalanceLabel(): string | null {
    const bal = this.selectedBalance;
    if (!bal) return null;
    const type = this.leaveTypes.find((t) => t.id === bal.leaveTypeId);
    if (type && type.requiresBalance === false) return null;
    return `${bal.closingBalance} day(s) remaining`;
  }

  get totalDaysPreview(): number {
    if (!this.form.fromDate || !this.form.toDate) return 0;
    const from = this.parseDay(this.form.fromDate);
    const to = this.parseDay(this.form.toDate);
    if (from == null || to == null || to < from) return 0;

    if (!this.isHalfDay) {
      return to - from + 1;
    }

    let total = 0;
    for (let d = from; d <= to; d++) {
      const iso = this.dayToIso(d);
      const row = this.halfDayRows.find((r) => r.date === iso);
      total += row?.selected ? 0.5 : 1;
    }
    return total;
  }

  ngOnInit(): void {
    this.loadApplicant();
    this.loadApprovers();
    this.loadLeaveTypes();
    this.loadBalances();
    this.rebuildHalfDayRows();
  }

  onDatesChanged(): void {
    this.rebuildHalfDayRows();
    refreshUi(this.cdr);
  }

  onHalfDayToggle(enabled: boolean): void {
    this.isHalfDay = enabled;
    if (!enabled) {
      for (const row of this.halfDayRows) {
        row.selected = false;
      }
    } else if (this.halfDayRows.length === 1) {
      this.halfDayRows[0].selected = true;
    }
    refreshUi(this.cdr);
  }

  onLeaveTypeChanged(): void {
    if (!this.allowHalfDay && this.isHalfDay) {
      this.onHalfDayToggle(false);
    }
    refreshUi(this.cdr);
  }

  loadApplicant(): void {
    this.loadingApplicant = true;
    this.leaveService.getStaffApplicant().subscribe({
      next: (data) => {
        this.applicant = data;
        this.loadingApplicant = false;
        refreshUi(this.cdr);
      },
      error: () => {
        this.applicant = null;
        this.loadingApplicant = false;
        refreshUi(this.cdr);
      },
    });
  }

  loadApprovers(): void {
    this.loadingApprovers = true;
    this.leaveService.getStaffApprovers().subscribe({
      next: (data) => {
        this.approvers = asApproverArray(data);
        this.loadingApprovers = false;
        refreshUi(this.cdr);
      },
      error: () => {
        this.approvers = [];
        this.loadingApprovers = false;
        refreshUi(this.cdr);
      },
    });
  }

  loadLeaveTypes(): void {
    this.loadingTypes = true;
    this.leaveTypeService.getActive().subscribe({
      next: (list) => {
        this.leaveTypes = (Array.isArray(list) ? list : []).filter((t) => t.isActive !== false);
        this.leaveTypeOptions = this.leaveTypes.map((t) => ({
          label: `${t.code} — ${t.name}`,
          value: t.id,
        }));
        if (!this.form.leaveTypeId && this.leaveTypes.length) {
          this.form.leaveTypeId = this.leaveTypes[0].id;
        }
        this.loadingTypes = false;
        refreshUi(this.cdr);
      },
      error: (err) => {
        this.leaveTypes = [];
        this.leaveTypeOptions = [];
        this.loadingTypes = false;
        this.notify.error(getUserFacingApiError(err, 'Failed to load leave types'));
        refreshUi(this.cdr);
      },
    });
  }

  loadBalances(): void {
    this.balanceService.getMine().subscribe({
      next: (list) => {
        this.balances = Array.isArray(list) ? list : [];
        refreshUi(this.cdr);
      },
      error: () => {
        this.balances = [];
        refreshUi(this.cdr);
      },
    });
  }

  submit(): void {
    if (this.readOnly) return;
    if (!this.form.fromDate || !this.form.toDate) {
      this.notify.error('Dates are required');
      return;
    }
    if (!this.form.leaveTypeId) {
      this.notify.error('Leave type is required');
      return;
    }
    if (!String(this.form.reason ?? '').trim()) {
      this.notify.error('Reason is required');
      return;
    }

    const halfDays: LeaveHalfDay[] = this.isHalfDay
      ? this.halfDayRows
          .filter((r) => r.selected)
          .map((r) => ({ date: r.date, session: r.session }))
      : [];

    if (this.isHalfDay && halfDays.length === 0) {
      this.notify.error('Select at least one half-day date');
      return;
    }

    this.saving = true;
    refreshUi(this.cdr);
    const body: CreateLeaveRequest = {
      fromDate: this.form.fromDate,
      toDate: this.form.toDate,
      leaveTypeId: this.form.leaveTypeId,
      reason: String(this.form.reason ?? '').trim(),
      submitImmediately: true,
      isHalfDay: this.isHalfDay,
      halfDays,
    };
    this.leaveService.createStaff(body).subscribe({
      next: () => {
        this.notify.success('Leave submitted for approval');
        this.saving = false;
        refreshUi(this.cdr);
        this.saved.emit();
      },
      error: (err) => {
        this.notify.error(getUserFacingApiError(err, 'Failed to submit leave'));
        this.saving = false;
        refreshUi(this.cdr);
      },
    });
  }

  private rebuildHalfDayRows(): void {
    const from = this.parseDay(this.form.fromDate);
    const to = this.parseDay(this.form.toDate);
    if (from == null || to == null || to < from) {
      this.halfDayRows = [];
      return;
    }

    const prev = new Map(this.halfDayRows.map((r) => [r.date, r]));
    const rows: HalfDayRow[] = [];
    for (let d = from; d <= to; d++) {
      const iso = this.dayToIso(d);
      const existing = prev.get(iso);
      rows.push({
        date: iso,
        selected: existing?.selected ?? false,
        session: existing?.session ?? 'FirstHalf',
      });
    }
    this.halfDayRows = rows;
  }

  private parseDay(value?: string | null): number | null {
    if (!value) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
    if (!m) return null;
    const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (Number.isNaN(dt.getTime())) return null;
    return Math.floor(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()) / 86400000);
  }

  private dayToIso(dayNumber: number): string {
    const ms = dayNumber * 86400000;
    const dt = new Date(ms);
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dt.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private emptyForm(): CreateLeaveRequest {
    const today = todayDateOnlyString();
    return {
      fromDate: today,
      toDate: today,
      leaveTypeId: null,
      reason: '',
      submitImmediately: true,
    };
  }
}
