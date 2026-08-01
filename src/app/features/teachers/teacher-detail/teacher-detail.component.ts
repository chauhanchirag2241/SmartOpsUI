import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { NotificationService } from '../../../core/services/notification.service';
import { EmployeeService } from '../../../core/services/employee.service';
import { ClassService } from '../../../core/services/class.service';
import { TeacherMappingService } from '../../../core/services/teacher-mapping.service';
import { AcademicYearContextService } from '../../../core/services/academic-year-context.service';
import { PageChromeDirective } from '../../../shared/directives/page-chrome.directive';
import { DeleteConfirmDialogComponent } from '../../../shared/components/delete-confirm-dialog/delete-confirm-dialog.component';
import { SmartDataTableComponent } from '../../../shared/components/smart-data-table/smart-data-table.component';
import type { DataTableConfig } from '../../../shared/components/smart-data-table';
import { FEE_HEAD_DIALOG_WIDTH } from '../../../shared/constants/dialog.constants';
import { getUserFacingApiError } from '../../../shared/utils/api-error.util';
import { PermissionService } from '../../../core/services/permission.service';
import { MenuCodes } from '../../../core/constants/menu-codes';
import {
  AssignClassSubjectDialogComponent,
  AssignClassSubjectDialogData,
} from '../assign-class-subject-dialog/assign-class-subject-dialog.component';

@Component({
  selector: 'app-teacher-detail',
  standalone: true,
  imports: [CommonModule, MatIconModule, PageChromeDirective, SmartDataTableComponent],
  templateUrl: './teacher-detail.component.html',
  styleUrl: './teacher-detail.component.css',
  host: { class: 'teacher-detail-page form-page-shell' },
})
export class TeacherDetailComponent implements OnInit {
  @Input() teacherId!: string;
  @Input() mode: 'edit' | 'view' = 'edit';
  @Input() initialTab = 0;
  @Output() cancel = new EventEmitter<void>();

  private readonly employeeService = inject(EmployeeService);
  private readonly classService = inject(ClassService);
  private readonly mappingService = inject(TeacherMappingService);
  private readonly ayContext = inject(AcademicYearContextService);
  private readonly snackBar = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly permissionService = inject(PermissionService);
  private readonly cdr = inject(ChangeDetectorRef);

  currentTab = 0;
  loading = true;
  teacherName = '';
  infoFields: { label: string; value: string }[] = [];
  /** Flat mappings from API (kept for reload / delete). */
  private assignmentRows: Record<string, unknown>[] = [];
  /** Parent rows for expandable table (one per class). */
  classGroups: Record<string, unknown>[] = [];
  assignmentTableConfig!: DataTableConfig;

  private classOptions: { label: string; value: string; classGroupId?: string }[] = [];

  readonly tabs = [{ label: 'Teacher info' }, { label: 'Class & subject rights' }];

  get isView(): boolean {
    return this.mode === 'view';
  }

  get canView(): boolean {
    return this.permissionService.canView(MenuCodes.Teachers);
  }

  get canEdit(): boolean {
    return this.permissionService.canEdit(MenuCodes.Teachers) && !this.isView;
  }

  ngOnInit(): void {
    this.currentTab = Math.max(0, Math.min(1, this.initialTab || 0));
    this.assignmentTableConfig = this.buildAssignmentTableConfig();
    this.loadTeacher();
    this.loadClasses();
    this.loadAssignments();
  }

  goTab(index: number): void {
    this.currentTab = index;
  }

  private buildAssignmentTableConfig(): DataTableConfig {
    return {
      header: {
        title: 'Class & subject rights',
        subtitle: 'Expand a class to see assigned subjects',
        syncPageChrome: false,
        showAddButton: this.canEdit,
        addButtonText: 'Assign permission',
        addButtonIcon: 'add',
        addButtonClass: 'btn-primary',
      },
      columns: [
        { key: 'className', label: 'Class', sortable: true },
        { key: 'subjectCountLabel', label: 'Subjects', sortable: false },
      ],
      actions: [],
      expandableRows: true,
      expandRowKey: 'classId',
      expandAccordion: false,
      selectable: false,
      showExport: false,
      searchPlaceholder: 'Search class or subject...',
      searchKeys: ['className', 'subjectSearch'],
      itemLabel: 'classes',
      defaultPageSize: 10,
      pageSizeOptions: [10, 25, 50],
    };
  }

  private loadTeacher(): void {
    this.loading = true;
    this.employeeService.getEmployeeById(this.teacherId).subscribe({
      next: (data: any) => {
        const first = String(data?.firstName ?? '').trim();
        const last = String(data?.lastName ?? '').trim();
        this.teacherName = [first, last].filter(Boolean).join(' ') || 'Teacher';
        this.infoFields = [
          { label: 'Name', value: this.teacherName },
          { label: 'Email', value: String(data?.email ?? '—') },
          { label: 'Mobile', value: String(data?.mobile ?? '—') },
          { label: 'Employee code', value: String(data?.employeeCode ?? '—') },
          { label: 'Designation', value: String(data?.designation ?? '—') },
          { label: 'Gender', value: String(data?.gender ?? '—') },
          { label: 'Date of birth', value: this.formatDate(data?.dob) },
          { label: 'Joining date', value: this.formatDate(data?.joiningDate) },
          { label: 'Experience (years)', value: String(data?.experience ?? '—') },
          { label: 'Qualifications', value: this.formatQualifications(data?.qualifications) },
          { label: 'Address', value: String(data?.address ?? '—') },
          {
            label: 'Status',
            value: data?.isActive === false ? 'Inactive' : 'Active',
          },
        ];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.snackBar.open('Failed to load teacher details', 'Close', {
          duration: 3000,
          panelClass: 'snack-error',
        });
        this.cdr.detectChanges();
      },
    });
  }

