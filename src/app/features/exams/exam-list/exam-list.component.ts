import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { NotificationService } from '../../../core/services/notification.service';
import { PermissionService } from '../../../core/services/permission.service';
import { MenuCodes } from '../../../core/constants/menu-codes';
import { DeleteConfirmDialogComponent } from '../../../shared/components/delete-confirm-dialog/delete-confirm-dialog.component';
import { SmartDataTableComponent } from '../../../shared/components/smart-data-table';
import type {
  DataTableAction,
  DataTableConfig,
} from '../../../shared/components/smart-data-table';
import { ActionButtonComponent } from '../../../shared/components/action-button/action-button.component';
import { MultiSelectChipsComponent } from '../../../shared/components/multi-select-chips/multi-select-chips.component';
import { PageChromeDirective } from '../../../shared/directives/page-chrome.directive';
import { FormFieldComponent } from '../../../shared/form-controls/form-field';
import type { FormFieldOption } from '../../../shared/form-controls/form-field';
import { applyModuleTablePermissions } from '../../../core/utils/permission-ui.util';
import { AcademicYearContextService } from '../../../core/services/academic-year-context.service';
import { ClassService } from '../../../core/services/class.service';
import { MappingOption } from '../../../shared/mapping/mapping.types';
import {
  ExamService,
  ExamGroup,
  ExamGradeScale,
  ExamListItem,
  ExamStatus,
  ExamMarkComponent,
} from '../../../core/services/exam.service';

interface ComponentRowDraft {
  id?: string | null;
  name: string;
  maxMarks: number | null;
  passingMarks: number | null;
}

const EXAM_TYPES = [
  'Unit Test',
  'Mid Term',
  'Quarterly',
  'Half Yearly',
  'Annual',
  'Pre-Board',
  'Practice Test',
  'Other',
];

@Component({
  selector: 'app-exam-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatDialogModule,
    SmartDataTableComponent,
    ActionButtonComponent,
    MultiSelectChipsComponent,
    PageChromeDirective,
    FormFieldComponent,
  ],
  templateUrl: './exam-list.component.html',
  styleUrl: './exam-list.component.css',
})
export class ExamListComponent implements OnInit {
  private examService = inject(ExamService);
  private classService = inject(ClassService);
  private snackBar = inject(NotificationService);
  private dialog = inject(MatDialog);
  private permissions = inject(PermissionService);
  private ayContext = inject(AcademicYearContextService);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  ExamStatus = ExamStatus;
  examTypes = EXAM_TYPES;
  readonly examTypeOptions: FormFieldOption[] = EXAM_TYPES.map((t) => ({ label: t, value: t }));

  rows: Record<string, unknown>[] = [];
  groups: ExamGroup[] = [];
  gradeScales: ExamGradeScale[] = [];
  classOptions: MappingOption[] = [];
  tableConfig!: DataTableConfig;

  filterGroupId = '';
  filterClassId = '';

  get groupFilterOptions(): FormFieldOption[] {
    return this.groups.map((g) => ({ label: g.name, value: g.id }));
  }

  get classFilterOptions(): FormFieldOption[] {
    return this.classOptions.map((c) => ({ label: c.name, value: c.id }));
  }

  get gradeScaleOptions(): FormFieldOption[] {
    return this.gradeScales.map((s) => ({ label: s.name, value: s.id }));
  }

  showForm = false;
  formMode: 'add' | 'edit' = 'add';
  editingId: string | null = null;
  formError = '';
  saving = false;

  formGroupId = '';
  formName = '';
  formExamType = 'Unit Test';
  formStartDate = '';
  formEndDate = '';
  formMinPassPercent: number | null = 33;
  formGradeScaleId = '';
  formDescription = '';
  formClassIds: string[] = [];
  componentRows: ComponentRowDraft[] = [];

