import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { NgIf } from '@angular/common';

import { AddStudentComponent } from './add-student/add-student.component';

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
export class StudentsComponent {
  constructor(private snackBar: MatSnackBar) {}

  showAddForm = false;

  openAddForm(): void {
    this.showAddForm = true;
  }

  closeAddForm(): void {
    this.showAddForm = false;
  }

  onStudentSaved(): void {
    this.showAddForm = false;
    // In a real app, refresh data here
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
          initialsKey: 'initials',
          avatarClassKey: 'avClass',
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
  students: Record<string, unknown>[] = [
    {
      name: 'Rahul Patel',
      email: 'rahul.p@school.com',
      initials: 'RP',
      avClass: 'av-g',
      admNo: 'ADM-2024-001',
      class: '10 — A',
      attendance: 94,
      fees: 'Paid',
      status: 'Active',
    },
    {
      name: 'Priya Modi',
      email: 'priya.m@school.com',
      initials: 'PM',
      avClass: 'av-b',
      admNo: 'ADM-2024-002',
      class: '10 — A',
      attendance: 88,
      fees: 'Paid',
      status: 'Active',
    },
    {
      name: 'Arjun Shah',
      email: 'arjun.s@school.com',
      initials: 'AS',
      avClass: 'av-p',
      admNo: 'ADM-2024-003',
      class: '9 — B',
      attendance: 72,
      fees: 'Overdue',
      status: 'Active',
    },
    {
      name: 'Kriti Dave',
      email: 'kriti.d@school.com',
      initials: 'KD',
      avClass: 'av-o',
      admNo: 'ADM-2024-004',
      class: '9 — A',
      attendance: 91,
      fees: 'Paid',
      status: 'Active',
    },
    {
      name: 'Vivek Joshi',
      email: 'vivek.j@school.com',
      initials: 'VJ',
      avClass: 'av-g',
      admNo: 'ADM-2024-005',
      class: '8 — C',
      attendance: 65,
      fees: 'Overdue',
      status: 'Inactive',
    },
    {
      name: 'Nisha Rao',
      email: 'nisha.r@school.com',
      initials: 'NR',
      avClass: 'av-b',
      admNo: 'ADM-2024-006',
      class: '8 — B',
      attendance: 97,
      fees: 'Paid',
      status: 'Active',
    },
    {
      name: 'Dev Mehta',
      email: 'dev.m@school.com',
      initials: 'DM',
      avClass: 'av-p',
      admNo: 'ADM-2024-007',
      class: '7 — A',
      attendance: 80,
      fees: 'Pending',
      status: 'Inactive',
    },
    {
      name: 'Avni Singh',
      email: 'avni.s@school.com',
      initials: 'AS',
      avClass: 'av-o',
      admNo: 'ADM-2024-008',
      class: '7 — C',
      attendance: 85,
      fees: 'Paid',
      status: 'Active',
    },
    {
      name: 'Karan Desai',
      email: 'karan.d@school.com',
      initials: 'KD',
      avClass: 'av-g',
      admNo: 'ADM-2024-009',
      class: '10 — B',
      attendance: 92,
      fees: 'Paid',
      status: 'Active',
    },
    {
      name: 'Meera Kapoor',
      email: 'meera.k@school.com',
      initials: 'MK',
      avClass: 'av-b',
      admNo: 'ADM-2024-010',
      class: '9 — A',
      attendance: 78,
      fees: 'Pending',
      status: 'Active',
    },
    {
      name: 'Rohan Trivedi',
      email: 'rohan.t@school.com',
      initials: 'RT',
      avClass: 'av-p',
      admNo: 'ADM-2024-011',
      class: '8 — A',
      attendance: 60,
      fees: 'Overdue',
      status: 'Inactive',
    },
    {
      name: 'Sneha Bhatt',
      email: 'sneha.b@school.com',
      initials: 'SB',
      avClass: 'av-o',
      admNo: 'ADM-2024-012',
      class: '10 — A',
      attendance: 95,
      fees: 'Paid',
      status: 'Active',
    },
  ];

  // ════════════════════════════════════════
  // EVENT HANDLERS
  // ════════════════════════════════════════
  onActionClicked(event: {
    action: DataTableAction;
    row: Record<string, unknown>;
    rowIndex: number;
  }): void {
    this.snackBar.open(
      `${event.action.label} → ${event.row['name']}`,
      'Close',
      { duration: 3000, panelClass: 'snack-info' },
    );
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
