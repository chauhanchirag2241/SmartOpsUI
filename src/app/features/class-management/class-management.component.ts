import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../core/services/notification.service';
import { MatDialog } from '@angular/material/dialog';

import { AddClassComponent } from './add-class/add-class.component';
import { ClassService } from '../../core/services/class.service';
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
import { naturalTextCompare } from '../../shared/utils/natural-sort.util';
import { formatStreamGroupDisplay } from '../../shared/utils/stream-group.util';

@Component({
  selector: 'app-class-management',
  standalone: true,
  imports: [SmartDataTableComponent, AddClassComponent],
  templateUrl: './class-management.component.html',
  styleUrl: './class-management.component.css',
})
export class ClassManagementComponent implements OnInit {
  private readonly classService = inject(ClassService);
  private readonly permissionService = inject(PermissionService);
  private readonly router = inject(Router);

  constructor(
    private snackBar: NotificationService,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog,
  ) {}

  showAddForm = false;
  formMode: 'add' | 'edit' | 'view' = 'add';
  selectedClassId?: string;
  totalClasses = 0;
  currentFilter = 'Active';

  classes: Record<string, unknown>[] = [];
  private allClasses: Record<string, unknown>[] = [];

  ngOnInit(): void {
    this.classConfig = this.buildClassConfig();
    this.loadClasses();
  }

  loadClasses(
    pageIndex = 1,
    pageSize = 10,
    searchQuery = '',
    sortColumn: string | null = null,
    sortDirection: string | null = null,
    filter = this.currentFilter,
  ): void {
    this.classService
      .getClasses(1, 1000, searchQuery, sortColumn, sortDirection, filter)
      .subscribe({
        next: (res: any) => {
          const rawItems = (res?.items || []) as Record<string, unknown>[];
          this.allClasses = rawItems.map((row) => ({
            ...row,
            capacity: Number(row['capacity']) === 0 ? null : row['capacity'],
            streamGroup: formatStreamGroupDisplay(row['streamGroup']),
          }));
          const sorted = this.applyClassSorting(this.allClasses, sortColumn, sortDirection);
          this.totalClasses = sorted.length;
          const start = Math.max(0, (pageIndex - 1) * pageSize);
          this.classes = sorted.slice(start, start + pageSize);
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          console.error('Error loading classes:', err);
          this.snackBar.open('Failed to load classes', 'Close', {
            duration: 3000,
            panelClass: 'snack-error',
          });
        },
      });
  }

  private applyClassSorting(
    rows: Record<string, unknown>[],
    sortColumn: string | null,
    sortDirection: string | null,
  ): Record<string, unknown>[] {
    const dir = sortDirection === 'desc' ? -1 : 1;
    const sorted = [...rows];
    if (!sortColumn) {
      return sorted;
    }

    sorted.sort((a, b) => {
      if (sortColumn === 'className') {
        const classCmp = naturalTextCompare(a['className'], b['className']);
        if (classCmp !== 0) return classCmp * dir;
        return naturalTextCompare(a['section'], b['section']) * dir;
      }
      if (sortColumn === 'section') {
        const secCmp = naturalTextCompare(a['section'], b['section']);
        if (secCmp !== 0) return secCmp * dir;
        return naturalTextCompare(a['className'], b['className']) * dir;
      }

      const av = a[sortColumn];
      const bv = b[sortColumn];
      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * dir;
      }
      return naturalTextCompare(av, bv) * dir;
    });

