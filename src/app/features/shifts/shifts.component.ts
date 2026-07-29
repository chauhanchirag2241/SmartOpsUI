import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { NotificationService } from '../../core/services/notification.service';

import { AddShiftComponent } from './add-shift/add-shift.component';
import { ShiftService } from '../../core/services/shift.service';
import { SmartDataTableComponent } from '../../shared/components/smart-data-table';
import { DeleteConfirmDialogComponent } from '../../shared/components/delete-confirm-dialog/delete-confirm-dialog.component';

import type {
  DataTableAction,
  DataTableConfig,
  DataTableFilter,
} from '../../shared/components/smart-data-table';
import { MenuCodes } from '../../core/constants/menu-codes';
import { PermissionService } from '../../core/services/permission.service';
import { applyModuleTablePermissions } from '../../core/utils/permission-ui.util';

@Component({
  selector: 'app-shifts',
  standalone: true,
  imports: [
    CommonModule,
    SmartDataTableComponent,
    MatIconModule,
    MatSnackBarModule,
    MatDialogModule,
    AddShiftComponent,
  ],
  templateUrl: './shifts.component.html',
  styleUrl: './shifts.component.css',
})
export class ShiftsComponent implements OnInit {
  private readonly permissionService = inject(PermissionService);
  private readonly router = inject(Router);

  showAddForm = false;
  formMode: 'add' | 'edit' | 'view' = 'add';
  selectedShiftId?: string;
  totalShifts = 0;
  currentFilter = 'All';
  shifts: Record<string, unknown>[] = [];

  tableConfig!: DataTableConfig;

  private readonly baseTableConfig: DataTableConfig = {
    header: {
      title: 'Shifts',
      subtitle: 'Manage school shift timings for classes',
      showAddButton: true,
      addButtonText: 'Add shift',
      addButtonIcon: 'add',
      addButtonClass: 'btn-primary',
    },
    columns: [
      {
        key: 'shiftName',
        label: 'Shift name',
        sortable: true,
        cellType: 'text',
      },
      {
        key: 'startTime',
        label: 'Start time',
        sortable: true,
      },
      {
        key: 'endTime',
        label: 'End time',
        sortable: true,
      },
      {
        key: 'displayOrder',
        label: 'Order',
        sortable: true,
      },
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
      { label: 'Active', icon: 'check_circle', value: 'Active' },
      { label: 'Inactive', icon: 'cancel', value: 'Inactive' },
    ],
    actions: [
      { label: 'View details', icon: 'visibility', iconColor: '#639922' },
      { label: 'Edit details', icon: 'edit', iconColor: '#1E40AF' },
      { label: 'Show history', icon: 'history', iconColor: '#639922' },
      { label: 'Delete', icon: 'delete', danger: true, separatorBefore: true },
    ],
    actionVisibleFn: (action, row) => this.isShiftActionVisible(action, row),
    searchPlaceholder: 'Search by shift name...',
    searchKeys: ['shiftName'],
    itemLabel: 'shifts',
    defaultPageSize: 10,
  };

  constructor(
    private snackBar: NotificationService,
    private shiftService: ShiftService,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    this.tableConfig = this.buildTableConfig();
    this.loadShifts();
  }

  loadShifts(
    pageIndex = 1,
    pageSize = 10,
    searchQuery = '',
    sortColumn: string | null = null,
    sortDirection: string | null = null,
    filter: string = this.currentFilter,
  ): void {
    this.shiftService
      .getShifts(pageIndex, pageSize, searchQuery, sortColumn, sortDirection, filter)
      .subscribe({
        next: (res: any) => {
          this.shifts = res?.items || [];
          this.totalShifts = res?.totalCount || 0;
          this.cdr.detectChanges();
        },
        error: () => {
          this.snackBar.open('Failed to load shifts', 'Close', {
            duration: 3000,
            panelClass: 'snack-error',
          });
        },
      });
  }

  onAddButtonClicked(): void {
    if (!this.permissionService.canAdd(MenuCodes.Shifts)) return;
    this.formMode = 'add';
    this.selectedShiftId = undefined;
    this.showAddForm = true;
  }

  closeAddForm(): void {
    this.showAddForm = false;
  }

  onShiftSaved(): void {
    this.showAddForm = false;
    this.loadShifts();
  }

  onPageChange(event: any): void {
    this.loadShifts(
      event.pageIndex,
      event.pageSize,
      event.searchQuery,
      event.sortColumn,
      event.sortDirection,
      event.currentFilter || this.currentFilter,
    );
  }

  onFilterChanged(filter: DataTableFilter | null): void {
    this.currentFilter = filter ? filter.value : 'All';
  }

  onActionClicked(event: {
    action: DataTableAction;
    row: Record<string, unknown>;
    rowIndex: number;
  }): void {
    const id = event.row['id'] as string;

    if (event.action.label === 'View details') {
      if (!this.permissionService.canView(MenuCodes.Shifts)) return;
      this.formMode = 'view';
      this.selectedShiftId = id;
      this.showAddForm = true;
    } else if (event.action.label === 'Edit details') {
      if (!this.permissionService.canEdit(MenuCodes.Shifts)) return;
      this.formMode = 'edit';
      this.selectedShiftId = id;
      this.showAddForm = true;
    } else if (event.action.label === 'Show history') {
      if (!this.permissionService.canView(MenuCodes.Shifts)) return;
      void this.router.navigate(['/shifts', id, 'history']);
    } else if (event.action.label === 'Delete') {
      if (!this.permissionService.canDelete(MenuCodes.Shifts)) return;
      this.confirmDelete(id, String(event.row['shiftName'] ?? 'this shift'));
    }
  }

  private confirmDelete(id: string, name: string): void {
    const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Delete shift',
        description: `Delete "${name}"? Classes using this shift will keep the link until reassigned.`,
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.shiftService.deleteShift(id).subscribe({
        next: () => {
          this.snackBar.open('Shift deleted', 'Close', {
            duration: 3000,
            panelClass: 'snack-success',
          });
          this.loadShifts();
        },
        error: () => {
          this.snackBar.open('Failed to delete shift', 'Close', {
            duration: 3000,
            panelClass: 'snack-error',
          });
        },
      });
    });
  }

  private isShiftActionVisible(action: DataTableAction, row: Record<string, unknown>): boolean {
    const active = row['isActive'] !== false && row['isActive'] !== 'false';
    if (action.label === 'Delete') {
      return active;
    }
    return true;
  }

  private buildTableConfig(): DataTableConfig {
    return applyModuleTablePermissions(
      this.baseTableConfig,
      this.permissionService,
      MenuCodes.Shifts,
    );
  }
}
