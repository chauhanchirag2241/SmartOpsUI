import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
import { PageChromeDirective } from '../../../shared/directives/page-chrome.directive';
import { FormFieldComponent } from '../../../shared/form-controls/form-field';
import type { FormFieldOption } from '../../../shared/form-controls/form-field';
import { MultiSelectChipsComponent } from '../../../shared/components/multi-select-chips/multi-select-chips.component';
import { MappingOption } from '../../../shared/mapping/mapping.types';
import { applyModuleTablePermissions } from '../../../core/utils/permission-ui.util';
import { AcademicYearContextService } from '../../../core/services/academic-year-context.service';
import { ClassService } from '../../../core/services/class.service';
import {
  ExamService,
  ExamGroup,
  ExamGradeScale,
  ExamEvaluationType,
} from '../../../core/services/exam.service';

@Component({
  selector: 'app-exam-groups',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatDialogModule,
    SmartDataTableComponent,
    ActionButtonComponent,
    PageChromeDirective,
    FormFieldComponent,
    MultiSelectChipsComponent,
  ],
  templateUrl: './exam-groups.component.html',
  styleUrl: './exam-groups.component.css',
})
export class ExamGroupsComponent implements OnInit {
  private examService = inject(ExamService);
  private classService = inject(ClassService);
  private snackBar = inject(NotificationService);
  private dialog = inject(MatDialog);
  private permissions = inject(PermissionService);
  private ayContext = inject(AcademicYearContextService);
  private cdr = inject(ChangeDetectorRef);

  ExamEvaluationType = ExamEvaluationType;

  rows: Record<string, unknown>[] = [];
  gradeScales: ExamGradeScale[] = [];
  classGroupOptions: MappingOption[] = [];
  tableConfig!: DataTableConfig;

  showForm = false;
  formMode: 'add' | 'edit' | 'view' = 'add';
  editingId: string | null = null;
  formError = '';
  saving = false;

  formName = '';
  formDescription = '';
  formGradeScaleId = '';
  formEvaluationType: ExamEvaluationType = ExamEvaluationType.Marks;
  formClassGroupIds: string[] = [];

  readonly evaluationTypeOptions: FormFieldOption[] = [
    { label: 'Marks', value: ExamEvaluationType.Marks },
    { label: 'Grade', value: ExamEvaluationType.Grade },
    { label: 'Marks & Grade', value: ExamEvaluationType.Both },
  ];

  get gradeScaleOptions(): FormFieldOption[] {
    return this.gradeScales.map((s) => ({ label: s.name, value: s.id }));
  }

  get formTitle(): string {
    if (this.formMode === 'view') return 'View exam group';
    if (this.formMode === 'edit') return 'Edit exam group';
    return 'New exam group';
  }

  get formReadOnly(): boolean {
    return this.formMode === 'view';
  }

  private readonly baseTableConfig: DataTableConfig = {
    header: {
      title: 'Exam Groups',
      subtitle: 'Group exams like "Term 1 Exams 2025-26" — each group holds multiple exams',
      showAddButton: true,
      addButtonText: 'New exam group',
      addButtonIcon: 'add',
      addButtonClass: 'btn-primary',
    },
    columns: [
      {
        key: 'group',
        label: 'Group',
        sortable: true,
        cellType: 'avatar',
        toggleable: false,
        avatarConfig: { nameKey: 'name', subtitleKey: 'description' },
      },
      {
        key: 'classGroupNames',
        label: 'Class groups',
        sortable: true,
      },
      {
        key: 'evaluationTypeLabel',
        label: 'Evaluation',
        cellType: 'badge',
        badgeMap: {
          Marks: { cssClass: 'b-blue', label: 'Marks' },
          Grade: { cssClass: 'b-purple', label: 'Grade' },
          'Marks & Grade': { cssClass: 'b-teal', label: 'Marks & Grade' },
          Both: { cssClass: 'b-teal', label: 'Marks & Grade' },
        },
      },
      { key: 'gradeScaleName', label: 'Grade scale' },
      { key: 'examCountLabel', label: 'Exams', sortable: true },
    ],
    actions: [
      { label: 'View', icon: 'visibility', iconColor: '#639922', permission: 'view' },
      { label: 'Edit', icon: 'edit', iconColor: '#1E40AF' },
      { label: 'Delete', icon: 'delete', danger: true, separatorBefore: true },
    ],
    searchPlaceholder: 'Search exam groups...',
    searchKeys: ['name', 'description', 'gradeScaleName', 'classGroupNames'],
    itemLabel: 'groups',
    defaultPageSize: 10,
    pageSizeOptions: [10, 25, 50],
    selectable: false,
    showExport: false,
  };

  ngOnInit(): void {
    this.tableConfig = applyModuleTablePermissions(
      this.baseTableConfig,
      this.permissions,
      MenuCodes.ExamGroups,
      this.ayContext.isReadOnlyScope(),
    );
    this.loadClassGroups();
    this.load();
    this.examService.getGradeScales().subscribe({
      next: (scales) => {
        this.gradeScales = scales ?? [];
        this.cdr.detectChanges();
      },
    });
  }