    return sorted;
  }

  openAddForm(): void {
    if (!this.permissionService.canAdd(MenuCodes.Classes)) return;
    this.formMode = 'add';
    this.selectedClassId = undefined;
    this.showAddForm = true;
  }

  closeAddForm(): void {
    this.showAddForm = false;
  }

  onClassSaved(): void {
    this.showAddForm = false;
    this.loadClasses();
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
    this.loadClasses(
      event.pageIndex,
      event.pageSize,
      event.searchQuery,
      event.sortColumn,
      event.sortDirection,
      filterValue,
    );
  }

  onFilterChanged(filter: DataTableFilter | null): void {
    if (filter) {
      this.currentFilter = String(filter.value);
    } else {
      this.currentFilter = 'All';
    }
  }

  classConfig!: DataTableConfig;

  private readonly baseClassConfig: DataTableConfig = {
    header: {
      title: 'Classes',
      subtitle: 'Add and manage academic classes and sections',
      showAddButton: true,
      addButtonText: 'Add class',
      addButtonIcon: 'add',
      addButtonClass: 'btn-primary',
    },
    columns: [
      { key: 'className', label: 'Class', sortable: true },
      { key: 'section', label: 'Section', sortable: true },
      { key: 'streamGroup', label: 'Stream / Group', sortable: true },
      { key: 'academicYear', label: 'Academic year', sortable: true },
      { key: 'capacity', label: 'Capacity', sortable: true },
      { key: 'roomNumber', label: 'Room', sortable: true },
      {
        key: 'status',
        label: 'Status',
        cellType: 'badge',
        badgeMap: {
          Active: { cssClass: 'b-green', label: 'Active' },
          Inactive: { cssClass: 'b-red', label: 'Inactive' },
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
      {
        label: 'Delete class',
        icon: 'delete',
        danger: true,
        separatorBefore: true,
      },
    ],
    actionVisibleFn: (action, row) => this.isClassActionVisible(action, row),
    bulkActions: [
      { label: 'Export', icon: 'download' },
      { label: 'Delete', icon: 'delete', danger: true },
    ],
    searchPlaceholder: 'Search by class, section, teacher...',
    searchKeys: ['className', 'section', 'streamGroup', 'roomNumber'],
    itemLabel: 'classes',
    defaultPageSize: 10,
    pageSizeOptions: [10, 25, 50, 100],
  };

  classRowClass = (row: Record<string, unknown>): string => {
    return row['isActive'] === false ? 'row-inactive' : '';
  };

  private isClassActionVisible(action: DataTableAction, row: Record<string, unknown>): boolean {
    if (row['isActive'] !== false) {
      return true;
    }

    return action.label === 'View details' || action.label === 'Show history';
  }

  private buildClassConfig(): DataTableConfig {
    const permittedConfig = applyModuleTablePermissions(
      this.baseClassConfig,
      this.permissionService,
      MenuCodes.Classes,
    );
    return {
      ...permittedConfig,
      columns: permittedConfig.columns.filter((col) => col.key !== 'status'),
    };
  }

  onActionClicked(event: {
    action: DataTableAction;
    row: Record<string, unknown>;
    rowIndex: number;
  }): void {
    const id = event.row['id'] as string;

    if (event.action.label === 'View details') {
      if (!this.permissionService.canView(MenuCodes.Classes)) return;
      this.formMode = 'view';
      this.selectedClassId = id;
      this.showAddForm = true;
    } else if (event.action.label === 'Edit details') {
      if (!this.permissionService.canEdit(MenuCodes.Classes)) return;
      this.formMode = 'edit';
      this.selectedClassId = id;
      this.showAddForm = true;
    } else if (event.action.label === 'Show history') {
      if (!this.permissionService.canView(MenuCodes.Classes)) return;
      this.router.navigate(['/classes', id, 'history']);
    } else if (event.action.label === 'Delete class') {
      if (!this.permissionService.canDelete(MenuCodes.Classes)) return;
      const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
        data: {
          title: 'Delete class?',
          description:
            'This will permanently remove the class section and any linked scheduling data.',
          recordName: `${event.row['className']} - ${event.row['section']}`,
          recordMeta: `${event.row['academicYear']} · ${event.row['classTeacher'] || 'No teacher assigned'}`,
          initials: `${String(event.row['className']).charAt(0)}${String(event.row['section']).charAt(0)}`,
          warningMessage: 'This action cannot be undone.',
        },
        panelClass: 'erp-dialog',
        disableClose: true,
      });

      dialogRef.afterClosed().subscribe((confirmed: any) => {
        if (confirmed) {
          this.classService.deleteClass(id).subscribe({
            next: () => {
              this.snackBar.open('Class deleted successfully', 'Close', {
                duration: 3000,
                panelClass: 'snack-success',
              });
              this.loadClasses();
            },
            error: () =>
              this.snackBar.open('Failed to delete class', 'Close', {
                duration: 3000,
                panelClass: 'snack-error',
              }),
          });
        }
      });
    } else {
      this.snackBar.open(`${event.action.label} → ${event.row['className']}`, 'Close', {
        duration: 3000,
        panelClass: 'snack-info',
      });
    }
  }

  onExportClicked(): void {
    this.snackBar.open('Exporting class data...', 'Close', {
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
    if (event.action.label === 'Delete') {
      const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
        data: {
          title: 'Delete selected classes?',
          description: `You are about to delete ${event.selectedRows.length} classes. This action is permanent.`,
          recordName: `${event.selectedRows.length} Classes Selected`,
          recordMeta: 'Bulk Deletion',
          initials: 'BD',
          warningMessage: 'This will permanently remove all selected class records.',
        },
        panelClass: 'erp-dialog',
        disableClose: true,
      });

      dialogRef.afterClosed().subscribe((confirmed: any) => {
        if (confirmed) {
          this.snackBar.open(
            `Bulk delete for ${event.selectedRows.length} classes initiated`,
            'Close',
            { duration: 3000, panelClass: 'snack-success' },
          );
        }
      });
    } else {
      this.snackBar.open(
        `${event.action.label} → ${event.selectedRows.length} class(es)`,
        'Close',
        { duration: 3000, panelClass: 'snack-info' },
      );
    }
  }
}
