import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NotificationService } from '../../core/services/notification.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { AddSubjectComponent } from './add-subject/add-subject.component';
import { SubjectService } from '../../core/services/subject.service';
import { SmartDataTableComponent } from '../../shared/components/smart-data-table';
import { DeleteConfirmDialogComponent } from '../../shared/components/delete-confirm-dialog/delete-confirm-dialog.component';

import type {
  DataTableAction,
  DataTableConfig,
  DataTableFilter,
} from '../../shared/components/smart-data-table';
import { MenuCodes } from '../../core/constants/menu-codes';
import { PermissionService } from '../../core/services/permission.service';
import { applyModuleTablePermissions } from '../../core/utils/permission-ui.util';

@Component({
  selector: 'app-subjects',
  standalone: true,
  imports: [
    CommonModule,
    SmartDataTableComponent,
    MatIconModule,
    MatSnackBarModule,
    MatDialogModule,
    AddSubjectComponent
  ],
  templateUrl: './subjects.component.html',
  styleUrl: './subjects.component.css',
})
export class SubjectsComponent implements OnInit {
  private readonly permissionService = inject(PermissionService);

  showAddForm = false;
  formMode: 'add' | 'edit' | 'view' = 'add';
  selectedSubjectId?: string;
  totalSubjects = 0;
  currentFilter = 'All';
  subjects: Record<string, unknown>[] = [];

  tableConfig!: DataTableConfig;

  private readonly baseTableConfig: DataTableConfig = {
    header: {
      title: 'Subjects',
      subtitle: 'Manage curriculum and subject assignments',
      showAddButton: true,
      addButtonText: 'Add subject',
      addButtonIcon: 'add',
      addButtonClass: 'btn-primary'
    },
    columns: [
      {
        key: 'subjectName',
        label: 'Subject',
        sortable: true,
        cellType: 'text',
      },
      {
        key: 'subjectCode',
        label: 'Code',
        sortable: true,
      },
      {
        key: 'subjectType',
        label: 'Type',
        cellType: 'badge',
        badgeMap: {
          'Theory': { cssClass: 'b-blue', label: 'Theory' },
          'Practical': { cssClass: 'b-purple', label: 'Practical' },
          'Both': { cssClass: 'b-teal', label: 'Both' },
        },
      },
      {
        key: 'subjectCategory',
        label: 'Category',
        cellType: 'text',
      },
      {
        key: 'medium',
        label: 'Medium',
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
      { label: 'All', icon: 'list', value: 'All' },
      { label: 'Active', icon: 'check_circle', value: 'Active' },
      { label: 'Inactive', icon: 'cancel', value: 'Inactive' },
      { label: 'Core', icon: 'star', value: 'Core' },
      { label: 'Elective', icon: 'category', value: 'Elective' },
    ],
    actions: [
      { label: 'View details', icon: 'visibility', iconColor: '#639922', permission: 'subject.read' },
      { label: 'Edit', icon: 'edit', iconColor: '#1E40AF', permission: 'admin.full' },
      { label: 'Delete', icon: 'delete', danger: true, separatorBefore: true, permission: 'admin.full' },
    ],
    searchPlaceholder: 'Search by name or code...',
    searchKeys: ['subjectName', 'subjectCode'],
    itemLabel: 'subjects',
    defaultPageSize: 10,
  };

  constructor(
    private snackBar: NotificationService,
    private subjectService: SubjectService,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog
  ) { }

  ngOnInit(): void {
    this.tableConfig = applyModuleTablePermissions(this.baseTableConfig, this.permissionService, MenuCodes.Subjects);
    this.loadSubjects();
  }

  loadSubjects(
    pageIndex = 1,
    pageSize = 10,
    searchQuery = '',
    sortColumn: string | null = null,
    sortDirection: string | null = null,
    filter: string = this.currentFilter
  ): void {
    this.subjectService.getSubjects(pageIndex, pageSize, searchQuery, sortColumn, sortDirection, filter).subscribe({
      next: (res: any) => {
        this.subjects = res?.items || [];
        this.totalSubjects = res?.totalCount || 0;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error loading subjects:', err);
        this.snackBar.open('Failed to load subjects', 'Close', { duration: 3000, panelClass: 'snack-error' });
      }
    });
  }

  onAddButtonClicked(): void {
    if (!this.permissionService.canAdd(MenuCodes.Subjects)) return;
    this.formMode = 'add';
    this.selectedSubjectId = undefined;
    this.showAddForm = true;
  }

  closeAddForm(): void {
    this.showAddForm = false;
  }

  onSubjectSaved(): void {
    this.showAddForm = false;
    this.loadSubjects();
  }

  onPageChange(event: any): void {
    this.loadSubjects(
      event.pageIndex, 
      event.pageSize, 
      event.searchQuery, 
      event.sortColumn, 
      event.sortDirection, 
      event.currentFilter || this.currentFilter
    );
  }

  onFilterChanged(filter: DataTableFilter | null): void {
    this.currentFilter = filter ? filter.value : 'All';
  }

  onActionClicked(event: {
    action: DataTableAction;
    row: Record<string, unknown>;
    rowIndex: number;
  }): void {
    const id = event.row['id'] as string;

    if (event.action.label === 'View details') {
      if (!this.permissionService.canView(MenuCodes.Subjects)) return;
      this.formMode = 'view';
      this.selectedSubjectId = id;
      this.showAddForm = true;
    } else if (event.action.label === 'Edit') {
      if (!this.permissionService.canEdit(MenuCodes.Subjects)) return;
      this.formMode = 'edit';
      this.selectedSubjectId = id;
      this.showAddForm = true;
    } else if (event.action.label === 'Delete') {
      if (!this.permissionService.canDelete(MenuCodes.Subjects)) return;
      const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
        data: {
          title: 'Delete subject?',
          description: 'This will permanently remove the subject. This action cannot be undone.',
          recordName: event.row['subjectName'] as string,
          recordMeta: `Code: ${event.row['subjectCode']}`,
          initials: (event.row['subjectName'] as string).substring(0, 2).toUpperCase(),
          warningMessage: 'This may affect class schedules and student marks.'
        },
        panelClass: 'erp-dialog',
        disableClose: true
      });

      dialogRef.afterClosed().subscribe((confirmed: any) => {
        if (confirmed) {
          this.subjectService.deleteSubject(id).subscribe({
            next: () => {
              this.snackBar.open('Subject deleted successfully', 'Close', { duration: 3000, panelClass: 'snack-success' });
              this.loadSubjects();
            },
            error: () => this.snackBar.open('Failed to delete subject', 'Close', { duration: 3000, panelClass: 'snack-error' })
          });
        }
      });
    }
  }

  subjectRowClass = (row: Record<string, unknown>): string => {
    return row['isActive'] === false ? 'row-inactive' : '';
  };
}
