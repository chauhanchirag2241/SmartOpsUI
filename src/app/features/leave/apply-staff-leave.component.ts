import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AcademicYearContextService } from '../../core/services/academic-year-context.service';
import { CreateLeaveRequest, LeaveService, LeaveType } from '../../core/services/leave.service';
import { NotificationService } from '../../core/services/notification.service';
import { ActionButtonComponent } from '../../shared/components/action-button/action-button.component';
import { ScopeReadonlyLockComponent } from '../../shared/components/scope-readonly-lock/scope-readonly-lock.component';
import { refreshUi } from '../../core/utils/ui-refresh.util';
import { isReadOnlyYear } from './workflow-page.util';

@Component({
  selector: 'app-apply-staff-leave',
  standalone: true,
  host: { class: 'apply-staff-leave-page form-page-shell' },
  imports: [CommonModule, FormsModule, MatIconModule, ActionButtonComponent, ScopeReadonlyLockComponent],
  templateUrl: './apply-staff-leave.component.html',
})
export class ApplyStaffLeaveComponent {
  private readonly leaveService = inject(LeaveService);
  private readonly notify = inject(NotificationService);
  private readonly ayContext = inject(AcademicYearContextService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Output() cancel = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  saving = false;
  form: CreateLeaveRequest = this.emptyForm();
  LeaveType = LeaveType;

  get readOnly(): boolean {
    return isReadOnlyYear(this.ayContext);
  }

  save(submit: boolean): void {
    if (this.readOnly) return;
    if (!this.form.fromDate || !this.form.toDate) {
      this.notify.error('Dates are required');
      return;
    }
    this.saving = true;
    refreshUi(this.cdr);
    const body = { ...this.form, submitImmediately: submit };
    this.leaveService.createStaff(body).subscribe({
      next: () => {
        this.notify.success(submit ? 'Leave submitted' : 'Leave saved as draft');
        this.saving = false;
        refreshUi(this.cdr);
        this.saved.emit();
      },
      error: (err) => {
        this.notify.error(typeof err?.error === 'string' ? err.error : 'Failed to save leave');
        this.saving = false;
        refreshUi(this.cdr);
      },
    });
  }

  private emptyForm(): CreateLeaveRequest {
    const today = new Date().toISOString().slice(0, 10);
    return {
      fromDate: today,
      toDate: today,
      leaveType: LeaveType.Casual,
      reason: '',
      submitImmediately: false,
    };
  }
}
