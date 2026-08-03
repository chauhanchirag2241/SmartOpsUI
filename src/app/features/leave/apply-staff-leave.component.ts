import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AcademicYearContextService } from '../../core/services/academic-year-context.service';
import { LeaveBalanceDto, LeaveBalanceService } from '../../core/services/leave-balance.service';
import { CreateLeaveRequest, LeaveService } from '../../core/services/leave.service';
import { LeaveTypeDto, LeaveTypeService } from '../../core/services/leave-type.service';
import { NotificationService } from '../../core/services/notification.service';
import { refreshUi } from '../../core/utils/ui-refresh.util';
import { ActionButtonComponent } from '../../shared/components/action-button/action-button.component';
import { PageChromeDirective } from '../../shared/directives/page-chrome.directive';
import { ScopeReadonlyLockComponent } from '../../shared/components/scope-readonly-lock/scope-readonly-lock.component';
import { FormFieldComponent } from '../../shared/form-controls/form-field';
import type { FormFieldOption } from '../../shared/form-controls/form-field';
import { getUserFacingApiError } from '../../shared/utils/api-error.util';
import { asApproverArray, LeaveApprover } from './leave.shared';
import { todayDateOnlyString } from '../../shared/utils/date-only.util';
import { isReadOnlyYear } from './workflow-page.util';

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
  loadingTypes = false;
  approvers: LeaveApprover[] = [];
  leaveTypes: LeaveTypeDto[] = [];
  leaveTypeOptions: FormFieldOption[] = [];
  balances: LeaveBalanceDto[] = [];
  form: CreateLeaveRequest = this.emptyForm();

  get readOnly(): boolean {
    return isReadOnlyYear(this.ayContext);
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

  ngOnInit(): void {
    this.loadApprovers();
    this.loadLeaveTypes();
    this.loadBalances();
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
    this.saving = true;
    refreshUi(this.cdr);
    const body: CreateLeaveRequest = {
      fromDate: this.form.fromDate,
      toDate: this.form.toDate,
      leaveTypeId: this.form.leaveTypeId,
      reason: this.form.reason,
      submitImmediately: true,
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
