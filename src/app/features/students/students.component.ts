import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { AddStudentComponent } from './add-student/add-student.component';
import { StudentService } from '../../core/services/student.service';

import { SmartDataTableComponent } from '../../shared/components/smart-data-table';
import { DeleteConfirmDialogComponent } from '../../shared/components/delete-confirm-dialog/delete-confirm-dialog.component';
import { StudentFilter } from '../../shared/enums/table-filters.enum';
import type {
  DataTableAction,
  DataTableBulkAction,
  DataTableConfig,
  DataTableFilter,
} from '../../shared/components/smart-data-table';

@Component({
  selector: 'app-students',
  standalone: true,
  imports: [SmartDataTableComponent, MatIconModule, MatSnackBarModule, MatDialogModule, AddStudentComponent],
  templateUrl: './students.component.html',
  styleUrl: './students.component.css',
})
export class StudentsComponent implements OnInit {
  constructor(
    private snackBar: MatSnackBar,
    private studentService: StudentService,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog
  ) { }

  showAddForm = false;
  formMode: 'add' | 'edit' | 'view' = 'add';
  selectedStudentId?: string;
  totalStudents = 0;
  currentFilter: StudentFilter = StudentFilter.Active;

  ngOnInit(): void {
    this.loadStudents();
  }

  loadStudents(
    pageIndex = 1,
    pageSize = 10,
    searchQuery = '',
    sortColumn: string | null = null,
    sortDirection: string | null = null,
    filter: StudentFilter = this.currentFilter
  ): void {
    this.studentService.getStudents(pageIndex, pageSize, searchQuery, sortColumn, sortDirection, filter).subscribe({
      next: (res: any) => {
        // The backend now returns PagedResult format { items, totalCount, ... }
        this.students = res?.items || [];
        this.totalStudents = res?.totalCount || 0;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error loading students:', err);
        this.snackBar.open('Failed to load students', 'Close', { duration: 3000, panelClass: 'snack-error' });
      }
    });
  }

  openAddForm(): void {
    this.formMode = 'add';
    this.selectedStudentId = undefined;
    this.showAddForm = true;
  }

  closeAddForm(): void {
    this.showAddForm = false;
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
    const filterValue = event.currentFilter ? (event.currentFilter as unknown as StudentFilter) : this.currentFilter;
    this.loadStudents(event.pageIndex, event.pageSize, event.searchQuery, event.sortColumn, event.sortDirection, filterValue);
  }

  onFilterChanged(filter: DataTableFilter | null): void {
    if (filter) {
      this.currentFilter = filter.value as unknown as StudentFilter;
    } else {
      this.currentFilter = StudentFilter.All;
    }
    // The pageChange event will handle the API call with the updated filter value
  }

  // ════════════════════════════════════════
  // TABLE CONFIGURATION
  // ════════════════════════════════════════
  tableConfig: DataTableConfig = {
    header: {
      title: 'Students',
      subtitle: 'Manage all enrolled students',
      showAddButton: true,
      addButtonText: 'Add student',
      addButtonIcon: 'add',
      addButtonClass: 'btn-primary'
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
      {
        key: 'fees',
        label: 'Fees Status',
        cellType: 'badge',
        badgeMap: {
          Paid: { cssClass: 'b-green', icon: 'check_circle' },
          Overdue: { cssClass: 'b-red', icon: 'error' },
          Pending: { cssClass: 'b-amber', icon: 'schedule' },
        },
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
      {
        label: 'Fee overdue',
        icon: 'warning',
        value: StudentFilter.FeeOverdue.toString(),
      },
    ],

    actions: [
      { label: 'View profile', icon: 'visibility', iconColor: '#639922' },
      { label: 'Edit details', icon: 'edit', iconColor: '#1E40AF' },
      { label: 'Collect fees', icon: 'payments', iconColor: '#854F0B' },
      { label: 'View attendance', icon: 'how_to_reg', iconColor: '#639922' },
      { label: 'Download TC', icon: 'download', iconColor: '#6b7280' },
      { label: 'Delete student', icon: 'delete', danger: true, separatorBefore: true },
    ],

    bulkActions: [
      { label: 'Send notice', icon: 'mail' },
      { label: 'Export', icon: 'download' },
      { label: 'Bulk edit', icon: 'edit' },
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
      this.formMode = 'view';
      this.selectedStudentId = id;
      this.showAddForm = true;
    } else if (event.action.label === 'Edit details') {
      this.formMode = 'edit';
      this.selectedStudentId = id;
      this.showAddForm = true;
    } else if (event.action.label === 'Delete student') {
      const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
        data: {
          title: 'Delete student?',
          description: 'This will permanently remove the student and all associated records including documents, fee history, and academic data.',
          recordName: event.row['name'] as string,
          recordMeta: `${event.row['email']} · Class ${event.row['class']}`,
          initials: this.getInitials(event.row['name'] as string),
          warningMessage: 'This action cannot be undone. All linked documents stored in Azure Blob will also be deleted.'
        },
        panelClass: 'erp-dialog',
        disableClose: true
      });

      dialogRef.afterClosed().subscribe((confirmed: any) => {
        if (confirmed) {
          this.studentService.deleteStudent(id).subscribe({
            next: () => {
              this.snackBar.open('Student deleted successfully', 'Close', { duration: 3000, panelClass: 'snack-success' });
              this.loadStudents();
            },
            error: () => this.snackBar.open('Failed to delete student', 'Close', { duration: 3000, panelClass: 'snack-error' })
          });
        }
      });
    } else {
      this.snackBar.open(
        `${event.action.label} → ${event.row['name']}`,
        'Close',
        { duration: 3000, panelClass: 'snack-info' },
      );
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

  onBulkActionClicked(event: {
    action: DataTableBulkAction;
    selectedRows: Record<string, unknown>[];
  }): void {
    if (event.action.label === 'Delete') {
      const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
        data: {
          title: 'Delete multiple students?',
          description: `You are about to delete ${event.selectedRows.length} student records. This action is permanent.`,
          recordName: `${event.selectedRows.length} Students Selected`,
          recordMeta: 'Bulk Deletion',
          initials: 'BD',
          warningMessage: 'This will permanently remove all selected students and their associated data.'
        },
        panelClass: 'erp-dialog',
        disableClose: true
      });

      dialogRef.afterClosed().subscribe((confirmed: any) => {
        if (confirmed) {
          // Implement bulk delete logic here
          this.snackBar.open(`Bulk delete for ${event.selectedRows.length} students initiated`, 'Close', { duration: 3000, panelClass: 'snack-success' });
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
