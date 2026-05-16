import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';
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
import { AuthService } from '../../core/services/auth.service';
import { MODULE_PERMISSIONS } from '../../core/config/permission-ui.config';
import { applyModuleTablePermissions } from '../../core/utils/permission-ui.util';

@Component({
  selector: 'app-class-management',
  standalone: true,
  imports: [SmartDataTableComponent, AddClassComponent],
  templateUrl: './class-management.component.html',
  styleUrl: './class-management.component.css',
})
export class ClassManagementComponent implements OnInit {
  private readonly classService = inject(ClassService);
  private readonly auth = inject(AuthService);
  private readonly perms = MODULE_PERMISSIONS.classes;

  constructor(
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog
  ) {}

  showAddForm = false;
  formMode: 'add' | 'edit' | 'view' = 'add';
  selectedClassId?: string;
  totalClasses = 0;
  currentFilter = 'Active';

  classes: Record<string, unknown>[] = [];

  ngOnInit(): void {
    this.classConfig = applyModuleTablePermissions(this.baseClassConfig, this.auth, 'classes');
    this.loadClasses();
  }

  loadClasses(
    pageIndex = 1,
    pageSize = 10,
    searchQuery = '',
    sortColumn: string | null = null,
    sortDirection: string | null = null,
    filter = this.currentFilter
  ): void {
    this.classService.getClasses(pageIndex, pageSize, searchQuery, sortColumn, sortDirection, filter).subscribe({
      next: (res: any) => {
        this.classes = res?.items || [];
        this.totalClasses = res?.totalCount || 0;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error loading classes:', err);
        this.snackBar.open('Failed to load classes', 'Close', { duration: 3000, panelClass: 'snack-error' });
      }
    });
  }

  openAddForm(): void {
    if (!this.auth.hasPermission(this.perms.create!)) return;
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
    this.loadClasses(event.pageIndex, event.pageSize, event.searchQuery, event.sortColumn, event.sortDirection, filterValue);
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
      addButtonClass: 'btn-primary'
    },
    columns: [
      { key: 'className', label: 'Class', sortable: true },
      { key: 'section', label: 'Section', sortable: true },
      { key: 'streamGroup', label: 'Stream / Group', sortable: true },
      { key: 'academicYear', label: 'Academic year', sortable: true },
      { key: 'capacity', label: 'Capacity', sortable: true },
      { key: 'classTeacher', label: 'Class teacher', sortable: true },
      { key: 'roomNumber', label: 'Room', sortable: true },
      { key: 'status', label: 'Status', cellType: 'badge', badgeMap: { Active: { cssClass: 'b-green', label: 'Active' }, Inactive: { cssClass: 'b-red', label: 'Inactive' } } },
    ],
    filters: [
      { label: 'All', icon: 'list', value: 'All' },
      { label: 'Active', icon: 'check_circle', value: 'Active' },
      { label: 'Inactive', icon: 'cancel', value: 'Inactive' },
    ],
    actions: [
      { label: 'View details', icon: 'visibility', iconColor: '#639922', permission: 'class.read' },
      { label: 'Edit class', icon: 'edit', iconColor: '#1E40AF', permission: 'admin.full' },
      {
        label: 'Delete class',
        icon: 'delete',
        danger: true,
        separatorBefore: true,
        permission: 'admin.full',
      },
    ],
    bulkActions: [
      { label: 'Export', icon: 'download', permission: 'class.read' },
      { label: 'Delete', icon: 'delete', danger: true, permission: 'admin.full' },
    ],
    searchPlaceholder: 'Search by class, section, teacher...',
    searchKeys: ['className', 'section', 'streamGroup', 'classTeacher', 'roomNumber'],
    itemLabel: 'classes',
    defaultPageSize: 10,
    pageSizeOptions: [10, 25, 50, 100],
  };

  classRowClass = (row: Record<string, unknown>): string => {
    return row['isActive'] === false ? 'row-inactive' : '';
  };

  onActionClicked(event: {
    action: DataTableAction;
    row: Record<string, unknown>;
    rowIndex: number;
  }): void {
    const id = event.row['id'] as string;

    if (event.action.label === 'View details') {
      if (!this.auth.hasPermission(this.perms.read)) return;
      this.formMode = 'view';
      this.selectedClassId = id;
      this.showAddForm = true;
    } else if (event.action.label === 'Edit class') {
      if (!this.auth.hasPermission(this.perms.update!)) return;
      this.formMode = 'edit';
      this.selectedClassId = id;
      this.showAddForm = true;
    } else if (event.action.label === 'Delete class') {
      if (!this.auth.hasPermission(this.perms.delete!)) return;
      const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
        data: {
          title: 'Delete class?',
          description: 'This will permanently remove the class section and any linked scheduling data.',
          recordName: `${event.row['className']} - ${event.row['section']}`,
          recordMeta: `${event.row['academicYear']} · ${event.row['classTeacher'] || 'No teacher assigned'}`,
          initials: `${String(event.row['className']).charAt(0)}${String(event.row['section']).charAt(0)}`,
          warningMessage: 'This action cannot be undone.'
        },
        panelClass: 'erp-dialog',
        disableClose: true
      });

      dialogRef.afterClosed().subscribe((confirmed: any) => {
        if (confirmed) {
          this.classService.deleteClass(id).subscribe({
            next: () => {
              this.snackBar.open('Class deleted successfully', 'Close', { duration: 3000, panelClass: 'snack-success' });
              this.loadClasses();
            },
            error: () => this.snackBar.open('Failed to delete class', 'Close', { duration: 3000, panelClass: 'snack-error' })
          });
        }
      });
    } else {
      this.snackBar.open(`${event.action.label} → ${event.row['className']}`, 'Close', { duration: 3000, panelClass: 'snack-info' });
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
          warningMessage: 'This will permanently remove all selected class records.'
        },
        panelClass: 'erp-dialog',
        disableClose: true
      });

      dialogRef.afterClosed().subscribe((confirmed: any) => {
        if (confirmed) {
          this.snackBar.open(`Bulk delete for ${event.selectedRows.length} classes initiated`, 'Close', { duration: 3000, panelClass: 'snack-success' });
        }
      });
    } else {
      this.snackBar.open(`${event.action.label} → ${event.selectedRows.length} class(es)`, 'Close', { duration: 3000, panelClass: 'snack-info' });
    }
  }
}