  private readonly baseTableConfig: DataTableConfig = {
    header: {
      title: 'Exams',
      subtitle: 'Create exams inside a group, assign classes and mark components',
      showAddButton: true,
      addButtonText: 'Create exam',
      addButtonIcon: 'add',
      addButtonClass: 'btn-primary',
    },
    columns: [
      {
        key: 'exam',
        label: 'Exam',
        sortable: true,
        cellType: 'avatar',
        toggleable: false,
        avatarConfig: { nameKey: 'name', subtitleKey: 'examType' },
      },
      { key: 'examGroupName', label: 'Group', sortable: true },
      { key: 'classesLabel', label: 'Classes' },
      { key: 'dateRange', label: 'Dates', sortable: true },
      { key: 'totalMaxMarks', label: 'Max marks', sortable: true },
      {
        key: 'statusLabel',
        label: 'Status',
        cellType: 'badge',
        badgeMap: {
          Draft: { cssClass: 'b-gray', label: 'Draft' },
          Scheduled: { cssClass: 'b-purple', label: 'Scheduled' },
          Ongoing: { cssClass: 'b-amber', label: 'Ongoing' },
          Completed: { cssClass: 'b-blue', label: 'Completed' },
          'Result Declared': { cssClass: 'b-green', label: 'Result Declared' },
        },
      },
    ],
    filtersInPanel: true,
    filters: [
      { label: 'All', icon: 'list', value: 'All' },
      {
        label: 'Draft',
        icon: 'edit_note',
        value: 'Draft',
        filterFn: (row) => row['status'] === ExamStatus.Draft,
      },
      {
        label: 'Scheduled',
        icon: 'event_available',
        value: 'Scheduled',
        filterFn: (row) => row['status'] === ExamStatus.Scheduled,
      },
      {
        label: 'Ongoing',
        icon: 'play_circle',
        value: 'Ongoing',
        filterFn: (row) => row['status'] === ExamStatus.Ongoing,
      },
      {
        label: 'Completed',
        icon: 'task_alt',
        value: 'Completed',
        filterFn: (row) => row['status'] === ExamStatus.Completed,
      },
      {
        label: 'Results',
        icon: 'verified',
        value: 'Result Declared',
        filterFn: (row) => row['status'] === ExamStatus.ResultDeclared,
      },
    ],
    actions: [
      { label: 'Mark scheduled', icon: 'event_available', iconColor: '#639922' },
      { label: 'Mark ongoing', icon: 'play_circle', iconColor: '#B45309' },
      { label: 'Mark completed', icon: 'task_alt', iconColor: '#1E40AF' },
      { label: 'Edit', icon: 'edit', iconColor: '#1E40AF' },
      { label: 'Delete', icon: 'delete', danger: true, separatorBefore: true },
    ],
    actionVisibleFn: (action, row) => this.isExamActionVisible(action, row),
    searchPlaceholder: 'Search exams...',
    searchKeys: ['name', 'examType', 'examGroupName', 'classesLabel'],
    itemLabel: 'exams',
    defaultPageSize: 10,
    pageSizeOptions: [10, 25, 50],
    selectable: false,
    showExport: false,
  };

  get totalMaxMarks(): number {
    return this.componentRows.reduce((sum, row) => sum + (row.maxMarks ?? 0), 0);
  }

  ngOnInit(): void {
    this.tableConfig = applyModuleTablePermissions(
      this.baseTableConfig,
      this.permissions,
      MenuCodes.Exams,
      this.ayContext.isReadOnlyScope(),
    );
    const groupId = this.route.snapshot.queryParamMap.get('groupId');
    if (groupId) {
      this.filterGroupId = groupId;
    }
    this.loadDropdowns();
    this.loadList();
  }

  loadDropdowns(): void {
    this.examService.getGroups().subscribe({
      next: (groups) => {
        this.groups = groups ?? [];
        this.cdr.detectChanges();
      },
    });
    this.examService.getGradeScales().subscribe({
      next: (scales) => {
        this.gradeScales = scales ?? [];
        this.cdr.detectChanges();
      },
    });
    this.classService.getClassDropdown().subscribe({
      next: (classes) => {
        this.classOptions = (classes ?? []).map((c: { id: string; name: string }) => ({
          id: c.id,
          name: c.name,
        }));
        this.cdr.detectChanges();
      },
    });
  }

