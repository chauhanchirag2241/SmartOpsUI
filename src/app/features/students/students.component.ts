import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { NgIf } from '@angular/common';

import { AddStudentComponent } from './add-student/add-student.component';
import { StudentService } from '../../core/services/student.service';

import { SmartDataTableComponent } from '../../shared/components/smart-data-table';
import type {
  DataTableAction,
  DataTableBulkAction,
  DataTableConfig,
} from '../../shared/components/smart-data-table';

@Component({
  selector: 'app-students',
  standalone: true,
  imports: [SmartDataTableComponent, MatIconModule, MatSnackBarModule, NgIf, AddStudentComponent],
  templateUrl: './students.component.html',
  styleUrl: './students.component.css',
})
export class StudentsComponent implements OnInit {
  constructor(private snackBar: MatSnackBar, private studentService: StudentService, private cdr: ChangeDetectorRef) {}

  showAddForm = false;
  formMode: 'add' | 'edit' | 'view' = 'add';
  selectedStudentId?: string;
  totalStudents = 0;

  ngOnInit(): void {
    this.loadStudents();
  }

  loadStudents(pageIndex = 1, pageSize = 10, searchQuery = '', sortColumn: string | null = null, sortDirection: string | null = null): void {
    this.studentService.getStudents(pageIndex, pageSize, searchQuery, sortColumn, sortDirection).subscribe({
      next: (res: any) => {
        // The backend now returns PagedResult format { items, totalCount, ... }
        this.students = res?.items || [];
        this.totalStudents = res?.totalCount || 0;
        this.cdr.detectChanges();
      },
      error: (err) => {
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

  onPageChange(event: { pageIndex: number; pageSize: number; searchQuery: string; sortColumn: string | null; sortDirection: string | null }): void {
    this.loadStudents(event.pageIndex, event.pageSize, event.searchQuery, event.sortColumn, event.sortDirection);
  }

  // ════════════════════════════════════════
  // TABLE CONFIGURATION
  // ════════════════════════════════════════
  tableConfig: DataTableConfig = {
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
        key: 'status',
        label: 'Status',
        cellType: 'badge',
        badgeMap: {
          Active: { cssClass: 'b-green' },
          Inactive: { cssClass: 'b-gray' },
        },
      },
    ],

    filters: [
      { label: 'All', icon: 'list', value: 'all' },
      {
        label: 'Active',
        icon: 'check_circle',
        value: 'active',
        filterFn: (row) => row['status'] === 'Active',
      },
      {
        label: 'Inactive',
        icon: 'cancel',
        value: 'inactive',
        filterFn: (row) => row['status'] === 'Inactive',
      },
      {
        label: 'Fee overdue',
        icon: 'warning',
        value: 'overdue',
        filterFn: (row) => row['fees'] === 'Overdue',
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
      if (confirm(`Are you sure you want to delete ${event.row['name']}?`)) {
        this.studentService.deleteStudent(id).subscribe({
          next: () => {
            this.snackBar.open('Student deleted successfully', 'Close', { duration: 3000, panelClass: 'snack-success' });
            this.loadStudents();
          },
          error: () => this.snackBar.open('Failed to delete student', 'Close', { duration: 3000, panelClass: 'snack-error' })
        });
      }
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

  onBulkActionClicked(event: {
    action: DataTableBulkAction;
    selectedRows: Record<string, unknown>[];
  }): void {
    this.snackBar.open(
      `${event.action.label} → ${event.selectedRows.length} student(s)`,
      'Close',
      { duration: 3000, panelClass: 'snack-info' },
    );
  }
}
