
import { Component, DestroyRef, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NotificationService } from '../../core/services/notification.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { AddStudentComponent } from './add-student/add-student.component';
import {
  PromoteStudentsDialogComponent,
  PromoteStudentRow,
} from './promote-students-dialog/promote-students-dialog.component';
import { StudentService } from '../../core/services/student.service';
import { ClassService } from '../../core/services/class.service';

import { SmartDataTableComponent } from '../../shared/components/smart-data-table';
import { DeleteConfirmDialogComponent } from '../../shared/components/delete-confirm-dialog/delete-confirm-dialog.component';
import { StudentFilter } from '../../shared/enums/table-filters.enum';
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
  selector: 'app-students',
  standalone: true,
  imports: [
    SmartDataTableComponent,
    MatIconModule,
    MatSnackBarModule,
    MatDialogModule,
    AddStudentComponent,
    PromoteStudentsDialogComponent,
  ],
  templateUrl: './students.component.html',
  styleUrl: './students.component.css',
})
export class StudentsComponent implements OnInit {
  readonly permissionService = inject(PermissionService);
  private readonly ayContext = inject(AcademicYearContextService);
  private readonly classService = inject(ClassService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  private studentsRequestSeq = 0;

  constructor(
    private snackBar: NotificationService,
    private studentService: StudentService,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog,
  ) {}

  showAddForm = false;
  formMode: 'add' | 'edit' | 'view' = 'add';
  selectedStudentId?: string;
  totalStudents = 0;
  currentFilter: StudentFilter = StudentFilter.Active;

  classOptions: { id: string; name: string }[] = [];
  readonly selectedClassIds = new Set<string>();
  classFilterDropdownOpen = false;
  showPromoteModal = false;
  promoteStudents: PromoteStudentRow[] = [];

  private listState = {
    pageIndex: 1,
    pageSize: 10,
    searchQuery: '',
    sortColumn: null as string | null,
    sortDirection: null as string | null,
  };

  get classFilterPanelActive(): boolean {
    return this.selectedClassIds.size > 0;
  }

  get classFilterSummary(): string {
    const count = this.selectedClassIds.size;
    if (!count) {
      return 'All classes';
    }
    if (count === 1) {
      const id = Array.from(this.selectedClassIds)[0];
      return this.classOptions.find((c) => c.id === id)?.name ?? '1 class selected';
    }
    return `${count} classes selected`;
  }

  ngOnInit(): void {
    this.tableConfig = this.buildTableConfig();
    this.loadClassOptions();
    this.loadStudents();
  }

  private loadClassOptions(): void {
    const yearKey = this.ayContext.effectiveYearKey();
    this.classService
      .getClassDropdown()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: (items) => {
        if (yearKey !== this.ayContext.effectiveYearKey()) {
          return;
        }
        this.classOptions = (items || []).map((item: { id: string; name: string }) => ({
          id: String(item.id),
          name: String(item.name ?? ''),
        }));
        this.cdr.detectChanges();
      },
      error: () =>
        this.snackBar.open('Failed to load class list', 'Close', {
          duration: 3000,
          panelClass: 'snack-error',
        }),
    });
  }

  loadStudents(
    pageIndex = this.listState.pageIndex,
    pageSize = this.listState.pageSize,
    searchQuery = this.listState.searchQuery,
    sortColumn: string | null = this.listState.sortColumn,
    sortDirection: string | null = this.listState.sortDirection,
    filter: StudentFilter = this.currentFilter,
  ): void {
    this.listState = { pageIndex, pageSize, searchQuery, sortColumn, sortDirection };

    const classIds = this.selectedClassIds.size ? Array.from(this.selectedClassIds) : null;
    const requestSeq = ++this.studentsRequestSeq;
    const yearKey = this.ayContext.effectiveYearKey();
    this.students = [];
    this.totalStudents = 0;

    this.studentService
      .getStudents(pageIndex, pageSize, searchQuery, sortColumn, sortDirection, filter, classIds)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: any) => {
          if (
            requestSeq !== this.studentsRequestSeq ||
            yearKey !== this.ayContext.effectiveYearKey()
          ) {
            return;
          }
          this.students = res?.items || [];
          this.totalStudents = res?.totalCount || 0;
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          if (requestSeq !== this.studentsRequestSeq) {
            return;
          }
          console.error('Error loading students:', err);
          this.snackBar.open('Failed to load students', 'Close', {
            duration: 3000,
            panelClass: 'snack-error',
          });
        },
      });
  }

  openAddForm(): void {
    if (this.ayContext.isReadOnlyScope() || !this.permissionService.canAdd(MenuCodes.Students)) {
      return;
    }
    this.formMode = 'add';
    this.selectedStudentId = undefined;
    this.showAddForm = true;
  }

  closeAddForm(): void {
    this.showAddForm = false;
  }

  private openStudentView(id: string): void {
    if (!this.permissionService.canView(MenuCodes.Students)) {
      return;
    }
    this.formMode = 'view';
    this.selectedStudentId = id;
    this.showAddForm = true;
  }

  private openStudentHistory(id: string): void {
    if (!this.permissionService.canView(MenuCodes.Students)) {
      return;
    }
    this.router.navigate(['/students', id, 'history']);
  }

  onStudentSaved(): void {
    this.showAddForm = false;
    this.loadStudents();
  }

  onPageChange(event: {
    pageIndex: number;
    pageSize: number;
    searchQuery: string;
    sortColumn: string | null;
    sortDirection: string | null;
    currentFilter: string | null;
  }): void {
    const filterValue =
      event.currentFilter !== null && event.currentFilter !== undefined
        ? (Number(event.currentFilter) as StudentFilter)
        : this.currentFilter;
    this.loadStudents(
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
      this.currentFilter = Number(filter.value) as StudentFilter;
    } else {
      this.currentFilter = StudentFilter.All;
    }
    this.loadStudents(1, this.listState.pageSize, this.listState.searchQuery);
  }

  onAdvancedFiltersCleared(): void {
    this.clearClassFilter(false);
  }

  toggleClassFilterDropdown(event: Event): void {
    event.stopPropagation();
    this.classFilterDropdownOpen = !this.classFilterDropdownOpen;
  }

  isClassSelected(classId: string): boolean {
    return this.selectedClassIds.has(classId);
  }

  toggleClassSelection(classId: string, checked: boolean): void {
    if (checked) {
      this.selectedClassIds.add(classId);
    } else {
      this.selectedClassIds.delete(classId);
    }
    this.reloadWithClassFilter();
  }

  clearClassFilter(reload = true): void {
    this.selectedClassIds.clear();
    this.classFilterDropdownOpen = false;
    if (reload) {
      this.reloadWithClassFilter();
    }
  }

  private reloadWithClassFilter(): void {
    this.loadStudents(
      1,
      this.listState.pageSize,
      this.listState.searchQuery,
      this.listState.sortColumn,
      this.listState.sortDirection,
    );
  }

  // ════════════════════════════════════════
  // TABLE CONFIGURATION
  // ════════════════════════════════════════
  tableConfig!: DataTableConfig;

  private readonly baseTableConfig: DataTableConfig = {
    header: {
      title: 'Students',
      subtitle: 'Manage all enrolled students',
      showAddButton: true,
      addButtonText: 'Add student',
      addButtonIcon: 'add',
      addButtonClass: 'btn-primary',
    },
    columns: [
      {
        key: 'student',
        label: 'Student',
        sortable: true,
        cellType: 'avatar',
        toggleable: false,
        avatarConfig: {
          nameKey: 'name',
          subtitleKey: 'email',
        },
      },
      {
        key: 'admNo',
        label: 'Admission No.',
        sortable: true,
      },
      {
        key: 'class',
        label: 'Class',
        sortable: true,
      },
      {
        key: 'attendance',
        label: 'Attendance',
        cellType: 'progress',
        progressColors: [
          { min: 90, color: '#639922' },
          { min: 75, color: '#EF9F27' },
          { min: 0, color: '#E24B4A' },
        ],
      },
      // {
      //   key: 'fees',
      //   label: 'Fees Status',
      //   cellType: 'badge',
      //   badgeMap: {
      //     Paid: { cssClass: 'b-green', icon: 'check_circle' },
      //     Partial: { cssClass: 'b-amber', icon: 'schedule' },
      //     Overdue: { cssClass: 'b-red', icon: 'error' },
      //     Pending: { cssClass: 'b-amber', icon: 'schedule' },
      //   },
      // },
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
      { label: 'All', icon: 'list', value: StudentFilter.All.toString() },
      {
        label: 'Active',
        icon: 'check_circle',
        value: StudentFilter.Active.toString(),
      },
      {
        label: 'Inactive',
        icon: 'cancel',
        value: StudentFilter.Inactive.toString(),
      },
      // {
      //   label: 'Fee overdue',
      //   icon: 'warning',
      //   value: StudentFilter.FeeOverdue.toString(),
      // },
    ],

    actions: [
      {
        label: 'View profile',
        icon: 'visibility',
        iconColor: '#639922',
      },
      { label: 'Edit details', icon: 'edit', iconColor: '#1E40AF' },
      {
        label: 'Show history',
        icon: 'history',
        iconColor: '#639922',
      },
      {
        label: 'Delete student',
        icon: 'delete',
        danger: true,
        separatorBefore: true,
      },
    ],
    actionVisibleFn: (action, row) => this.isStudentActionVisible(action, row),

    bulkActions: [
      { label: 'Promote to next year', icon: 'upgrade' },
      { label: 'Export', icon: 'download' },
      { label: 'Delete', icon: 'delete', danger: true },
    ],

    searchPlaceholder: 'Search by name, admission no...',
    searchKeys: ['name', 'admNo', 'class', 'email'],
    itemLabel: 'students',
    defaultPageSize: 10,
    pageSizeOptions: [10, 25, 50, 100],
  };

  studentRowClass = (row: Record<string, unknown>): string => {
    return row['isActive'] === false ? 'row-inactive' : '';
  };

  private isStudentActionVisible(action: DataTableAction, row: Record<string, unknown>): boolean {
    if (row['isActive'] !== false) {
      return true;
    }

    return action.label === 'View profile' || action.label === 'Show history';
  }

  private buildTableConfig(): DataTableConfig {
    const permittedConfig = applyModuleTablePermissions(
      this.baseTableConfig,
      this.permissionService,
      MenuCodes.Students,
      this.ayContext.isReadOnlyScope(),
    );
    return {
      ...permittedConfig,
      columns: permittedConfig.columns.filter((col) => col.key !== 'isActive'),
    };
  }

  // ════════════════════════════════════════
  // DEMO DATA
  // ════════════════════════════════════════
  students: Record<string, unknown>[] = [];

  // ════════════════════════════════════════
  // EVENT HANDLERS
  // ════════════════════════════════════════
  onActionClicked(event: {
    action: DataTableAction;
    row: Record<string, unknown>;
    rowIndex: number;
  }): void {
    const id = event.row['id'] as string;

    if (event.action.label === 'View profile') {
      this.openStudentView(id);
    } else if (event.action.label === 'Show history') {
      this.openStudentHistory(id);
    } else if (event.action.label === 'Edit details') {
      if (this.ayContext.isReadOnlyScope() || !this.permissionService.canEdit(MenuCodes.Students)) return;
      this.formMode = 'edit';
      this.selectedStudentId = id;
      this.showAddForm = true;
    } else if (event.action.label === 'Delete student') {
      if (this.ayContext.isReadOnlyScope() || !this.permissionService.canDelete(MenuCodes.Students)) return;
      const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
        data: {
          title: 'Delete student?',
          description:
            'This will permanently remove the student and all associated records including documents, fee history, and academic data.',
          recordName: event.row['name'] as string,
          recordMeta: `${event.row['email']} · Class ${event.row['class']}`,
          initials: this.getInitials(event.row['name'] as string),
          warningMessage:
            'This action cannot be undone. All linked documents stored in Azure Blob will also be deleted.',
        },
        panelClass: 'erp-dialog',
        disableClose: true,
      });

      dialogRef.afterClosed().subscribe((confirmed: any) => {
        if (confirmed) {
          this.studentService.deleteStudent(id).subscribe({
            next: () => {
              this.snackBar.open('Student deleted successfully', 'Close', {
                duration: 3000,
                panelClass: 'snack-success',
              });
              this.loadStudents();
            },
            error: () =>
              this.snackBar.open('Failed to delete student', 'Close', {
                duration: 3000,
                panelClass: 'snack-error',
              }),
          });
        }
      });
    } else {
      this.snackBar.open(`${event.action.label} → ${event.row['name']}`, 'Close', {
        duration: 3000,
        panelClass: 'snack-info',
      });
    }
  }

  onExportClicked(): void {
    this.snackBar.open('Exporting student data...', 'Close', {
      duration: 3000,
      panelClass: 'snack-success',
    });
  }

  onAddButtonClicked(): void {
    this.openAddForm();
  }

  openPromoteDialog(rows: Record<string, unknown>[]): void {
    if (this.ayContext.isReadOnlyScope()) {
      this.snackBar.open(
        'Promote is not allowed while viewing a past academic year.',
        'Close',
        { duration: 4000, panelClass: 'snack-warning' },
      );
      return;
    }
    if (!this.permissionService.canEdit(MenuCodes.Students)) {
      return;
    }
    const active = rows.filter((r) => r['isActive'] !== false);
    const promotable = active.filter((r) => r['enrollmentIsActive'] !== false);
    if (!promotable.length) {
      const alreadyPromoted = active.length > 0 && active.every((r) => r['enrollmentIsActive'] === false);
      this.snackBar.open(
        alreadyPromoted
          ? 'Selected student(s) are already promoted from this academic year. Refresh the list or switch to the target year.'
          : 'Select students with an active enrollment in the current academic year to promote.',
        'Close',
        { duration: 5000, panelClass: 'snack-warning' },
      );
      return;
    }
    if (promotable.length < active.length) {
      this.snackBar.open(
        `${active.length - promotable.length} selected student(s) skipped — already promoted from this year.`,
        'Close',
        { duration: 4000, panelClass: 'snack-info' },
      );
    }
    this.promoteStudents = promotable.map((r) => ({
      id: String(r['id'] ?? ''),
      name: String(r['name'] ?? 'Student'),
      class: String(r['class'] ?? ''),
    }));
    this.showPromoteModal = true;
    this.cdr.detectChanges();
  }

  onPromoteCompleted(): void {
    this.showPromoteModal = false;
    this.promoteStudents = [];
    this.loadStudents();
  }

  onBulkActionClicked(event: {
    action: DataTableBulkAction;
    selectedRows: Record<string, unknown>[];
  }): void {
    if (event.action.label === 'Promote to next year') {
      this.openPromoteDialog(event.selectedRows);
      return;
    }
    if (event.action.label === 'Delete') {
      const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
        data: {
          title: 'Delete multiple students?',
          description: `You are about to delete ${event.selectedRows.length} student records. This action is permanent.`,
          recordName: `${event.selectedRows.length} Students Selected`,
          recordMeta: 'Bulk Deletion',
          initials: 'BD',
          warningMessage:
            'This will permanently remove all selected students and their associated data.',
        },
        panelClass: 'erp-dialog',
        disableClose: true,
      });

      dialogRef.afterClosed().subscribe((confirmed: any) => {
        if (confirmed) {
          // Implement bulk delete logic here
          this.snackBar.open(
            `Bulk delete for ${event.selectedRows.length} students initiated`,
            'Close',
            { duration: 3000, panelClass: 'snack-success' },
          );
        }
      });
    } else {
      this.snackBar.open(
        `${event.action.label} → ${event.selectedRows.length} student(s)`,
        'Close',
        { duration: 3000, panelClass: 'snack-info' },
      );
    }
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
