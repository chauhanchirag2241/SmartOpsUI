import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { MenuCodes } from '../../core/constants/menu-codes';
import { AcademicYearContextService } from '../../core/services/academic-year-context.service';
import { LeaveService } from '../../core/services/leave.service';
import { NotificationService } from '../../core/services/notification.service';
import { PermissionService } from '../../core/services/permission.service';
import { refreshUi } from '../../core/utils/ui-refresh.util';
import { applyModuleTablePermissions } from '../../core/utils/permission-ui.util';
import { ScopeReadonlyLockComponent } from '../../shared/components/scope-readonly-lock/scope-readonly-lock.component';
import { SmartDataTableComponent } from '../../shared/components/smart-data-table';
import type { DataTableConfig, DataTableFilter } from '../../shared/components/smart-data-table';
import { ApplyStaffLeaveComponent } from './apply-staff-leave.component';
import { asLeaveArray, leaveItemsToTableRows } from './leave.shared';
import { canAddInScope } from './workflow-page.util';

@Component({
  selector: 'app-staff-leave',
  standalone: true,
  imports: [SmartDataTableComponent, ScopeReadonlyLockComponent, ApplyStaffLeaveComponent],
  templateUrl: './staff-leave.component.html',
  styleUrl: './staff-leave.component.css',
})
export class StaffLeaveComponent implements OnInit {
  private readonly leaveService = inject(LeaveService);
  private readonly notify = inject(NotificationService);
  private readonly ayContext = inject(AcademicYearContextService);
  private readonly permissionService = inject(PermissionService);
  private readonly cdr = inject(ChangeDetectorRef);

  tableConfig!: DataTableConfig;
  tableRows: Record<string, unknown>[] = [];
  currentFilter = 'All';
  showApplyForm = false;

  private readonly baseTableConfig: DataTableConfig = {
    header: {
      title: 'Staff Leave',
      subtitle: 'Apply and track employee leave requests',
      showAddButton: true,
      addButtonText: 'Apply leave',
      addButtonIcon: 'event_busy',
      addButtonClass: 'btn-primary',
    },
    columns: [
      { key: 'employeeName', label: 'Employee', sortable: true, cellType: 'text' },
      { key: 'fromDate', label: 'From', sortable: true },
      { key: 'toDate', label: 'To', sortable: true },
      { key: 'dayCount', label: 'Days', sortable: true },
      {
        key: 'leaveTypeLabel',
        label: 'Type',
        cellType: 'badge',
        badgeMap: {
          Casual: { cssClass: 'b-blue', label: 'Casual' },
          Sick: { cssClass: 'b-amber', label: 'Sick' },
          Other: { cssClass: 'b-gray', label: 'Other' },
        },
      },
      {
        key: 'statusLabel',
        label: 'Status',
        cellType: 'badge',
        badgeMap: {
          Draft: { cssClass: 'b-blue', label: 'Draft' },
          Submitted: { cssClass: 'b-amber', label: 'Submitted' },
          Approved: { cssClass: 'b-green', label: 'Approved' },
          Rejected: { cssClass: 'b-red', label: 'Rejected' },
          Cancelled: { cssClass: 'b-gray', label: 'Cancelled' },
        },
      },
    ],
    filters: [
      { label: 'All', icon: 'list', value: 'All' },
      {
        label: 'Submitted',
        icon: 'schedule',
        value: 'Submitted',
        filterFn: (row) => row['statusLabel'] === 'Submitted',
      },
      {
        label: 'Approved',
        icon: 'check_circle',
        value: 'Approved',
        filterFn: (row) => row['statusLabel'] === 'Approved',
      },
      {
        label: 'Rejected',
        icon: 'cancel',
        value: 'Rejected',
        filterFn: (row) => row['statusLabel'] === 'Rejected',
      },
      {
        label: 'Cancelled',
        icon: 'block',
        value: 'Cancelled',
        filterFn: (row) => row['statusLabel'] === 'Cancelled',
      },
    ],
    searchPlaceholder: 'Search by employee name…',
    searchKeys: ['employeeName', 'teacherName'],
    itemLabel: 'leave requests',
    defaultPageSize: 10,
    selectable: false,
    showExport: false,
  };

  ngOnInit(): void {
    this.tableConfig = this.buildTableConfig();
    this.load();
  }

  load(): void {
    this.leaveService.getStaffList().subscribe({
      next: (data) => {
        this.tableRows = leaveItemsToTableRows(asLeaveArray(data));
        refreshUi(this.cdr);
      },
      error: (err) => {
        this.notify.error(typeof err?.error === 'string' ? err.error : 'Failed to load leave requests');
        refreshUi(this.cdr);
      },
    });
  }

  openApply(): void {
    if (!canAddInScope(this.ayContext, this.permissionService, MenuCodes.LeaveStaff)) return;
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

  onFilterChanged(filter: DataTableFilter | null): void {
    this.currentFilter = filter?.value ?? 'All';
  }

  private buildTableConfig(): DataTableConfig {
    return applyModuleTablePermissions(
      this.baseTableConfig,
      this.permissionService,
      MenuCodes.LeaveStaff,
      this.ayContext.isReadOnlyScope(),
    );
  }
}
