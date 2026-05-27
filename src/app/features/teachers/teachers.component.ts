import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NotificationService } from '../../core/services/notification.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { AddTeacherComponent } from './add-teacher/add-teacher.component';
import { TeacherService } from '../../core/services/teacher.service';

import { SmartDataTableComponent } from '../../shared/components/smart-data-table';
import { DeleteConfirmDialogComponent } from '../../shared/components/delete-confirm-dialog/delete-confirm-dialog.component';
import { StaffFilter } from '../../shared/enums/table-filters.enum';
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
  selector: 'app-teachers',
  standalone: true,
  imports: [SmartDataTableComponent, MatIconModule, MatSnackBarModule, MatDialogModule, AddTeacherComponent],
  templateUrl: './teachers.component.html',
  styleUrl: './teachers.component.css',
})
export class TeachersComponent implements OnInit {
  private readonly permissionService = inject(PermissionService);

  constructor(
    private snackBar: NotificationService,
    private teacherService: TeacherService,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog
  ) { }

  showAddForm = false;
  formMode: 'add' | 'edit' | 'view' = 'add';
  selectedTeacherId?: string;
  totalTeachers = 0;
  currentFilter: StaffFilter = StaffFilter.Active;
  teachers: Record<string, unknown>[] = [];

  ngOnInit(): void {
    this.tableConfig = applyModuleTablePermissions(this.baseTableConfig, this.permissionService, MenuCodes.Teachers);
    this.loadTeachers();
  }

  loadTeachers(
    pageIndex = 1,
    pageSize = 10,
    searchQuery = '',
    sortColumn: string | null = null,
    sortDirection: string | null = null,
    filter: StaffFilter = this.currentFilter
  ): void {
    this.teacherService.getTeachers(pageIndex, pageSize, searchQuery, sortColumn, sortDirection, filter).subscribe({
      next: (res: any) => {
        this.teachers = res?.items || [];
        this.totalTeachers = res?.totalCount || 0;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error loading teachers:', err);
        this.teachers = [];
        this.totalTeachers = 0;
        this.cdr.detectChanges();
        this.snackBar.open('Failed to load teachers', 'Close', { duration: 3000, panelClass: 'snack-error' });
      }
    });
  }

  openAddForm(): void {
    if (!this.permissionService.canAdd(MenuCodes.Teachers)) return;
    this.formMode = 'add';
    this.selectedTeacherId = undefined;
    this.showAddForm = true;
  }

  closeAddForm(): void {
    this.showAddForm = false;
  }

  onTeacherSaved(): void {
    this.showAddForm = false;
    this.loadTeachers();
  }

  onPageChange(event: any): void {
    const filterValue = event.currentFilter ? (event.currentFilter as unknown as StaffFilter) : this.currentFilter;
    this.loadTeachers(event.pageIndex, event.pageSize, event.searchQuery, event.sortColumn, event.sortDirection, filterValue);
  }

  onFilterChanged(filter: DataTableFilter | null): void {
    if (filter) {
      this.currentFilter = Number(filter.value) as StaffFilter;
    } else {
      this.currentFilter = StaffFilter.All;
    }
    this.loadTeachers();
  }

  tableConfig!: DataTableConfig;

  private readonly baseTableConfig: DataTableConfig = {
    header: {
      title: 'Teachers',
      subtitle: 'Manage faculty and staff members',
      showAddButton: true,
      addButtonText: 'Add teacher',
      addButtonIcon: 'add',
      addButtonClass: 'btn-primary'
    },
    columns: [
      {
        key: 'teacher',
        label: 'Teacher',
        sortable: true,
        cellType: 'avatar',
        toggleable: false,
        avatarConfig: {
          nameKey: 'name',
          subtitleKey: 'email',
        },
      },
      {
        key: 'designation',
        label: 'Designation',
        sortable: true,
      },
      {
        key: 'isActive',
        label: 'Status',
        cellType: 'badge',
        badgeMap: {
          'true': { cssClass: 'b-green', label: 'Active' },
          'false': { cssClass: 'b-red', label: 'Inactive' },
        },
      },
    ],
    filtersInPanel: true,
    filters: [
      { label: 'All', icon: 'list', value: StaffFilter.All.toString() },
      { label: 'Active', icon: 'check_circle', value: StaffFilter.Active.toString() },
      { label: 'Inactive', icon: 'cancel', value: StaffFilter.Inactive.toString() },
      { label: 'On Leave', icon: 'event_busy', value: StaffFilter.OnLeave.toString() },
    ],
    actions: [
      { label: 'View profile', icon: 'visibility', iconColor: '#639922' },
      { label: 'Edit details', icon: 'edit', iconColor: '#1E40AF' },
      {
        label: 'Delete teacher',
        icon: 'delete',
        danger: true,
        separatorBefore: true,
      },
    ],
    bulkActions: [
      { label: 'Send notice', icon: 'mail' },
      { label: 'Export', icon: 'download' },
      { label: 'Delete', icon: 'delete', danger: true },
    ],
    searchPlaceholder: 'Search by name or email...',
    searchKeys: ['name', 'email', 'designation'],
    itemLabel: 'teachers',
    defaultPageSize: 10,
    pageSizeOptions: [10, 25, 50, 100],
  };

  teacherRowClass = (row: Record<string, unknown>): string => {
    return row['isActive'] === false ? 'row-inactive' : '';
  };

  onActionClicked(event: any): void {
    const id = event.row['id'] as string;
    if (event.action.label === 'View profile') {
      if (!this.permissionService.canView(MenuCodes.Teachers)) return;
      this.formMode = 'view';
      this.selectedTeacherId = id;
      this.showAddForm = true;
    } else if (event.action.label === 'Edit details') {
      if (!this.permissionService.canEdit(MenuCodes.Teachers)) return;
      this.formMode = 'edit';
      this.selectedTeacherId = id;
      this.showAddForm = true;
    } else if (event.action.label === 'Delete teacher') {
      if (!this.permissionService.canDelete(MenuCodes.Teachers)) return;
      const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
        data: {
          title: 'Delete teacher?',
          description: 'This will permanently remove the teacher and all associated records.',
          recordName: event.row['name'] as string,
          recordMeta: `${event.row['email']} · ${event.row['dept']}`,
          initials: this.getInitials(event.row['name'] as string),
          warningMessage: 'This action cannot be undone.'
        },
        panelClass: 'erp-dialog',
        disableClose: true
      });

      dialogRef.afterClosed().subscribe((confirmed: any) => {
        if (confirmed) {
          this.teacherService.deleteTeacher(id).subscribe({
            next: () => {
              this.snackBar.open('Teacher deleted successfully', 'Close', { duration: 3000, panelClass: 'snack-success' });
              this.loadTeachers();
            },
            error: () => this.snackBar.open('Failed to delete teacher', 'Close', { duration: 3000, panelClass: 'snack-error' })
          });
        }
      });
    }
  }

  onAddButtonClicked(): void {
    this.openAddForm();
  }

  onBulkActionClicked(event: any): void {
    // Implement bulk actions
  }

  private getInitials(name: string): string {
    if (!name) return 'NA';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length > 1) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
  }
}
