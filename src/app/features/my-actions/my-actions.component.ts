import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MyActionsService, WorkflowItemType } from '../../core/services/my-actions.service';
import { NotificationService } from '../../core/services/notification.service';
import { refreshUi } from '../../core/utils/ui-refresh.util';
import { applyModuleTablePermissions } from '../../core/utils/permission-ui.util';
import { MenuCodes } from '../../core/constants/menu-codes';
import { PermissionService } from '../../core/services/permission.service';
import { AcademicYearContextService } from '../../core/services/academic-year-context.service';
import { SmartDataTableComponent } from '../../shared/components/smart-data-table';
import type { DataTableAction, DataTableConfig, DataTableFilter } from '../../shared/components/smart-data-table';
import { ActionTableRow, mapActionRows } from './my-actions.shared';

@Component({
  selector: 'app-my-actions',
  standalone: true,
  imports: [SmartDataTableComponent],
  templateUrl: './my-actions.component.html',
  styleUrl: './my-actions.component.css',
})
export class MyActionsComponent implements OnInit {
  private readonly actionsService = inject(MyActionsService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly permissionService = inject(PermissionService);
  private readonly ayContext = inject(AcademicYearContextService);

  tableConfig!: DataTableConfig;
  tableRows: ActionTableRow[] = [];
  currentFilter = 'All';

  private readonly baseTableConfig: DataTableConfig = {
    header: {
      title: 'My Actions',
      subtitle: 'Pending approvals, notices, and tasks assigned to you',
      showAddButton: false,
    },
    columns: [
      {
        key: 'itemTypeLabel',
        label: 'Type',
        sortable: true,
        cellType: 'badge',
        badgeMap: {
          LeaveApproval: { cssClass: 'b-amber', label: 'Leave' },
          NoticeResponse: { cssClass: 'b-blue', label: 'Notice' },
          FormFill: { cssClass: 'b-gray', label: 'Form' },
        },
      },
      { key: 'title', label: 'Title', sortable: true },
      { key: 'summary', label: 'Summary' },
      { key: 'dueDate', label: 'Due', sortable: true },
    ],
    filters: [
      { label: 'All', icon: 'list', value: 'All' },
      {
        label: 'Leave',
        icon: 'event_busy',
        value: 'Leave',
        filterFn: (row) => row['itemType'] === WorkflowItemType.LeaveApproval,
      },
      {
        label: 'Notices',
        icon: 'campaign',
        value: 'Notices',
        filterFn: (row) =>
          row['itemType'] === WorkflowItemType.NoticeResponse ||
          row['itemType'] === WorkflowItemType.FormFill,
      },
    ],
    actions: [{ label: 'Take action', icon: 'task_alt', iconColor: '#639922' }],
    searchPlaceholder: 'Search by title or summary…',
    searchKeys: ['title', 'summary', 'itemTypeLabel'],
    itemLabel: 'actions',
    defaultPageSize: 10,
    selectable: false,
    showExport: false,
  };

  ngOnInit(): void {
    this.tableConfig = applyModuleTablePermissions(
      this.baseTableConfig,
      this.permissionService,
      MenuCodes.MyActions,
      this.ayContext.isReadOnlyScope(),
    );
    this.load();
  }

  load(): void {
    this.actionsService.getList().subscribe({
      next: (data) => {
        this.tableRows = mapActionRows(data);
        refreshUi(this.cdr);
      },
      error: (err) => {
        this.notify.error(typeof err?.error === 'string' ? err.error : 'Failed to load actions');
        refreshUi(this.cdr);
      },
    });
  }

  onFilterChanged(filter: DataTableFilter | null): void {
    this.currentFilter = filter?.value ?? 'All';
  }

  onActionClicked(event: { action: DataTableAction; row: Record<string, unknown> }): void {
    const id = String(event.row['id'] ?? '');
    if (!id) return;
    this.openAction(id);
  }

  openAction(id: string): void {
    void this.router.navigate(['/my-actions', id]);
  }
}
