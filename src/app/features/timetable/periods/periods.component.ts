import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NotificationService } from '../../../core/services/notification.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { AddPeriodComponent } from './add-period/add-period.component';
import { PeriodService } from '../../../core/services/period.service';
import { SmartDataTableComponent } from '../../../shared/components/smart-data-table';
import { DeleteConfirmDialogComponent } from '../../../shared/components/delete-confirm-dialog/delete-confirm-dialog.component';

import type {
  DataTableAction,
  DataTableConfig,
  DataTableFilter,
} from '../../../shared/components/smart-data-table';
import { MenuCodes } from '../../../core/constants/menu-codes';
import { PermissionService } from '../../../core/services/permission.service';
import { AcademicYearContextService } from '../../../core/services/academic-year-context.service';
import { applyModuleTablePermissions } from '../../../core/utils/permission-ui.util';

@Component({
  selector: 'app-periods',
  standalone: true,
  imports: [
    CommonModule,
    SmartDataTableComponent,
    MatIconModule,
    MatSnackBarModule,
    MatDialogModule,
    AddPeriodComponent,
  ],
  templateUrl: './periods.component.html',
  styleUrl: './periods.component.css',
})
export class PeriodsComponent implements OnInit {
  private readonly permissionService = inject(PermissionService);
  private readonly ayContext = inject(AcademicYearContextService);
  private readonly router = inject(Router);

  showAddForm = false;
  formMode: 'add' | 'edit' | 'view' = 'add';
  selectedPeriodId?: string;
  totalPeriods = 0;
  currentFilter = 'All';
  periods: Record<string, unknown>[] = [];
  tableConfig!: DataTableConfig;

  private readonly baseTableConfig: DataTableConfig = {
    header: {
      title: 'Period Master',
      subtitle: 'Define teaching periods and breaks for the school day',
      showAddButton: true,
      addButtonText: 'Add period',
      addButtonIcon: 'add',
      addButtonClass: 'btn-primary',
    },
    columns: [
      { key: 'periodOrder', label: 'Order', sortable: true },
      { key: 'name', label: 'Period', sortable: true },
      { key: 'shortName', label: 'Short', sortable: true },
      { key: 'timeLabel', label: 'Time' },
      {
        key: 'isBreak',
        label: 'Type',
        cellType: 'badge',
        badgeMap: {
          true: { cssClass: 'b-amber', label: 'Break' },
          false: { cssClass: 'b-blue', label: 'Teaching' },
        },
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
      { label: 'Teaching', icon: 'school', value: 'Teaching' },
      { label: 'Break', icon: 'coffee', value: 'Break' },
    ],
    actions: [
      { label: 'View details', icon: 'visibility', iconColor: '#639922' },
      { label: 'Edit details', icon: 'edit', iconColor: '#1E40AF' },
      { label: 'Show history', icon: 'history', iconColor: '#639922' },
      { label: 'Delete', icon: 'delete', danger: true, separatorBefore: true },
    ],
    actionVisibleFn: (action, row) => this.isPeriodActionVisible(action, row),
    searchPlaceholder: 'Search by name...',
    searchKeys: ['name', 'shortName'],
    itemLabel: 'periods',
    defaultPageSize: 10,
  };

  constructor(
    private snackBar: NotificationService,
    private periodService: PeriodService,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    this.tableConfig = this.buildTableConfig();
    this.loadPeriods();
  }

  loadPeriods(
    pageIndex = 1,
    pageSize = 10,
    searchQuery = '',
    sortColumn: string | null = null,
    sortDirection: string | null = null,
    filter: string = this.currentFilter,
  ): void {
    this.periodService.getPeriods(pageIndex, pageSize, searchQuery, sortColumn, sortDirection, filter).subscribe({
      next: (res: any) => {
        this.periods = res?.items || [];
        this.totalPeriods = res?.totalCount || 0;
        this.cdr.detectChanges();
      },
      error: () => {
        this.snackBar.open('Failed to load periods', 'Close', { duration: 3000, panelClass: 'snack-error' });
      },
    });
  }

  onAddButtonClicked(): void {
    if (!this.permissionService.canAdd(MenuCodes.PeriodMaster)) return;
    this.formMode = 'add';
    this.selectedPeriodId = undefined;
    this.showAddForm = true;
  }

  closeAddForm(): void {
    this.showAddForm = false;
  }

  onPeriodSaved(): void {
    this.showAddForm = false;
    this.loadPeriods();
  }

  onPageChange(event: any): void {
    this.loadPeriods(
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
      if (!this.permissionService.canView(MenuCodes.PeriodMaster)) return;
      this.formMode = 'view';
      this.selectedPeriodId = id;
      this.showAddForm = true;
    } else if (event.action.label === 'Edit details') {
      if (!this.permissionService.canEdit(MenuCodes.PeriodMaster)) return;
      this.formMode = 'edit';
      this.selectedPeriodId = id;
      this.showAddForm = true;
    } else if (event.action.label === 'Show history') {
      if (!this.permissionService.canView(MenuCodes.PeriodMaster)) return;
      this.router.navigate(['/timetable/periods', id, 'history']);
    } else if (event.action.label === 'Delete') {
      if (!this.permissionService.canDelete(MenuCodes.PeriodMaster)) return;
      const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
        data: {
          title: 'Delete period?',
          description: 'This will remove the period from the master list.',
          recordName: event.row['name'] as string,
          recordMeta: `Order: ${event.row['periodOrder']}`,
          initials: String(event.row['shortName'] || event.row['name'] || 'P').substring(0, 2).toUpperCase(),
          warningMessage: 'Existing timetable slots using this period may be affected.',
        },
        panelClass: 'erp-dialog',
        disableClose: true,
      });

      dialogRef.afterClosed().subscribe((confirmed: any) => {
        if (confirmed) {
          this.periodService.deletePeriod(id).subscribe({
            next: () => {
              this.snackBar.open('Period deleted successfully', 'Close', {
                duration: 3000,
                panelClass: 'snack-success',
              });
              this.loadPeriods();
            },
            error: () =>
              this.snackBar.open('Failed to delete period', 'Close', { duration: 3000, panelClass: 'snack-error' }),
          });
        }
      });
    }
  }

  periodRowClass = (row: Record<string, unknown>): string => {
    return row['isActive'] === false ? 'row-inactive' : '';
  };

  private isPeriodActionVisible(action: DataTableAction, row: Record<string, unknown>): boolean {
    if (row['isActive'] !== false) return true;
    return action.label === 'View details' || action.label === 'Show history';
  }

  private buildTableConfig(): DataTableConfig {
    const permittedConfig = applyModuleTablePermissions(
      this.baseTableConfig,
      this.permissionService,
      MenuCodes.PeriodMaster,
      this.ayContext.isReadOnlyScope(),
    );
    return {
      ...permittedConfig,
      columns: permittedConfig.columns.filter((col) => col.key !== 'isActive'),
    };
  }
}