  loadList(): void {
    this.examService
      .getExams({
        groupId: this.filterGroupId || undefined,
        classId: this.filterClassId || undefined,
      })
      .subscribe({
        next: (exams) => {
          this.rows = (exams ?? []).map((exam: ExamListItem) => ({
            ...exam,
            exam: exam.name,
            classesLabel: this.classNames(exam) || '—',
            dateRange: this.formatDateRange(exam.startDate, exam.endDate),
          }));
          this.cdr.detectChanges();
        },
        error: () => {
          this.rows = [];
          this.snackBar.open('Failed to load exams', 'Close', {
            duration: 3000,
            panelClass: 'snack-error',
          });
          this.cdr.detectChanges();
        },
      });
  }

  classNames(exam: ExamListItem): string {
    return (exam.classes ?? []).map((c) => c.className).join(', ');
  }

  formatDateRange(start: string, end: string): string {
    const fmt = (d: string) => {
      if (!d) return '—';
      const date = new Date(d);
      if (Number.isNaN(date.getTime())) return d.substring(0, 10);
      return date.toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    };
    return `${fmt(start)} – ${fmt(end)}`;
  }

  isExamActionVisible(action: DataTableAction, row: Record<string, unknown>): boolean {
    const status = row['status'] as ExamStatus;
    const resultDeclared = !!row['resultDeclared'];
    if (action.label === 'Mark scheduled') return status === ExamStatus.Draft;
    if (action.label === 'Mark ongoing') return status === ExamStatus.Scheduled;
    if (action.label === 'Mark completed') return status === ExamStatus.Ongoing;
    if (action.label === 'Edit' || action.label === 'Delete') return !resultDeclared;
    return true;
  }

  onAddButtonClicked(): void {
    this.formMode = 'add';
    this.editingId = null;
    this.formGroupId = this.filterGroupId || this.groups[0]?.id || '';
    this.formName = '';
    this.formExamType = 'Unit Test';
    this.formStartDate = '';
    this.formEndDate = '';
    this.formMinPassPercent = 33;
    this.formGradeScaleId = '';
    this.formDescription = '';
    this.formClassIds = [];
    this.componentRows = [
      { name: 'Theory', maxMarks: 70, passingMarks: 23 },
      { name: 'Practical', maxMarks: 20, passingMarks: 7 },
      { name: 'Oral', maxMarks: 10, passingMarks: 3 },
    ];
    this.formError = '';
    this.showForm = true;
  }

  onActionClicked(event: {
    action: DataTableAction;
    row: Record<string, unknown>;
    rowIndex: number;
  }): void {
    const exam = event.row as unknown as ExamListItem;
    switch (event.action.label) {
      case 'Edit':
        this.openEdit(exam);
        break;
      case 'Delete':
        this.deleteExam(exam);
        break;
      case 'Mark scheduled':
        this.setStatus(exam, ExamStatus.Scheduled);
        break;
      case 'Mark ongoing':
        this.setStatus(exam, ExamStatus.Ongoing);
        break;
      case 'Mark completed':
        this.setStatus(exam, ExamStatus.Completed);
        break;
    }
  }

  openEdit(exam: ExamListItem): void {
    this.examService.getExam(exam.id).subscribe({
      next: (detail) => {
        this.formMode = 'edit';
        this.editingId = detail.id;
        this.formGroupId = detail.examGroupId;
        this.formName = detail.name;
        this.formExamType = detail.examType;
        this.formStartDate = detail.startDate?.substring(0, 10) ?? '';
        this.formEndDate = detail.endDate?.substring(0, 10) ?? '';
        this.formMinPassPercent = detail.minPassPercent;
        this.formGradeScaleId = detail.gradeScaleId ?? '';
        this.formDescription = detail.description ?? '';
        this.formClassIds = [...(detail.classIds ?? [])];
        this.componentRows = (detail.components ?? []).map((c: ExamMarkComponent) => ({
          id: c.id,
          name: c.name,
          maxMarks: c.maxMarks,
          passingMarks: c.passingMarks ?? null,
        }));
        this.formError = '';
        this.showForm = true;
        this.cdr.detectChanges();
      },
      error: () =>
        this.snackBar.open('Failed to load exam', 'Close', {
          duration: 3000,
          panelClass: 'snack-error',
        }),
    });
  }

  closeForm(): void {
    this.showForm = false;
    this.editingId = null;
    this.formError = '';
  }

