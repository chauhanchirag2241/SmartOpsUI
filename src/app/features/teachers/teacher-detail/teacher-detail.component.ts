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
import { Validators } from '@angular/forms';
import { NotificationService } from '../../../core/services/notification.service';
import { EmployeeService } from '../../../core/services/employee.service';
import { ClassService } from '../../../core/services/class.service';
import { ClassSettingsService } from '../../../core/services/class-settings.service';
import { TeacherMappingService } from '../../../core/services/teacher-mapping.service';
import { AcademicYearContextService } from '../../../core/services/academic-year-context.service';
import { PageChromeDirective } from '../../../shared/directives/page-chrome.directive';
import { DeleteConfirmDialogComponent } from '../../../shared/components/delete-confirm-dialog/delete-confirm-dialog.component';
import {
  FormDialogComponent,
  FormDialogData,
} from '../../../shared/components/form-dialog/form-dialog.component';
import { SmartDataTableComponent } from '../../../shared/components/smart-data-table/smart-data-table.component';
import type {
  DataTableAction,
  DataTableConfig,
} from '../../../shared/components/smart-data-table';
import {
  ERP_FORM_DIALOG_WIDTH,
  FEE_HEAD_DIALOG_WIDTH,
} from '../../../shared/constants/dialog.constants';
import { SELECT_PLACEHOLDER } from '../../../shared/constants/form.constants';
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
  private readonly classSettingsService = inject(ClassSettingsService);
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
  /** One parent row per class-group mapping. */
  classGroups: Record<string, unknown>[] = [];
  assignmentTableConfig!: DataTableConfig;

  /** Class teacher assignments (section / classid). */
  classTeacherRows: Record<string, unknown>[] = [];
  classTeacherTableConfig!: DataTableConfig;

  private classGroupOptions: { label: string; value: string }[] = [];
  private sectionOptions: { label: string; value: string }[] = [];

  readonly tabs = [
    { label: 'Teacher info' },
    { label: 'Class & subject rights' },
    { label: 'Class teacher' },
  ];

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
    this.currentTab = Math.max(0, Math.min(2, this.initialTab || 0));
    this.assignmentTableConfig = this.buildAssignmentTableConfig();
    this.classTeacherTableConfig = this.buildClassTeacherTableConfig();
    this.loadTeacher();
    this.loadClassGroups();
    this.loadSections();
    this.loadAssignments();
    this.loadClassTeacherAssignments();
  }

  goTab(index: number): void {
    this.currentTab = index;
  }

  private buildAssignmentTableConfig(): DataTableConfig {
    return {
      header: {
        title: 'Class & subject rights',
        subtitle: 'Expand a class group to see assigned subjects',
        syncPageChrome: false,
        showAddButton: this.canEdit,
        addButtonText: 'Assign permission',
        addButtonIcon: 'add',
        addButtonClass: 'btn-primary',
      },
      columns: [
        { key: 'classGroupName', label: 'Class group', sortable: true },
        { key: 'subjectCountLabel', label: 'Subjects', sortable: false },
      ],
      filters: [
        {
          label: 'All',
          icon: 'list',
          value: 'all',
          filterFn: () => true,
        },
        {
          label: 'Active',
          icon: 'check_circle',
          value: 'active',
          filterFn: (row) => Number(row['activeCount'] ?? 0) > 0,
        },
        {
          label: 'Inactive',
          icon: 'cancel',
          value: 'inactive',
          filterFn: (row) => Number(row['inactiveCount'] ?? 0) > 0,
        },
      ],
      actions: [],
      expandableRows: true,
      expandRowKey: 'classGroupId',
      expandAccordion: false,
      selectable: false,
      showExport: false,
      searchPlaceholder: 'Search class group or subject...',
      searchKeys: ['classGroupName', 'subjectSearch'],
      itemLabel: 'class groups',
      defaultPageSize: 10,
      pageSizeOptions: [10, 25, 50],
    };
  }

  private buildClassTeacherTableConfig(): DataTableConfig {
    return {
      header: {
        title: 'Class teacher',
        subtitle: 'Classes where this teacher is the class teacher',
        syncPageChrome: false,
        showAddButton: this.canEdit,
        addButtonText: 'Assign class teacher',
        addButtonIcon: 'add',
        addButtonClass: 'btn-primary',
      },
      columns: [{ key: 'className', label: 'Class', sortable: true }],
      actions: this.canEdit
        ? [
            {
              label: 'Remove',
              icon: 'delete',
              iconColor: '#a32d2d',
            },
          ]
        : [],
      selectable: false,
      showExport: false,
      searchPlaceholder: 'Search class...',
      searchKeys: ['className'],
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

  private loadClassGroups(): void {
    const yearId = this.ayContext.effectiveYearId() || undefined;
    this.classService.getClassDropdown(yearId, 'group').subscribe({
      next: (rows) => {
        this.classGroupOptions = (rows || []).map((c: any) => ({
          label: String(c.name ?? c.Name ?? ''),
          value: String(c.id ?? c.Id ?? ''),
        }));
      },
    });
  }

  private loadSections(): void {
    const yearId = this.ayContext.effectiveYearId() || undefined;
    this.classService.getClassDropdown(yearId).subscribe({
      next: (rows) => {
        this.sectionOptions = (rows || []).map((c: any) => ({
          label: String(c.name ?? c.Name ?? ''),
          value: String(c.id ?? c.Id ?? ''),
        }));
      },
    });
  }

  private loadAssignments(): void {
    const yearId = this.ayContext.effectiveYearId() || undefined;
    this.mappingService.getByEmployee(this.teacherId, yearId).subscribe({
      next: (rows) => {
        this.classGroups = this.toExpandableRows(rows);
        this.cdr.detectChanges();
      },
      error: () => {
        this.classGroups = [];
        this.snackBar.open('Failed to load class / subject rights', 'Close', {
          duration: 3000,
          panelClass: 'snack-error',
        });
        this.cdr.detectChanges();
      },
    });
  }

  private loadClassTeacherAssignments(): void {
    this.classSettingsService.getByTeacher(this.teacherId).subscribe({
      next: (rows) => {
        this.classTeacherRows = (rows || []).map((r) => ({
          id: r.id,
          classId: r.classId,
          className: r.className || 'Class',
          classGroupId: r.classGroupId,
          teacherId: r.teacherId,
        }));
        this.cdr.detectChanges();
      },
      error: () => {
        this.classTeacherRows = [];
        this.snackBar.open('Failed to load class teacher assignments', 'Close', {
          duration: 3000,
          panelClass: 'snack-error',
        });
        this.cdr.detectChanges();
      },
    });
  }

  private toExpandableRows(
    rows: {
      id: string;
      classGroupId: string;
      classGroupName: string;
      subjectId: string;
      subjectName: string;
      isActive: boolean;
    }[],
  ): Record<string, unknown>[] {
    const byGroup = new Map<string, typeof rows>();
    for (const row of rows) {
      if (!row.classGroupId) continue;
      const list = byGroup.get(row.classGroupId) ?? [];
      list.push(row);
      byGroup.set(row.classGroupId, list);
    }

    return Array.from(byGroup.entries())
      .map(([classGroupId, subjects]) => {
        const classGroupName = subjects[0]?.classGroupName || 'Class group';
        const activeCount = subjects.filter((s) => s.isActive).length;
        const inactiveCount = subjects.length - activeCount;
        const subjectRows = subjects
          .map((s) => ({
            id: s.id,
            classGroupId: s.classGroupId,
            classGroupName,
            subjectId: s.subjectId,
            subjectName: s.subjectName || s.subjectId,
            isActive: s.isActive,
            statusLabel: s.isActive ? 'Active' : 'Inactive',
          }))
          .sort((a, b) => {
            if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
            return a.subjectName.localeCompare(b.subjectName);
          });

        let subjectCountLabel = `${subjects.length} subject${subjects.length === 1 ? '' : 's'}`;
        if (inactiveCount > 0 && activeCount > 0) {
          subjectCountLabel = `${activeCount} active · ${inactiveCount} inactive`;
        } else if (inactiveCount > 0 && activeCount === 0) {
          subjectCountLabel = `${inactiveCount} inactive`;
        }

        return {
          classGroupId,
          classGroupName,
          activeCount,
          inactiveCount,
          subjectCount: subjects.length,
          subjectCountLabel,
          subjectSearch: subjectRows.map((s) => s.subjectName).join(' '),
          subjects: subjectRows,
        };
      })
      .sort((a, b) => String(a.classGroupName).localeCompare(String(b.classGroupName)));
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

    if (!this.classGroupOptions.length) {
      this.snackBar.open('No class groups available', 'Close', {
        duration: 3000,
        panelClass: 'snack-error',
      });
      return;
    }

    const data: AssignClassSubjectDialogData = {
      teacherId: this.teacherId,
      teacherName: this.teacherName,
      academicYearId: yearId,
      classes: this.classGroupOptions.map((c) => ({
        id: c.value,
        name: c.label,
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

  openAssignClassTeacherDialog(): void {
    if (!this.canEdit) return;

    if (!this.sectionOptions.length) {
      this.snackBar.open('No classes available', 'Close', {
        duration: 3000,
        panelClass: 'snack-error',
      });
      return;
    }

    const assigned = new Set(this.classTeacherRows.map((r) => String(r['classId'] ?? '')));
    const available = this.sectionOptions.filter((c) => !assigned.has(c.value));
    if (!available.length) {
      this.snackBar.open('This teacher is already class teacher for all classes', 'Close', {
        duration: 3000,
        panelClass: 'snack-error',
      });
      return;
    }

    const data: FormDialogData = {
      title: 'Assign class teacher',
      subtitle: `Set ${this.teacherName || 'this teacher'} as class teacher for a class.`,
      saveLabel: 'Assign',
      sectionTitle: 'Class',
      sectionIcon: 'school',
      layout: 'grid1',
      width: ERP_FORM_DIALOG_WIDTH,
      fields: [
        {
          type: 'select',
          controlName: 'classId',
          label: 'Class',
          placeholder: SELECT_PLACEHOLDER,
          options: available.map((c) => ({ label: c.label, value: c.value })),
          validations: [
            { name: 'required', message: 'Class is required', validator: Validators.required },
          ],
        },
      ],
      initialValue: { classId: '' },
    };

    this.dialog
      .open(FormDialogComponent, {
        data,
        panelClass: 'erp-dialog',
        disableClose: true,
        width: ERP_FORM_DIALOG_WIDTH,
        maxWidth: '94vw',
      })
      .afterClosed()
      .subscribe((value) => {
        if (!value) return;
        const classId = String(value['classId'] ?? '').trim();
        if (!classId) return;

        this.classSettingsService
          .assignClassTeacher({ employeeId: this.teacherId, classId })
          .subscribe({
            next: () => {
              this.snackBar.open('Class teacher assigned', 'Close', {
                duration: 2500,
                panelClass: 'snack-success',
              });
              this.loadClassTeacherAssignments();
            },
            error: (err) =>
              this.snackBar.open(getUserFacingApiError(err, 'Failed to assign'), 'Close', {
                duration: 3500,
                panelClass: 'snack-error',
              }),
          });
      });
  }

  onClassTeacherAction(event: {
    action: DataTableAction;
    row: Record<string, unknown>;
  }): void {
    if (event.action.label === 'Remove') {
      this.removeClassTeacher(event.row);
    }
  }

  removeClassTeacher(row: Record<string, unknown>): void {
    if (!this.canEdit) return;
    const classId = String(row['classId'] ?? '');
    if (!classId) return;

    const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
      data: {
        title: 'Remove class teacher?',
        description: 'This teacher will no longer be the class teacher for the selected class.',
        recordName: String(row['className'] ?? 'Class'),
        recordMeta: 'Class teacher',
        initials: 'CT',
        warningMessage: 'You can assign a class teacher again later.',
      },
      panelClass: 'erp-dialog',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.classSettingsService.clearClassTeacher(classId, this.teacherId).subscribe({
        next: () => {
          this.snackBar.open('Class teacher removed', 'Close', {
            duration: 2500,
            panelClass: 'snack-success',
          });
          this.loadClassTeacherAssignments();
        },
        error: (err) =>
          this.snackBar.open(getUserFacingApiError(err, 'Failed to remove'), 'Close', {
            duration: 3500,
            panelClass: 'snack-error',
          }),
      });
    });
  }

  removeSubject(subject: Record<string, unknown>): void {
    if (!this.canEdit) return;
    const id = String(subject['id'] ?? '');
    if (!id) return;

    const isActive = subject['isActive'] !== false;
    if (!isActive) {
      this.snackBar.open('This subject permission is already inactive', 'Close', {
        duration: 2500,
        panelClass: 'snack-error',
      });
      return;
    }

    const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
      data: {
        title: 'Remove permission?',
        description: 'This subject permission will be marked inactive. You can see it under Inactive.',
        recordName: `${subject['classGroupName']} · ${subject['subjectName']}`,
        recordMeta: 'Subject permission',
        initials: 'TR',
      },
      panelClass: 'erp-dialog',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.mappingService.delete(id).subscribe({
        next: () => {
          this.snackBar.open('Permission marked inactive', 'Close', {
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

  reactivateSubject(subject: Record<string, unknown>): void {
    if (!this.canEdit) return;
    const id = String(subject['id'] ?? '');
    if (!id || subject['isActive'] !== false) return;

    this.mappingService.update(id, { isActive: true }).subscribe({
      next: () => {
        this.snackBar.open('Permission reactivated', 'Close', {
          duration: 2500,
          panelClass: 'snack-success',
        });
        this.loadAssignments();
      },
      error: (err) =>
        this.snackBar.open(getUserFacingApiError(err, 'Failed to reactivate'), 'Close', {
          duration: 3500,
          panelClass: 'snack-error',
        }),
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
