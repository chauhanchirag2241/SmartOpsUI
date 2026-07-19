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
import { applyModuleTablePermissions } from '../../../core/utils/permission-ui.util';
import { AcademicYearContextService } from '../../../core/services/academic-year-context.service';
import {
  ExamService,
  ExamGradeScale,
  ExamGradeScaleDetail,
} from '../../../core/services/exam.service';

interface GradeRowDraft {
  id?: string | null;
  grade: string;
  minPercent: number | null;
  maxPercent: number | null;
  gradePoint: number | null;
  description: string;
}

@Component({
  selector: 'app-grade-setup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatDialogModule,
    SmartDataTableComponent,
    ActionButtonComponent,
  ],
  templateUrl: './grade-setup.component.html',
  styleUrl: './grade-setup.component.css',
})
export class GradeSetupComponent implements OnInit {
  private examService = inject(ExamService);
  private snackBar = inject(NotificationService);
  private dialog = inject(MatDialog);
  private permissions = inject(PermissionService);
  private ayContext = inject(AcademicYearContextService);
  private cdr = inject(ChangeDetectorRef);

  scales: ExamGradeScale[] = [];
  rows: Record<string, unknown>[] = [];
  tableConfig!: DataTableConfig;

  showForm = false;
  formMode: 'add' | 'edit' = 'add';
  editingId: string | null = null;
  formError = '';
  saving = false;

  formName = '';
  formDescription = '';
  formIsDefault = false;
  gradeRows: GradeRowDraft[] = [];

  private readonly baseTableConfig: DataTableConfig = {
    header: {
      title: 'Grade Setup',
      subtitle: 'Dynamic grading scales with percentage bands for exam results',
      showAddButton: true,
      addButtonText: 'New grade scale',
      addButtonIcon: 'add',
      addButtonClass: 'btn-primary',
    },
    columns: [
      {
        key: 'scale',
        label: 'Scale',
        sortable: true,
        cellType: 'avatar',
        toggleable: false,
        avatarConfig: { nameKey: 'name', subtitleKey: 'description' },
      },
      {
        key: 'defaultLabel',
        label: 'Default',
        cellType: 'badge',
        badgeMap: {
          Yes: { cssClass: 'b-green', label: 'Default' },
          No: { cssClass: 'b-gray', label: '—' },
        },
      },
      { key: 'bandCountLabel', label: 'Grade bands', sortable: true },
    ],
    actions: [
      { label: 'Edit', icon: 'edit', iconColor: '#1E40AF' },
      { label: 'Delete', icon: 'delete', danger: true, separatorBefore: true },
    ],
    searchPlaceholder: 'Search grade scales...',
    searchKeys: ['name', 'description'],
    itemLabel: 'scales',
    defaultPageSize: 10,
    pageSizeOptions: [10, 25, 50],
    selectable: false,
    showExport: false,
  };

  ngOnInit(): void {
    this.tableConfig = applyModuleTablePermissions(
      this.baseTableConfig,
      this.permissions,
      MenuCodes.ExamGradeSetup,
      this.ayContext.isReadOnlyScope(),
    );
    this.load();
  }

  load(): void {
    this.examService.getGradeScales().subscribe({
      next: (scales) => {
        this.scales = scales ?? [];
        this.rows = this.scales.map((s) => ({
          ...s,
          scale: s.name,
          description: s.description || '—',
          defaultLabel: s.isDefault ? 'Yes' : 'No',
          bandCountLabel: `${s.grades?.length ?? 0} band${(s.grades?.length ?? 0) === 1 ? '' : 's'}`,
        }));
        this.cdr.detectChanges();
      },
      error: () => {
        this.snackBar.open('Failed to load grade scales', 'Close', {
          duration: 3000,
          panelClass: 'snack-error',
        });
        this.cdr.detectChanges();
      },
    });
  }

  onAddButtonClicked(): void {
    this.formMode = 'add';
    this.editingId = null;
    this.formName = '';
    this.formDescription = '';
    this.formIsDefault = this.scales.length === 0;
    this.formError = '';
    this.gradeRows = [
      { grade: 'A1', minPercent: 91, maxPercent: 100, gradePoint: 10, description: 'Outstanding' },
      { grade: 'A2', minPercent: 81, maxPercent: 90, gradePoint: 9, description: 'Excellent' },
      { grade: 'B1', minPercent: 71, maxPercent: 80, gradePoint: 8, description: 'Very good' },
      { grade: 'B2', minPercent: 61, maxPercent: 70, gradePoint: 7, description: 'Good' },
      { grade: 'C1', minPercent: 51, maxPercent: 60, gradePoint: 6, description: 'Average' },
      { grade: 'C2', minPercent: 41, maxPercent: 50, gradePoint: 5, description: 'Fair' },
      { grade: 'D', minPercent: 33, maxPercent: 40, gradePoint: 4, description: 'Pass' },
      { grade: 'F', minPercent: 0, maxPercent: 32, gradePoint: 0, description: 'Fail' },
    ];
    this.showForm = true;
  }

