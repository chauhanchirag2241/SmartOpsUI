import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { NotificationService } from '../../../core/services/notification.service';

import { AddFeeMasterComponent } from './add-fee-master/add-fee-master.component';
import { FeeManageComponent } from './fee-manage/fee-manage.component';
import { FeeMasterService } from '../../../core/services/fee-master.service';
import { SmartDataTableComponent } from '../../../shared/components/smart-data-table';
import { DeleteConfirmDialogComponent } from '../../../shared/components/delete-confirm-dialog/delete-confirm-dialog.component';

import type {
  DataTableAction,
  DataTableConfig,
  DataTableFilter,
} from '../../../shared/components/smart-data-table';
import { MenuCodes } from '../../../core/constants/menu-codes';
import { PermissionService } from '../../../core/services/permission.service';
import { applyModuleTablePermissions } from '../../../core/utils/permission-ui.util';
import {
  FEE_APPLICABLE_TO_LABELS,
  FEE_TYPE_LABELS,
  FeeApplicableTo,
  FeeType,
} from '../../../shared/enums/field-options.enum';

@Component({
  selector: 'app-fee-master',
  standalone: true,
  imports: [
    CommonModule,
    SmartDataTableComponent,
    MatIconModule,
    MatSnackBarModule,
    MatDialogModule,
    AddFeeMasterComponent,
    FeeManageComponent,
  ],
  templateUrl: './fee-master.component.html',
  styleUrl: './fee-master.component.css',
})
export class FeeMasterComponent implements OnInit {
  private readonly permissionService = inject(PermissionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  showAddForm = false;
  showManage = false;
  formMode: 'add' | 'edit' | 'view' = 'add';
  selectedFeeId?: string;
  manageInitialTab = 0;
  totalFees = 0;
  currentFilter = 'All';
  fees: Record<string, unknown>[] = [];

  tableConfig!: DataTableConfig;

  private readonly baseTableConfig: DataTableConfig = {
    header: {
      title: 'Fee Master',
      subtitle: 'Manage fee heads and their billing rules',
      showAddButton: true,
      addButtonText: 'Add fee',
      addButtonIcon: 'add',
      addButtonClass: 'btn-primary',
    },
    columns: [
      {
        key: 'feeName',
        label: 'Fee name',
        sortable: true,
        cellType: 'text',
      },
      {
        key: 'feeTypeLabel',
        label: 'Fee type',
        sortable: true,
        cellType: 'badge',
        badgeMap: {
          'One Time': { cssClass: 'b-amber', label: 'One Time' },
          Monthly: { cssClass: 'b-green', label: 'Monthly' },
          'Period Wise': { cssClass: 'b-gray', label: 'Period Wise' },
        },
      },
      {
        key: 'publishedOn',
        label: 'Published on',
        sortable: true,
        cellType: 'date',
      },
      {
        key: 'defaultDueDate',
        label: 'Default due date',
        sortable: true,
        cellType: 'date',
      },
      {
        key: 'applicableToLabel',
        label: 'Applicable to',
        sortable: true,
        cellType: 'text',
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
      { label: 'Manage Fee', icon: 'tune', iconColor: '#639922' },
      { label: 'View details', icon: 'visibility', iconColor: '#639922' },
      { label: 'Edit details', icon: 'edit', iconColor: '#1E40AF' },
      { label: 'Show history', icon: 'history', iconColor: '#639922' },
      { label: 'Delete', icon: 'delete', danger: true, separatorBefore: true },
    ],
    actionVisibleFn: (action, row) => this.isFeeActionVisible(action, row),
    searchPlaceholder: 'Search by fee name...',
    searchKeys: ['feeName'],
    itemLabel: 'fees',
    defaultPageSize: 10,
  };

  constructor(
    private snackBar: NotificationService,
    private feeMasterService: FeeMasterService,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    this.tableConfig = this.buildTableConfig();
    this.applyManageQueryParams();
    this.loadFees();
  }

  private applyManageQueryParams(): void {
    const manageId = this.route.snapshot.queryParamMap.get('manageId');
    const tabRaw = this.route.snapshot.queryParamMap.get('tab');
    if (manageId && this.permissionService.canView(MenuCodes.FeeMaster)) {
      this.selectedFeeId = manageId;
      this.manageInitialTab = Math.max(0, Number(tabRaw ?? 0) || 0);
      this.showAddForm = false;
      this.showManage = true;
    }
  }

  loadFees(
    pageIndex = 1,
    pageSize = 10,
    searchQuery = '',
    sortColumn: string | null = null,
    sortDirection: string | null = null,
    filter: string = this.currentFilter,
  ): void {
    this.feeMasterService
      .getFees(pageIndex, pageSize, searchQuery, sortColumn, sortDirection, filter)
      .subscribe({
        next: (res: any) => {
          const items = (res?.items || []) as Record<string, unknown>[];
          this.fees = items.map((row) => this.mapRow(row));
          this.totalFees = res?.totalCount || 0;
          this.cdr.detectChanges();
        },
        error: () => {
          this.fees = [];
          this.totalFees = 0;
          this.snackBar.open('Failed to load fees', 'Close', {
            duration: 3000,
            panelClass: 'snack-error',
          });
          this.cdr.detectChanges();
        },
      });
  }

  onAddButtonClicked(): void {
    if (!this.permissionService.canAdd(MenuCodes.FeeMaster)) return;
    this.formMode = 'add';
    this.selectedFeeId = undefined;
    this.showManage = false;
    this.showAddForm = true;
  }

  closeAddForm(): void {
    this.showAddForm = false;
  }

  closeManage(): void {
    this.showManage = false;
    this.selectedFeeId = undefined;
    this.manageInitialTab = 0;
    void this.router.navigate(['/fees/master'], { queryParams: {}, replaceUrl: true });
  }

  onFeeSaved(): void {
    this.showAddForm = false;
    this.loadFees();
  }

  onPageChange(event: any): void {
    this.loadFees(
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

    if (event.action.label === 'Manage Fee') {
      if (!this.permissionService.canView(MenuCodes.FeeMaster)) return;
      this.selectedFeeId = id;
      this.manageInitialTab = 0;
      this.showAddForm = false;
      this.showManage = true;
      void this.router.navigate(['/fees/master'], {
        queryParams: { manageId: id, tab: 0 },
        replaceUrl: true,
      });
    } else if (event.action.label === 'View details') {
      if (!this.permissionService.canView(MenuCodes.FeeMaster)) return;
      this.selectedFeeId = id;
      this.manageInitialTab = 0;
      this.showAddForm = false;
      this.showManage = true;
      void this.router.navigate(['/fees/master'], {
        queryParams: { manageId: id, tab: 0 },
        replaceUrl: true,
      });
    } else if (event.action.label === 'Edit details') {
      if (!this.permissionService.canEdit(MenuCodes.FeeMaster)) return;
      this.selectedFeeId = id;
      this.manageInitialTab = 0;
      this.showAddForm = false;
      this.showManage = true;
      void this.router.navigate(['/fees/master'], {
        queryParams: { manageId: id, tab: 0 },
        replaceUrl: true,
      });
    } else if (event.action.label === 'Show history') {
      if (!this.permissionService.canView(MenuCodes.FeeMaster)) return;
      void this.router.navigate(['/fees/master', id, 'history']);
    } else if (event.action.label === 'Delete') {
      if (!this.permissionService.canDelete(MenuCodes.FeeMaster)) return;
      this.confirmDelete(id, String(event.row['feeName'] ?? 'this fee'));
    }
  }

  private confirmDelete(id: string, name: string): void {
    const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Delete fee',
        description: `Delete "${name}"? This cannot be undone if the fee is not in use.`,
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.feeMasterService.deleteFee(id).subscribe({
        next: () => {
          this.snackBar.open('Fee deleted', 'Close', {
            duration: 3000,
            panelClass: 'snack-success',
          });
          this.loadFees();
        },
        error: () => {
          this.snackBar.open('Failed to delete fee', 'Close', {
            duration: 3000,
            panelClass: 'snack-error',
          });
        },
      });
    });
  }

  private mapRow(row: Record<string, unknown>): Record<string, unknown> {
    const feeType = String(row['feeType'] ?? '');
    const applicableTo = String(row['applicableTo'] ?? '');
    const feeTypeLabel =
      FEE_TYPE_LABELS[feeType as FeeType] ??
      (feeType ? feeType.replace(/([a-z])([A-Z])/g, '$1 $2') : '—');
    const applicableToLabel =
      FEE_APPLICABLE_TO_LABELS[applicableTo as FeeApplicableTo] ??
      (applicableTo ? applicableTo.replace(/([a-z])([A-Z])/g, '$1 $2') : '—');
    return {
      ...row,
      feeTypeLabel,
      applicableToLabel,
    };
  }

  private isFeeActionVisible(action: DataTableAction, row: Record<string, unknown>): boolean {
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
      MenuCodes.FeeMaster,
    );
  }
}
