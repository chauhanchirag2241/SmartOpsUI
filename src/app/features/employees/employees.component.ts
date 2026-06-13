import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NotificationService } from '../../core/services/notification.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { AddEmployeeComponent } from './add-employee/add-employee.component';
import { EmployeeService } from '../../core/services/employee.service';

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
import { AcademicYearContextService } from '../../core/services/academic-year-context.service';
import { applyModuleTablePermissions } from '../../core/utils/permission-ui.util';

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [SmartDataTableComponent, MatIconModule, MatSnackBarModule, MatDialogModule, AddEmployeeComponent],
  templateUrl: './employees.component.html',
  styleUrl: './employees.component.css',
})
export class EmployeesComponent implements OnInit {
  private readonly permissionService = inject(PermissionService);
  private readonly ayContext = inject(AcademicYearContextService);
  private readonly router = inject(Router);

  constructor(
    private snackBar: NotificationService,
    private employeeService: EmployeeService,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog,
  ) {}

  showAddForm = false;
  formMode: 'add' | 'edit' | 'view' = 'add';
  selectedEmployeeId?: string;
  totalEmployees = 0;
  currentFilter: StaffFilter = StaffFilter.Active;
  employees: Record<string, unknown>[] = [];

  ngOnInit(): void {
    this.tableConfig = this.buildTableConfig();
    this.loadEmployees();
  }

  loadEmployees(
    pageIndex = 1,
    pageSize = 10,
    searchQuery = '',
    sortColumn: string | null = null,
    sortDirection: string | null = null,
    filter: StaffFilter = this.currentFilter,
  ): void {
    this.employeeService
      .getEmployees(pageIndex, pageSize, searchQuery, sortColumn, sortDirection, filter)
      .subscribe({
        next: (res: any) => {
          this.employees = res?.items || [];
          this.totalEmployees = res?.totalCount || 0;
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          console.error('Error loading employees:', err);
          this.employees = [];
          this.totalEmployees = 0;
          this.cdr.detectChanges();
          this.snackBar.open('Failed to load employees', 'Close', {
            duration: 3000,
            panelClass: 'snack-error',
          });
        },
      });
  }

  openAddForm(): void {
    if (!this.permissionService.canAdd(MenuCodes.Employees)) return;
    this.formMode = 'add';
    this.selectedEmployeeId = undefined;
    this.showAddForm = true;
  }

  closeAddForm(): void {
    this.showAddForm = false;
  }

  onEmployeeSaved(): void {
    this.showAddForm = false;
    this.loadEmployees();
  }

  onPageChange(event: any): void {
    const filterValue = event.currentFilter ? (event.currentFilter as unknown as StaffFilter) : this.currentFilter;
    this.loadEmployees(
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
      this.currentFilter = Number(filter.value) as StaffFilter;
    } else {
      this.currentFilter = StaffFilter.All;
    }
    this.loadEmployees();
  }

  tableConfig!: DataTableConfig;

  private readonly baseTableConfig: DataTableConfig = {
    header: {
      title: 'Employees',
      subtitle: 'Manage faculty and staff members',
      showAddButton: true,
      addButtonText: 'Add employee',
      addButtonIcon: 'add',
      addButtonClass: 'btn-primary',
    },
    columns: [
      {
        key: 'employee',
        label: 'Name',
        sortable: true,
        cellType: 'avatar',
        toggleable: false,
        avatarConfig: {
          nameKey: 'name',
          subtitleKey: 'email',
        },
      },
      {
        key: 'employeeType',
        label: 'Employee type',
        sortable: true,
      },
      {
        key: 'department',
        label: 'Department',
        sortable: true,
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
          true: { cssClass: 'b-green', label: 'Active' },
          false: { cssClass: 'b-red', label: 'Inactive' },
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
      { label: 'Show history', icon: 'history', iconColor: '#639922' },
      {
        label: 'Delete employee',
        icon: 'delete',
        danger: true,
        separatorBefore: true,
      },
    ],
    actionVisibleFn: (action, row) => this.isEmployeeActionVisible(action, row),
    bulkActions: [
      { label: 'Send notice', icon: 'mail' },
      { label: 'Export', icon: 'download' },
      { label: 'Delete', icon: 'delete', danger: true },
    ],
    searchPlaceholder: 'Search by name or email...',
    searchKeys: ['name', 'email', 'designation', 'department', 'employeeType'],
    itemLabel: 'employees',
    defaultPageSize: 10,
    pageSizeOptions: [10, 25, 50, 100],
  };

  employeeRowClass = (row: Record<string, unknown>): string => {
    return row['isActive'] === false ? 'row-inactive' : '';
  };

  private isEmployeeActionVisible(action: DataTableAction, row: Record<string, unknown>): boolean {
    if (row['isActive'] !== false) {
      return true;
    }
    return action.label === 'View profile' || action.label === 'Show history';
  }

  private buildTableConfig(): DataTableConfig {
    const permittedConfig = applyModuleTablePermissions(
      this.baseTableConfig,
      this.permissionService,
      MenuCodes.Employees,
      this.ayContext.isReadOnlyScope(),
    );
    return {
      ...permittedConfig,
      columns: permittedConfig.columns.filter((col) => col.key !== 'isActive'),
    };
  }

  onActionClicked(event: any): void {
    const id = event.row['id'] as string;
    if (event.action.label === 'View profile') {
      if (!this.permissionService.canView(MenuCodes.Employees)) return;
      this.formMode = 'view';
      this.selectedEmployeeId = id;
      this.showAddForm = true;
    } else if (event.action.label === 'Edit details') {
      if (!this.permissionService.canEdit(MenuCodes.Employees)) return;
      this.formMode = 'edit';
      this.selectedEmployeeId = id;
      this.showAddForm = true;
    } else if (event.action.label === 'Show history') {
      if (!this.permissionService.canView(MenuCodes.Employees)) return;
      this.router.navigate(['/employees', id, 'history']);
    } else if (event.action.label === 'Delete employee') {
      if (!this.permissionService.canDelete(MenuCodes.Employees)) return;
      const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
        data: {
          title: 'Delete employee?',
          description: 'This will permanently remove the employee and all associated records.',
          recordName: event.row['name'] as string,
          recordMeta: `${event.row['email']} · ${event.row['department'] ?? event.row['dept'] ?? ''}`,
          initials: this.getInitials(event.row['name'] as string),
          warningMessage: 'This action cannot be undone.',
        },
        panelClass: 'erp-dialog',
        disableClose: true,
      });

      dialogRef.afterClosed().subscribe((confirmed: any) => {
        if (confirmed) {
          this.employeeService.deleteEmployee(id).subscribe({
            next: () => {
              this.snackBar.open('Employee deleted successfully', 'Close', {
                duration: 3000,
                panelClass: 'snack-success',
              });
              this.loadEmployees();
            },
            error: () =>
              this.snackBar.open('Failed to delete employee', 'Close', {
                duration: 3000,
                panelClass: 'snack-error',
              }),
          });
        }
      });
    }
  }

  onAddButtonClicked(): void {
    this.openAddForm();
  }

  onBulkActionClicked(_event: any): void {
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