  load(): void {
    this.examService.getGroups().subscribe({
      next: (groups) => {
        this.rows = (groups ?? []).map((g: ExamGroup) => ({
          ...g,
          group: g.name,
          description: g.description || '—',
          gradeScaleName: g.gradeScaleName || '—',
          classGroupNames: g.classGroupNames || '—',
          evaluationTypeLabel: g.evaluationTypeLabel || 'Marks',
          examCountLabel: `${g.examCount} exam${g.examCount === 1 ? '' : 's'}`,
        }));
        this.cdr.detectChanges();
      },
      error: () => {
        this.snackBar.open('Failed to load exam groups', 'Close', {
          duration: 3000,
          panelClass: 'snack-error',
        });
        this.cdr.detectChanges();
      },
    });
  }

  private loadClassGroups(): void {
    this.classService.getClassDropdown(undefined, 'group').subscribe({
      next: (rows) => {
        this.classGroupOptions = (rows || []).map((c: { id: string; name?: string }) => ({
          id: String(c.id),
          name: String(c.name ?? ''),
        }));
        this.cdr.detectChanges();
      },
    });
  }

  onAddButtonClicked(): void {
    this.formMode = 'add';
    this.editingId = null;
    this.formName = '';
    this.formDescription = '';
    this.formGradeScaleId = this.gradeScales.find((s) => s.isDefault)?.id ?? '';
    this.formEvaluationType = ExamEvaluationType.Marks;
    this.formClassGroupIds = [];
    this.formError = '';
    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
    this.editingId = null;
    this.formError = '';
  }

  onActionClicked(event: {
    action: DataTableAction;
    row: Record<string, unknown>;
    rowIndex: number;
  }): void {
    const group = event.row as unknown as ExamGroup;
    if (event.action.label === 'View') {
      this.openGroupForm(group, 'view');
    } else if (event.action.label === 'Edit') {
      this.openGroupForm(group, 'edit');
    } else if (event.action.label === 'Delete') {
      this.deleteGroup(group);
    }
  }

  private openGroupForm(group: ExamGroup, mode: 'view' | 'edit'): void {
    this.formMode = mode;
    this.editingId = group.id;
    this.formName = group.name;
    this.formDescription = group.description ?? '';
    this.formGradeScaleId = group.gradeScaleId ?? '';
    this.formEvaluationType = this.normalizeEvaluationType(group.evaluationType);
    this.formClassGroupIds = (group.classGroupIds ?? []).map((id) => String(id));
    this.formError = '';
    this.showForm = true;
  }

  /** API may send enum as number or JsonStringEnumConverter string ("Marks"). */
  private normalizeEvaluationType(value: unknown): ExamEvaluationType {
    if (typeof value === 'number' && value >= 0 && value <= 2) {
      return value as ExamEvaluationType;
    }
    if (typeof value === 'string') {
      const asNum = Number(value);
      if (!Number.isNaN(asNum) && asNum >= 0 && asNum <= 2) {
        return asNum as ExamEvaluationType;
      }
      const key = value.trim();
      if (key === 'Grade') return ExamEvaluationType.Grade;
      if (key === 'Both' || key === 'Marks & Grade') return ExamEvaluationType.Both;
      if (key === 'Marks') return ExamEvaluationType.Marks;
    }
    return ExamEvaluationType.Marks;
  }

  save(): void {
    if (this.formReadOnly) return;
    if (!this.formName.trim()) {
      this.formError = 'Group name is required.';
      return;
    }
    if (
      this.formEvaluationType === null ||
      this.formEvaluationType === undefined ||
      Number.isNaN(Number(this.formEvaluationType))
    ) {
      this.formError = 'Evaluation type is required.';
      return;
    }

    const payload = {
      name: this.formName.trim(),
      description: this.formDescription.trim() || null,
      gradeScaleId: this.formGradeScaleId || null,
      evaluationType: this.normalizeEvaluationType(this.formEvaluationType),
      classGroupIds: this.formClassGroupIds,
    };

    this.saving = true;
    const request =
      this.formMode === 'edit' && this.editingId
        ? this.examService.updateGroup(this.editingId, payload)
        : this.examService.createGroup(payload);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.snackBar.open(
          this.formMode === 'edit' ? 'Exam group updated' : 'Exam group created',
          'Close',
          { duration: 2500, panelClass: 'snack-success' },
        );
        this.closeForm();
        this.load();
      },
      error: (err) => {
        this.saving = false;
        this.formError = typeof err?.error === 'string' ? err.error : 'Failed to save exam group';
        this.cdr.detectChanges();
      },
    });
  }

  deleteGroup(group: ExamGroup): void {
    const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
      data: {
        title: 'Delete exam group?',
        description: 'This exam group will be removed.',
        recordName: group.name,
        recordMeta: `${group.examCount} exam(s)`,
        initials: 'EG',
        warningMessage: 'Groups that still contain exams cannot be deleted.',
        confirmButtonText: 'Yes, delete',
        cancelButtonText: 'Cancel',
      },
      panelClass: 'erp-dialog',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.examService.deleteGroup(group.id).subscribe({
        next: () => {
          this.snackBar.open('Exam group deleted', 'Close', {
            duration: 2500,
            panelClass: 'snack-success',
          });
          this.load();
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
