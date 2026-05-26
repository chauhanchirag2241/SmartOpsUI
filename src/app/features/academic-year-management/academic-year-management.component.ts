import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';

import { AddAcademicYearComponent } from './add-academic-year/add-academic-year.component';
import { AcademicYearService } from '../../core/services/academic-year.service';
import { SmartDataTableComponent } from '../../shared/components/smart-data-table/smart-data-table.component';
import { DeleteConfirmDialogComponent } from '../../shared/components/delete-confirm-dialog/delete-confirm-dialog.component';
import type {
  DataTableAction,
  DataTableBulkAction,
  DataTableConfig,
  DataTableFilter,
} from '../../shared/components/smart-data-table';
import { MenuCodes } from '../../core/constants/menu-codes';
import { PermissionService } from '../../core/services/permission.service';
import { applyModuleTablePermissions } from '../../core/utils/permission-ui.util';

@Component({
  selector: 'app-academic-year-management',
  standalone: true,
  imports: [SmartDataTableComponent, AddAcademicYearComponent],
  templateUrl: './academic-year-management.component.html',
  styleUrl: './academic-year-management.component.css',
})
export class AcademicYearManagementComponent implements OnInit {
  private readonly ayService = inject(AcademicYearService);
  private readonly permissionService = inject(PermissionService);

  constructor(
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog
  ) {}

  showAddForm = false;
  formMode: 'add' | 'edit' | 'view' = 'add';
  selectedYearId?: string;
  totalYears = 0;
  currentFilter = 'Active';

  academicYears: Record<string, unknown>[] = [];

  ngOnInit(): void {
    this.ayConfig = applyModuleTablePermissions(
      this.baseAyConfig,
      this.permissionService,
      MenuCodes.AcademicYears,
    );
    this.loadAcademicYears();
  }

  loadAcademicYears(
    pageIndex = 1,
    pageSize = 10,
    searchQuery = '',
    sortColumn: string | null = null,
    sortDirection: string | null = null,
    filter = this.currentFilter
  ): void {
    this.ayService.getAcademicYears(pageIndex, pageSize, searchQuery, sortColumn, sortDirection, filter).subscribe({
      next: (res: any) => {
        this.academicYears = res?.items || [];
        this.totalYears = res?.totalCount || 0;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error loading academic years:', err);
        this.snackBar.open('Failed to load academic years', 'Close', { duration: 3000, panelClass: 'snack-error' });
      }
    });
  }

  openAddForm(): void {
    if (!this.permissionService.canAdd(MenuCodes.AcademicYears)) return;
    this.formMode = 'add';
    this.selectedYearId = undefined;
    this.showAddForm = true;
  }

  closeAddForm(): void {
    this.showAddForm = false;
  }

  onYearSaved(): void {
    this.showAddForm = false;
    this.loadAcademicYears();
  }

  onPageChange(event: {
    pageIndex: number;
    pageSize: number;
    searchQuery: string;
    sortColumn: string | null;
    sortDirection: string | null;
    currentFilter: string | null;
  }): void {
    const filterValue = event.currentFilter ?? this.currentFilter;
    this.loadAcademicYears(event.pageIndex, event.pageSize, event.searchQuery, event.sortColumn, event.sortDirection, filterValue);
  }

  onFilterChanged(filter: DataTableFilter | null): void {
    if (filter) {
      this.currentFilter = String(filter.value);
    } else {
      this.currentFilter = 'All';
    }
  }

  ayConfig!: DataTableConfig;

  private readonly baseAyConfig: DataTableConfig = {
    header: {
      title: 'Academic Years',
      subtitle: 'Manage school academic cycles and durations',
      showAddButton: true,
      addButtonText: 'Add Year',
      addButtonIcon: 'add',
      addButtonClass: 'btn-primary'
    },
    columns: [
      { key: 'title', label: 'Year Title', sortable: true },
      { key: 'startDate', label: 'Start Date', sortable: true, cellType: 'date' },
      { key: 'endDate', label: 'End Date', sortable: true, cellType: 'date' },
      { key: 'status', label: 'Status', cellType: 'badge', badgeMap: { Active: { cssClass: 'b-green', label: 'Active' }, Inactive: { cssClass: 'b-red', label: 'Inactive' } } },
    ],
    filtersInPanel: true,
    filters: [
      { label: 'All', icon: 'list', value: 'All' },
      { label: 'Active', icon: 'check_circle', value: 'Active' },
      { label: 'Inactive', icon: 'cancel', value: 'Inactive' },
    ],
    actions: [
      { label: 'View details', icon: 'visibility', iconColor: '#639922', permission: 'academicyear.read' },
      { label: 'Edit year', icon: 'edit', iconColor: '#1E40AF', permission: 'admin.full' },
      {
        label: 'Delete year',
        icon: 'delete',
        danger: true,
        separatorBefore: true,
        permission: 'admin.full',
      },
    ],
    bulkActions: [
      { label: 'Export', icon: 'download', permission: 'academicyear.read' },
      { label: 'Delete', icon: 'delete', danger: true, permission: 'admin.full' },
    ],
    searchPlaceholder: 'Search by title...',
    searchKeys: ['title'],
    itemLabel: 'academic years',
    defaultPageSize: 10,
    pageSizeOptions: [10, 25, 50, 100],
  };

  ayRowClass = (row: Record<string, unknown>): string => {
    return row['isActive'] === false ? 'row-inactive' : '';
  };

  onActionClicked(event: {
    action: DataTableAction;
    row: Record<string, unknown>;
    rowIndex: number;
  }): void {
    const id = event.row['id'] as string;

    if (event.action.label === 'View details') {
      if (!this.permissionService.canView(MenuCodes.AcademicYears)) return;
      this.formMode = 'view';
      this.selectedYearId = id;
      this.showAddForm = true;
    } else if (event.action.label === 'Edit year') {
      if (!this.permissionService.canEdit(MenuCodes.AcademicYears)) return;
      this.formMode = 'edit';
      this.selectedYearId = id;
      this.showAddForm = true;
    } else if (event.action.label === 'Delete year') {
      if (!this.permissionService.canDelete(MenuCodes.AcademicYears)) return;
      const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
        data: {
          title: 'Delete academic year?',
          description: 'This will permanently remove the academic year record.',
          recordName: `${event.row['title']}`,
          recordMeta: `${event.row['startDate']} to ${event.row['endDate']}`,
          initials: 'AY',
          warningMessage: 'This action cannot be undone.'
        },
        panelClass: 'erp-dialog',
        disableClose: true
      });

      dialogRef.afterClosed().subscribe((confirmed: any) => {
        if (confirmed) {
          this.ayService.deleteAcademicYear(id).subscribe({
            next: () => {
              this.snackBar.open('Academic year deleted successfully', 'Close', { duration: 3000, panelClass: 'snack-success' });
              this.loadAcademicYears();
            },
            error: () => this.snackBar.open('Failed to delete academic year', 'Close', { duration: 3000, panelClass: 'snack-error' })
          });
        }
      });
    }
  }

  onExportClicked(): void {
    this.snackBar.open('Exporting academic years...', 'Close', {
      duration: 3000,
      panelClass: 'snack-success',
    });
  }

  onAddButtonClicked(): void {
    this.openAddForm();
  }

  onBulkActionClicked(event: {
    action: DataTableBulkAction;
    selectedRows: Record<string, unknown>[];
  }): void {
    this.snackBar.open(`${event.action.label} → ${event.selectedRows.length} year(s)`, 'Close', { duration: 3000, panelClass: 'snack-info' });
  }
}