  onActionClicked(event: {
    action: DataTableAction;
    row: Record<string, unknown>;
    rowIndex: number;
  }): void {
    const scale = event.row as unknown as ExamGradeScale;
    if (event.action.label === 'Edit') {
      this.formMode = 'edit';
      this.editingId = scale.id;
      this.formName = scale.name;
      this.formDescription = scale.description ?? '';
      this.formIsDefault = scale.isDefault;
      this.formError = '';
      this.gradeRows = (scale.grades ?? []).map((g) => ({
        id: g.id,
        grade: g.grade,
        minPercent: g.minPercent,
        maxPercent: g.maxPercent,
        gradePoint: g.gradePoint ?? null,
        description: g.description ?? '',
      }));
      this.showForm = true;
    } else if (event.action.label === 'Delete') {
      this.deleteScale(scale);
    }
  }

  closeForm(): void {
    this.showForm = false;
    this.editingId = null;
    this.formError = '';
  }

  addGradeRow(): void {
    this.gradeRows.push({
      grade: '',
      minPercent: null,
      maxPercent: null,
      gradePoint: null,
      description: '',
    });
  }

  removeGradeRow(index: number): void {
    this.gradeRows.splice(index, 1);
  }

  private validate(): string | null {
    if (!this.formName.trim()) return 'Scale name is required.';
    if (!this.gradeRows.length) return 'Add at least one grade row.';
    for (const row of this.gradeRows) {
      if (!row.grade.trim()) return 'Every grade row needs a grade label.';
      if (row.minPercent === null || row.maxPercent === null) {
        return `Grade '${row.grade}' needs min % and max %.`;
      }
      if (row.minPercent < 0 || row.maxPercent > 100 || row.minPercent > row.maxPercent) {
        return `Grade '${row.grade}' has an invalid percent range.`;
      }
    }
    const ordered = [...this.gradeRows].sort((a, b) => (a.minPercent ?? 0) - (b.minPercent ?? 0));
    for (let i = 1; i < ordered.length; i++) {
      if ((ordered[i].minPercent ?? 0) <= (ordered[i - 1].maxPercent ?? 0)) {
        return `Grades '${ordered[i - 1].grade}' and '${ordered[i].grade}' have overlapping ranges.`;
      }
    }
    return null;
  }

  save(): void {
    const error = this.validate();
    if (error) {
      this.formError = error;
      return;
    }

    const grades: ExamGradeScaleDetail[] = this.gradeRows.map((row, i) => ({
      id: row.id ?? null,
      grade: row.grade.trim(),
      minPercent: row.minPercent ?? 0,
      maxPercent: row.maxPercent ?? 0,
      gradePoint: row.gradePoint,
      description: row.description?.trim() || null,
      displayOrder: i,
    }));

    const payload = {
      name: this.formName.trim(),
      description: this.formDescription.trim() || null,
      isDefault: this.formIsDefault,
      grades,
    };

    this.saving = true;
    const request =
      this.formMode === 'edit' && this.editingId
        ? this.examService.updateGradeScale(this.editingId, payload)
        : this.examService.createGradeScale(payload);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.snackBar.open(
          this.formMode === 'edit' ? 'Grade scale updated' : 'Grade scale created',
          'Close',
          { duration: 2500, panelClass: 'snack-success' },
        );
        this.closeForm();
        this.load();
      },
      error: (err) => {
        this.saving = false;
        this.formError = typeof err?.error === 'string' ? err.error : 'Failed to save grade scale';
        this.cdr.detectChanges();
      },
    });
  }

  deleteScale(scale: ExamGradeScale): void {
    const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
      data: {
        title: 'Delete grade scale?',
        description: 'This grading scale will be removed.',
        recordName: scale.name,
        recordMeta: `${scale.grades?.length ?? 0} grade bands`,
        initials: 'GS',
        warningMessage: 'Scales in use by an exam or exam group cannot be deleted.',
        confirmButtonText: 'Yes, delete',
        cancelButtonText: 'Cancel',
      },
      panelClass: 'erp-dialog',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.examService.deleteGradeScale(scale.id).subscribe({
        next: () => {
          this.snackBar.open('Grade scale deleted', 'Close', {
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
