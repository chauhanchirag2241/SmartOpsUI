import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { NotificationService } from '../../core/services/notification.service';
import { EmployeeService } from '../../core/services/employee.service';
import { TeacherDetailComponent } from './teacher-detail/teacher-detail.component';
import { SmartDataTableComponent } from '../../shared/components/smart-data-table';
import { PageChromeDirective } from '../../shared/directives/page-chrome.directive';
import { StaffFilter } from '../../shared/enums/table-filters.enum';
import type {
  DataTableAction,
  DataTableConfig,
  DataTableFilter,
} from '../../shared/components/smart-data-table';
import { MenuCodes } from '../../core/constants/menu-codes';
import { PermissionService } from '../../core/services/permission.service';
import { AcademicYearContextService } from '../../core/services/academic-year-context.service';
import { applyModuleTablePermissions } from '../../core/utils/permission-ui.util';

@Component({
  selector: 'app-teachers',
  standalone: true,
  imports: [
    SmartDataTableComponent,
    MatIconModule,
    MatSnackBarModule,
    MatDialogModule,
    TeacherDetailComponent,
    PageChromeDirective,
  ],
  templateUrl: './teachers.component.html',
  styleUrl: './teachers.component.css',
})
export class TeachersComponent implements OnInit {
  private readonly permissionService = inject(PermissionService);
  private readonly ayContext = inject(AcademicYearContextService);

  constructor(
    private snackBar: NotificationService,
    private employeeService: EmployeeService,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog,
  ) {}

  showDetail = false;
  detailMode: 'edit' | 'view' = 'edit';
  selectedTeacherId?: string;
  detailInitialTab = 0;
  totalTeachers = 0;
  currentFilter: StaffFilter = StaffFilter.Active;
  teachers: Record<string, unknown>[] = [];

  private readonly baseTableConfig: DataTableConfig = {
    header: {
      title: 'Teachers',
      subtitle: 'Manage teachers and class / subject permissions',
      syncPageChrome: false,
      showAddButton: false,
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
      { label: 'Active', icon: 'check_circle', value: StaffFilter.Active.toString() },
      { label: 'All', icon: 'list', value: StaffFilter.All.toString() },
      { label: 'Inactive', icon: 'cancel', value: StaffFilter.Inactive.toString() },
    ],
    actions: [
      { label: 'Manage teacher', icon: 'manage_accounts', iconColor: '#3B6D11' },
      { label: 'View profile', icon: 'visibility', iconColor: '#639922' },
    ],
    actionVisibleFn: (action, row) => this.isActionVisible(action, row),
    searchPlaceholder: 'Search by name or email...',
    searchKeys: ['name', 'email', 'designation', 'department'],
    itemLabel: 'teachers',
    defaultPageSize: 10,
    pageSizeOptions: [10, 25, 50, 100],
  };

  tableConfig: DataTableConfig = this.buildTableConfig();

  ngOnInit(): void {
    this.loadTeachers();
  }

  loadTeachers(
    pageIndex = 1,
    pageSize = 10,
    searchQuery = '',
    sortColumn: string | null = null,
    sortDirection: string | null = null,
    filter: StaffFilter = this.currentFilter,
  ): void {
    this.employeeService
      .getEmployees(pageIndex, pageSize, searchQuery, sortColumn, sortDirection, filter, true)
      .subscribe({
        next: (res: any) => {
          this.teachers = (res?.items || []).map((row: any) => ({
            ...row,
            department: row.departmentName ?? row.department ?? '',
            employeeType: row.userTypeCode ?? row.employeeType ?? 'Teacher',
          }));
          this.totalTeachers = res?.totalCount || 0;
          this.cdr.detectChanges();
        },
        error: () => {
          this.teachers = [];
          this.totalTeachers = 0;
          this.cdr.detectChanges();
          this.snackBar.open('Failed to load teachers', 'Close', {
            duration: 3000,
            panelClass: 'snack-error',
          });
        },
      });
  }

  closeDetail(): void {
    this.showDetail = false;
    this.selectedTeacherId = undefined;
    this.loadTeachers();
  }

  onPageChange(event: any): void {
    const filterValue = event.currentFilter
      ? (event.currentFilter as unknown as StaffFilter)
      : this.currentFilter;
    this.loadTeachers(
      event.pageIndex,
      event.pageSize,
      event.searchQuery,
      event.sortColumn,
      event.sortDirection,
      filterValue,
    );
  }

  onFilterChanged(filter: DataTableFilter | null): void {
    this.currentFilter = filter ? (Number(filter.value) as StaffFilter) : StaffFilter.All;
    this.loadTeachers();
  }

  teacherRowClass = (row: Record<string, unknown>): string => {
    return row['isActive'] === false ? 'row-inactive' : '';
  };

  private isActionVisible(action: DataTableAction, row: Record<string, unknown>): boolean {
    if (row['isActive'] !== false) {
      return true;
    }
    return action.label === 'View profile';
  }

  private buildTableConfig(): DataTableConfig {
    const permittedConfig = applyModuleTablePermissions(
      this.baseTableConfig,
      this.permissionService,
      MenuCodes.Teachers,
      this.ayContext.isReadOnlyScope(),
    );
    return {
      ...permittedConfig,
      columns: permittedConfig.columns.filter((col) => col.key !== 'isActive'),
    };
  }

  onActionClicked(event: any): void {
    const id = event.row['id'] as string;
    if (event.action.label === 'Manage teacher') {
      if (!this.permissionService.canEdit(MenuCodes.Teachers) && !this.permissionService.canView(MenuCodes.Teachers)) {
        return;
      }
      this.detailMode = this.permissionService.canEdit(MenuCodes.Teachers) ? 'edit' : 'view';
      this.selectedTeacherId = id;
      this.detailInitialTab = 0;
      this.showDetail = true;
      return;
    }
    if (event.action.label === 'View profile') {
      if (!this.permissionService.canView(MenuCodes.Teachers)) return;
      this.detailMode = 'view';
      this.selectedTeacherId = id;
      this.detailInitialTab = 0;
      this.showDetail = true;
    }
  }
}