  addComponentRow(): void {
    this.componentRows.push({ name: '', maxMarks: null, passingMarks: null });
  }

  removeComponentRow(index: number): void {
    this.componentRows.splice(index, 1);
  }

  private validate(): string | null {
    if (!this.formGroupId) return 'Select an exam group.';
    if (!this.formName.trim()) return 'Exam name is required.';
    if (!this.formStartDate || !this.formEndDate) return 'Start and end dates are required.';
    if (this.formEndDate < this.formStartDate) return 'End date cannot be before start date.';
    if (!this.formClassIds.length) return 'Select at least one class.';
    if (!this.componentRows.length) return 'Add at least one mark component.';
    for (const row of this.componentRows) {
      if (!row.name.trim()) return 'Every mark component needs a name.';
      if (!row.maxMarks || row.maxMarks <= 0) {
        return `Component '${row.name}' needs max marks greater than 0.`;
      }
      if (row.passingMarks !== null && row.passingMarks > row.maxMarks) {
        return `Component '${row.name}' passing marks cannot exceed max marks.`;
      }
    }
    if (
      this.formMinPassPercent === null ||
      this.formMinPassPercent < 0 ||
      this.formMinPassPercent > 100
    ) {
      return 'Minimum pass percent must be between 0 and 100.';
    }
    return null;
  }

  save(): void {
    const error = this.validate();
    if (error) {
      this.formError = error;
      return;
    }

    const payload = {
      examGroupId: this.formGroupId,
      name: this.formName.trim(),
      examType: this.formExamType,
      academicPeriodId: null,
      startDate: this.formStartDate,
      endDate: this.formEndDate,
      minPassPercent: this.formMinPassPercent ?? 33,
      gradeScaleId: this.formGradeScaleId || null,
      description: this.formDescription.trim() || null,
      classIds: this.formClassIds,
      components: this.componentRows.map((row, i) => ({
        id: row.id ?? null,
        name: row.name.trim(),
        maxMarks: row.maxMarks ?? 0,
        passingMarks: row.passingMarks,
        displayOrder: i,
      })),
    };

    this.saving = true;
    const request =
      this.formMode === 'edit' && this.editingId
        ? this.examService.updateExam(this.editingId, payload)
        : this.examService.createExam(payload);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.snackBar.open(this.formMode === 'edit' ? 'Exam updated' : 'Exam created', 'Close', {
          duration: 2500,
          panelClass: 'snack-success',
        });
        this.closeForm();
        this.loadList();
        this.loadDropdowns();
      },
      error: (err) => {
        this.saving = false;
        this.formError = typeof err?.error === 'string' ? err.error : 'Failed to save exam';
        this.cdr.detectChanges();
      },
    });
  }

  setStatus(exam: ExamListItem, status: ExamStatus): void {
    this.examService.updateExamStatus(exam.id, status).subscribe({
      next: () => {
        this.snackBar.open('Exam status updated', 'Close', {
          duration: 2500,
          panelClass: 'snack-success',
        });
        this.loadList();
      },
      error: (err) =>
        this.snackBar.open(
          typeof err?.error === 'string' ? err.error : 'Status update failed',
          'Close',
          { duration: 3000, panelClass: 'snack-error' },
        ),
    });
  }

  deleteExam(exam: ExamListItem): void {
    const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
      data: {
        title: 'Delete exam?',
        description: 'The exam, its schedule and mark components will be removed.',
        recordName: exam.name,
        recordMeta: `${exam.examGroupName} · ${this.classNames(exam)}`,
        initials: 'EX',
        warningMessage: 'Marks entered against this exam will no longer be accessible.',
        confirmButtonText: 'Yes, delete',
        cancelButtonText: 'Cancel',
      },
      panelClass: 'erp-dialog',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.examService.deleteExam(exam.id).subscribe({
        next: () => {
          this.snackBar.open('Exam deleted', 'Close', {
            duration: 2500,
            panelClass: 'snack-success',
          });
          this.loadList();
        },
        error: (err) =>
          this.snackBar.open(
            typeof err?.error === 'string' ? err.error : 'Delete failed',
            'Close',
            { duration: 3500, panelClass: 'snack-error' },
          ),
      });
    });
  }
}
