import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MenuCodes } from '../../core/constants/menu-codes';
import { LeaveTypeDto, LeaveTypeService } from '../../core/services/leave-type.service';
import { NotificationService } from '../../core/services/notification.service';
import { PermissionService } from '../../core/services/permission.service';
import { applyModuleTablePermissions } from '../../core/utils/permission-ui.util';
import { DeleteConfirmDialogComponent } from '../../shared/components/delete-confirm-dialog/delete-confirm-dialog.component';
import { SmartDataTableComponent } from '../../shared/components/smart-data-table';
import type {
  DataTableAction,
  DataTableConfig,
} from '../../shared/interfaces/data-table.interface';
import { getUserFacingApiError } from '../../shared/utils/api-error.util';
import { AddLeaveTypeComponent } from './add-leave-type.component';

@Component({
  selector: 'app-leave-types',
  standalone: true,
  imports: [
    SmartDataTableComponent,
    MatIconModule,
    MatSnackBarModule,
    MatDialogModule,
    AddLeaveTypeComponent,
  ],
  template: `
    <section class="leave-types-page">
      @if (!showAddForm) {
        <app-smart-data-table
          [config]="tableConfig"
          [data]="rows"
          [serverSide]="false"
          (actionClicked)="onActionClicked($event)"
          (addButtonClicked)="onAddButtonClicked()"
        />
      } @else {
        <app-add-leave-type
          [mode]="formMode"
          [leaveTypeId]="selectedId"
          (cancel)="closeForm()"
          (saved)="onSaved()"
        />
      }
    </section>
  `,
})
export class LeaveTypesComponent implements OnInit {
  private readonly service = inject(LeaveTypeService);
  private readonly notify = inject(NotificationService);
  private readonly permissionService = inject(PermissionService);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);

  showAddForm = false;
  formMode: 'add' | 'edit' | 'view' = 'add';
  selectedId?: string;
  rows: Record<string, unknown>[] = [];
  tableConfig!: DataTableConfig;

  private readonly baseTableConfig: DataTableConfig = {
    header: {
      title: 'Leave types',
      subtitle: 'Define paid/unpaid leave categories for staff',
      showAddButton: true,
      addButtonText: 'Add leave type',
      addButtonIcon: 'add',
      addButtonClass: 'btn-primary',
    },
    columns: [
      { key: 'code', label: 'Code', sortable: true, width: '90px' },
      { key: 'name', label: 'Name', sortable: true },
      {
        key: 'isPaid',
        label: 'Paid',
        cellType: 'badge',
        badgeMap: {
          true: { cssClass: 'b-green', label: 'Paid' },
          false: { cssClass: 'b-gray', label: 'Unpaid' },
        },
      },
      {
        key: 'carryForward',
        label: 'Carry forward',
        cellType: 'badge',
        badgeMap: {
          true: { cssClass: 'b-blue', label: 'Yes' },
          false: { cssClass: 'b-gray', label: 'No' },
        },
      },
      { key: 'sortOrder', label: 'Order', sortable: true, width: '80px' },
      {
        key: 'isActive',
        label: 'Status',
        cellType: 'badge',
        badgeMap: {
          true: { cssClass: 'b-green', label: 'Active' },
          false: { cssClass: 'b-red', label: 'Inactive' },
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
    ],
    actions: [
      { label: 'View details', icon: 'visibility', iconColor: '#639922' },
      { label: 'Edit details', icon: 'edit', iconColor: '#1E40AF' },
      { label: 'Delete', icon: 'delete', danger: true, separatorBefore: true },
    ],
    actionVisibleFn: (action, row) => this.isActionVisible(action, row),
    searchPlaceholder: 'Search by code or name...',
    searchKeys: ['code', 'name'],
    itemLabel: 'leave types',
    defaultPageSize: 10,
  };

  ngOnInit(): void {
    this.tableConfig = applyModuleTablePermissions(
      this.baseTableConfig,
      this.permissionService,
      MenuCodes.LeaveTypes,
    );
    this.load();
  }

  load(): void {
    this.service.getAll().subscribe({
      next: (list) => {
        this.rows = (Array.isArray(list) ? list : []).map((r) => this.toRow(r));
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.notify.error(getUserFacingApiError(err, 'Failed to load leave types'));
        this.rows = [];
        this.cdr.detectChanges();
      },
    });
  }

  onAddButtonClicked(): void {
    if (!this.permissionService.canAdd(MenuCodes.LeaveTypes)) return;
    this.formMode = 'add';
    this.selectedId = undefined;
    this.showAddForm = true;
  }

  closeForm(): void {
    this.showAddForm = false;
  }

  onSaved(): void {
    this.showAddForm = false;
    this.load();
  }

  onActionClicked(event: {
    action: DataTableAction;
    row: Record<string, unknown>;
  }): void {
    const id = String(event.row['id'] ?? '');
    if (event.action.label === 'View details') {
      if (!this.permissionService.canView(MenuCodes.LeaveTypes)) return;
      this.formMode = 'view';
      this.selectedId = id;
      this.showAddForm = true;
    } else if (event.action.label === 'Edit details') {
      if (!this.permissionService.canEdit(MenuCodes.LeaveTypes)) return;
      this.formMode = 'edit';
      this.selectedId = id;
      this.showAddForm = true;
    } else if (event.action.label === 'Delete') {
      if (!this.permissionService.canDelete(MenuCodes.LeaveTypes)) return;
      this.confirmDelete(id, String(event.row['name'] ?? 'this leave type'));
    }
  }

  private confirmDelete(id: string, name: string): void {
    const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Delete leave type',
        description: `Delete "${name}"? Policies and balances using this type may be affected.`,
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.service.delete(id).subscribe({
        next: () => {
          this.notify.success('Leave type deleted');
          this.load();
        },
        error: (err) => {
          this.notify.error(getUserFacingApiError(err, 'Failed to delete leave type'));
        },
      });
    });
  }

  private isActionVisible(action: DataTableAction, row: Record<string, unknown>): boolean {
    if (action.label === 'Delete') {
      return row['isActive'] !== false;
    }
    return true;
  }

  private toRow(r: LeaveTypeDto): Record<string, unknown> {
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      isPaid: r.isPaid,
      carryForward: r.carryForward,
      sortOrder: r.sortOrder,
      isActive: r.isActive !== false,
      requiresBalance: r.requiresBalance,
    };
  }
}
