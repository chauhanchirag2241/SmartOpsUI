import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MenuCodes } from '../../core/constants/menu-codes';
import { AcademicYearContextService } from '../../core/services/academic-year-context.service';
import { LeaveService } from '../../core/services/leave.service';
import { NotificationService } from '../../core/services/notification.service';
import { PermissionService } from '../../core/services/permission.service';
import { ListPageHeaderComponent } from '../../shared/components/list-page-header/list-page-header.component';
import { PageToolbarComponent } from '../../shared/components/page-toolbar/page-toolbar.component';
import { ScopeReadonlyLockComponent } from '../../shared/components/scope-readonly-lock/scope-readonly-lock.component';
import { ApplyStaffLeaveComponent } from './apply-staff-leave.component';
import { asLeaveArray, leaveStatusBadgeClass, LeaveListItem } from './leave.shared';
import { refreshUi } from '../../core/utils/ui-refresh.util';
import { canAddInScope } from './workflow-page.util';

@Component({
  selector: 'app-staff-leave',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    ListPageHeaderComponent,
    PageToolbarComponent,
    ScopeReadonlyLockComponent,
    ApplyStaffLeaveComponent,
  ],
  templateUrl: './staff-leave.component.html',
  styleUrl: './workflow-page.shared.css',
})
export class StaffLeaveComponent implements OnInit {
  private readonly leaveService = inject(LeaveService);
  private readonly notify = inject(NotificationService);
  private readonly ayContext = inject(AcademicYearContextService);
  private readonly permissionService = inject(PermissionService);
  private readonly cdr = inject(ChangeDetectorRef);

  items: LeaveListItem[] = [];
  statusFilter = '';
  loading = false;
  showApplyForm = false;

  get canWrite(): boolean {
    return canAddInScope(this.ayContext, this.permissionService, MenuCodes.LeaveStaff);
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    refreshUi(this.cdr);
    this.leaveService.getStaffList(this.statusFilter || undefined).subscribe({
      next: (data) => {
        this.items = asLeaveArray(data);
        this.loading = false;
        refreshUi(this.cdr);
      },
      error: (err) => {
        this.notify.error(typeof err?.error === 'string' ? err.error : 'Failed to load leave requests');
        this.loading = false;
        refreshUi(this.cdr);
      },
    });
  }

  openApply(): void {
    if (!this.canWrite) return;
    this.showApplyForm = true;
    refreshUi(this.cdr);
  }

  closeApply(): void {
    this.showApplyForm = false;
    refreshUi(this.cdr);
  }

  onApplySaved(): void {
    this.showApplyForm = false;
    this.load();
  }

  submitRow(item: LeaveListItem): void {
    this.leaveService.submitStaff(item.id).subscribe({
      next: () => {
        this.notify.success('Submitted for approval');
        this.load();
      },
      error: (err) => {
        this.notify.error(typeof err?.error === 'string' ? err.error : 'Submit failed');
        refreshUi(this.cdr);
      },
    });
  }

  badgeClass(status: string): string {
    return leaveStatusBadgeClass(status);
  }
}
