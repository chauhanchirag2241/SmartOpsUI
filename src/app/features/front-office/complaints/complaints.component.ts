import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { MenuCodes } from '../../../core/constants/menu-codes';
import { FrontOfficeService } from '../../../core/services/front-office.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PermissionService } from '../../../core/services/permission.service';
import { applyModuleTablePermissions } from '../../../core/utils/permission-ui.util';
import {
  DateRangeFilterComponent,
  DateRangeValue,
  isDayInDateRange,
  resolveDateRangePreset,
} from '../../../shared/components/date-range-filter/date-range-filter.component';
import { DeleteConfirmDialogComponent } from '../../../shared/components/delete-confirm-dialog/delete-confirm-dialog.component';
import { SmartDataTableComponent } from '../../../shared/components/smart-data-table';
import type {
  DataTableAction,
  DataTableConfig,
} from '../../../shared/interfaces/data-table.interface';
import { getUserFacingApiError } from '../../../shared/utils/api-error.util';
import { AddComplaintComponent } from './add-complaint/add-complaint.component';

@Component({
  selector: 'app-complaints',
  standalone: true,
  imports: [
    SmartDataTableComponent,
    MatDialogModule,
    AddComplaintComponent,
    DateRangeFilterComponent,
  ],
  template: `
    <section class="complaints-page">
      @if (!showAddForm) {
        <app-smart-data-table
          [config]="tableConfig"
          [data]="rows"
          [serverSide]="false"
          (actionClicked)="onActionClicked($event)"
          (addButtonClicked)="onAdd()"
        >
          <app-date-range-filter
            tableFilters
            [value]="dateRange"
            (valueChange)="onDateRange($event)"
          />
        </app-smart-data-table>
      } @else {
        <app-add-complaint
          [mode]="formMode"
          [complaintId]="selectedId"
          (cancel)="closeForm()"
          (saved)="onSaved()"
        />
      }
    </section>
  `,
})
export class ComplaintsComponent implements OnInit {
  private readonly api = inject(FrontOfficeService);
  private readonly notify = inject(NotificationService);
  private readonly permissionService = inject(PermissionService);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);

  showAddForm = false;
  formMode: 'add' | 'edit' | 'view' = 'add';
  selectedId?: string;
  allRows: Record<string, unknown>[] = [];
  rows: Record<string, unknown>[] = [];
  dateRange: DateRangeValue = resolveDateRangePreset('thisMonth');
  tableConfig!: DataTableConfig;

  private readonly baseTableConfig: DataTableConfig = {
    header: {
      title: 'Complaints',
      subtitle: 'Register and track school complaints',
      showAddButton: true,
      addButtonText: 'Add complaint',
      addButtonIcon: 'add',
      addButtonClass: 'btn-primary',
    },
    columns: [
      { key: 'complaintTypeName', label: 'Type', sortable: true },
      { key: 'complainantDisplay', label: 'Complainant', sortable: true },
      { key: 'phone', label: 'Phone' },
      { key: 'complaintDate', label: 'Date', sortable: true },
      { key: 'description', label: 'Description' },
      { key: 'actionTaken', label: 'Action taken' },
      { key: 'assignedToEmployeeName', label: 'Assigned to' },
      {
        key: 'statusLabel',
        label: 'Status',
        cellType: 'badge',
        badgeMap: {
          Pending: { cssClass: 'b-amber', label: 'Pending' },
          'In Progress': { cssClass: 'b-blue', label: 'In Progress' },
          Resolved: { cssClass: 'b-green', label: 'Resolved' },
          Closed: { cssClass: 'b-gray', label: 'Closed' },
        },
      },
      {
        key: 'isActive',
        label: 'Active',
        cellType: 'badge',
        badgeMap: {
          'true': { cssClass: 'b-green', label: 'Active' },
          'false': { cssClass: 'b-red', label: 'Inactive' },
        },
      },
    ],
    filtersInPanel: true,
    filters: [
      { label: 'All', icon: 'list', value: 'All' },
      {
        label: 'Active',
        icon: 'check_circle',
        value: 'Active',
        filterFn: (row) => row['isActive'] !== false,
      },
      {
        label: 'Inactive',
        icon: 'cancel',
        value: 'Inactive',
        filterFn: (row) => row['isActive'] === false,
      },
      {
        label: 'Pending',
        icon: 'schedule',
        value: 'Pending',
        filterFn: (row) => Number(row['status']) === 0,
      },
      {
        label: 'In Progress',
        icon: 'pending',
        value: 'In Progress',
        filterFn: (row) => Number(row['status']) === 1,
      },
      {
        label: 'Resolved',
        icon: 'task_alt',
        value: 'Resolved',
        filterFn: (row) => Number(row['status']) === 2,
      },
      {
        label: 'Closed',
        icon: 'lock',
        value: 'Closed',
        filterFn: (row) => Number(row['status']) === 3,
      },
    ],
    actions: [
      { label: 'View details', icon: 'visibility', iconColor: '#639922' },
      { label: 'Edit details', icon: 'edit', iconColor: '#1E40AF' },
      { label: 'Show history', icon: 'history', iconColor: '#639922' },
      { label: 'Delete', icon: 'delete', danger: true, separatorBefore: true },
    ],
    actionVisibleFn: (action, row) => this.isActionVisible(action, row),
    searchPlaceholder: 'Search complaints…',
    searchKeys: ['complaintTypeName', 'complainantDisplay', 'phone', 'description'],
    itemLabel: 'complaints',
    defaultPageSize: 10,
  };

  ngOnInit(): void {
    this.tableConfig = applyModuleTablePermissions(
      this.baseTableConfig,
      this.permissionService,
      MenuCodes.Complaints,
    );
    this.load();
  }

  onDateRange(range: DateRangeValue): void {
    this.dateRange = range;
    this.applyDisplayedRows();
  }

  onAdd(): void {
    if (!this.permissionService.canAdd(MenuCodes.Complaints)) return;
    this.formMode = 'add';
    this.selectedId = undefined;
    this.showAddForm = true;
  }

  closeForm(): void {
    this.showAddForm = false;
    this.selectedId = undefined;
  }

  onSaved(): void {
    this.closeForm();
    this.load();
  }

  onActionClicked(event: { action: DataTableAction; row: Record<string, unknown> }): void {
    const id = String(event.row['id'] ?? '');
    if (!id) return;

    if (event.action.label === 'View details') {
      if (!this.permissionService.canView(MenuCodes.Complaints)) return;
      this.formMode = 'view';
      this.selectedId = id;
      this.showAddForm = true;
      return;
    }

    if (event.action.label === 'Show history') {
      if (!this.permissionService.canView(MenuCodes.Complaints)) return;
      this.router.navigate(['/front-office/complaints', id, 'history']);
      return;
    }

    if (event.action.label === 'Edit details' || event.action.label === 'Edit') {
      if (!this.permissionService.canEdit(MenuCodes.Complaints)) return;
      this.formMode = 'edit';
      this.selectedId = id;
      this.showAddForm = true;
      return;
    }

    if (event.action.label === 'Delete') {
      if (!this.permissionService.canDelete(MenuCodes.Complaints)) return;
      const name = String(event.row['complainantDisplay'] ?? 'this complaint');
      this.dialog
        .open(DeleteConfirmDialogComponent, {
          data: {
            title: 'Delete complaint?',
            description: 'This will permanently remove the complaint.',
            recordName: name,
          },
          panelClass: 'erp-dialog',
          disableClose: true,
        })
        .afterClosed()
        .subscribe((ok) => {
          if (!ok) return;
          this.api.deleteComplaint(id).subscribe({
            next: () => {
              this.notify.success('Complaint deleted');
              this.load();
            },
            error: (err) => this.notify.error(getUserFacingApiError(err, 'Delete failed')),
          });
        });
    }
  }

  private isActionVisible(action: DataTableAction, row: Record<string, unknown>): boolean {
    if (row['isActive'] === false) {
      return action.label === 'View details' || action.label === 'Show history';
    }
    return true;
  }

  private load(): void {
    this.api.getComplaints({ activeFilter: 'All' }).subscribe({
      next: (list) => {
        this.allRows = list.map((r) => ({
          ...r,
          complainantDisplay: r.isAnonymous ? 'Anonymous' : r.complainantName || '—',
        }));
        this.applyDisplayedRows();
      },
      error: (err) => this.notify.error(getUserFacingApiError(err, 'Failed to load complaints')),
    });
  }

  private applyDisplayedRows(): void {
    this.rows = this.allRows.filter((row) =>
      isDayInDateRange(row['complaintDate'], this.dateRange),
    );
    this.cdr.markForCheck();
  }
}