  private loadClasses(): void {
    const yearId = this.ayContext.effectiveYearId() || undefined;
    this.classService.getClassDropdown(yearId).subscribe({
      next: (rows) => {
        this.classOptions = (rows || []).map((c: any) => ({
          label: String(c.name ?? c.Name ?? ''),
          value: String(c.id ?? c.Id ?? ''),
          classGroupId: String(c.classGroupId ?? c.ClassGroupId ?? '').trim() || undefined,
        }));
      },
    });
  }

  private loadAssignments(): void {
    const yearId = this.ayContext.effectiveYearId() || undefined;
    this.mappingService.getByEmployee(this.teacherId, yearId).subscribe({
      next: (rows) => {
        this.assignmentRows = rows.map((r) => ({ ...r }));
        this.classGroups = this.groupAssignmentsByClass(this.assignmentRows);
        this.cdr.detectChanges();
      },
      error: () => {
        this.assignmentRows = [];
        this.classGroups = [];
        this.snackBar.open('Failed to load class / subject rights', 'Close', {
          duration: 3000,
          panelClass: 'snack-error',
        });
        this.cdr.detectChanges();
      },
    });
  }

  private groupAssignmentsByClass(rows: Record<string, unknown>[]): Record<string, unknown>[] {
    const byClass = new Map<string, Record<string, unknown>[]>();
    for (const row of rows) {
      const classId = String(row['classId'] ?? '');
      if (!classId) continue;
      const list = byClass.get(classId) ?? [];
      list.push(row);
      byClass.set(classId, list);
    }

    return Array.from(byClass.entries())
      .map(([classId, subjects]) => {
        const className = String(subjects[0]?.['className'] ?? 'Class');
        const names = subjects.map((s) => String(s['subjectName'] ?? '')).filter(Boolean);
        return {
          classId,
          className,
          subjectCount: subjects.length,
          subjectCountLabel: `${subjects.length} subject${subjects.length === 1 ? '' : 's'}`,
          subjectSearch: names.join(' '),
          subjects,
        };
      })
      .sort((a, b) => String(a.className).localeCompare(String(b.className)));
  }

  subjectsForClass(row: Record<string, unknown>): Record<string, unknown>[] {
    const list = row['subjects'];
    return Array.isArray(list) ? (list as Record<string, unknown>[]) : [];
  }

  openAssignDialog(): void {
    if (!this.canEdit) return;

    const yearId = this.ayContext.effectiveYearId();
    if (!yearId) {
      this.snackBar.open('Select an academic year in Settings first', 'Close', {
        duration: 3500,
        panelClass: 'snack-error',
      });
      return;
    }

    if (!this.classOptions.length) {
      this.snackBar.open('No classes available', 'Close', {
        duration: 3000,
        panelClass: 'snack-error',
      });
      return;
    }

    const data: AssignClassSubjectDialogData = {
      teacherId: this.teacherId,
      teacherName: this.teacherName,
      academicYearId: yearId,
      classes: this.classOptions.map((c) => ({
        id: c.value,
        name: c.label,
        classGroupId: c.classGroupId,
      })),
    };

    this.dialog
      .open(AssignClassSubjectDialogComponent, {
        data,
        panelClass: 'erp-dialog',
        disableClose: true,
        width: FEE_HEAD_DIALOG_WIDTH,
        maxWidth: '96vw',
      })
      .afterClosed()
      .subscribe((saved) => {
        if (!saved) return;
        this.snackBar.open('Permissions assigned', 'Close', {
          duration: 2500,
          panelClass: 'snack-success',
        });
        this.loadAssignments();
      });
  }

  removeSubject(subject: Record<string, unknown>): void {
    if (!this.canEdit) return;
    const id = String(subject['id'] ?? '');
    if (!id) return;

    const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
      data: {
        title: 'Remove permission?',
        description: 'This teacher will lose access to the selected class and subject.',
        recordName: `${subject['className']} · ${subject['subjectName']}`,
        recordMeta: 'Subject permission',
        initials: 'TR',
        warningMessage: 'You can assign the permission again later.',
      },
      panelClass: 'erp-dialog',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.mappingService.delete(id).subscribe({
        next: () => {
          this.snackBar.open('Permission removed', 'Close', {
            duration: 2500,
            panelClass: 'snack-success',
          });
          this.loadAssignments();
        },
        error: (err) =>
          this.snackBar.open(getUserFacingApiError(err, 'Failed to remove'), 'Close', {
            duration: 3500,
            panelClass: 'snack-error',
          }),
      });
    });
  }

  private formatDate(value: unknown): string {
    if (!value) return '—';
    const raw = String(value).substring(0, 10);
    const [y, m, d] = raw.split('-');
    if (!y || !m || !d) return String(value);
    return `${d}-${m}-${y}`;
  }

  private formatQualifications(value: unknown): string {
    if (Array.isArray(value)) {
      return value.map(String).filter(Boolean).join(', ') || '—';
    }
    const text = String(value ?? '').trim();
    return text || '—';
  }
}
