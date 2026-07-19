import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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
  AcademicYearService,
  AcademicYearDropdownItem,
} from '../../../core/services/academic-year.service';
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
  ],
  templateUrl: './exam-groups.component.html',
  styleUrl: './exam-groups.component.css',
})
export class ExamGroupsComponent implements OnInit {
  private examService = inject(ExamService);
  private academicYearService = inject(AcademicYearService);
  private snackBar = inject(NotificationService);
  private dialog = inject(MatDialog);
  private permissions = inject(PermissionService);
  private ayContext = inject(AcademicYearContextService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  ExamEvaluationType = ExamEvaluationType;

  rows: Record<string, unknown>[] = [];
  academicYears: AcademicYearDropdownItem[] = [];
  gradeScales: ExamGradeScale[] = [];
  tableConfig!: DataTableConfig;

  showForm = false;
  formMode: 'add' | 'edit' = 'add';
  editingId: string | null = null;
  formError = '';
  saving = false;

  formName = '';
  formDescription = '';
  formAcademicYearId = '';
  formGradeScaleId = '';
  formEvaluationType: ExamEvaluationType = ExamEvaluationType.Marks;

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
      { key: 'academicYearTitle', label: 'Academic year', sortable: true },
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
      { label: 'View exams', icon: 'visibility', iconColor: '#639922' },
      { label: 'Edit', icon: 'edit', iconColor: '#1E40AF' },
      { label: 'Delete', icon: 'delete', danger: true, separatorBefore: true },
    ],
    searchPlaceholder: 'Search exam groups...',
    searchKeys: ['name', 'description', 'academicYearTitle', 'gradeScaleName'],
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
    this.load();
    this.academicYearService.getAcademicYearDropdown('switcher').subscribe({
      next: (years) => {
        this.academicYears = years ?? [];
        this.cdr.detectChanges();
      },
    });
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

  onAddButtonClicked(): void {
    this.formMode = 'add';
    this.editingId = null;
    this.formName = '';
    this.formDescription = '';
    this.formAcademicYearId =
      this.academicYears.find((y) => y.isCurrent)?.id ?? this.academicYears[0]?.id ?? '';
    this.formGradeScaleId = this.gradeScales.find((s) => s.isDefault)?.id ?? '';
    this.formEvaluationType = ExamEvaluationType.Marks;
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
    if (event.action.label === 'View exams') {
      this.router.navigate(['/exams/list'], { queryParams: { groupId: group.id } });
    } else if (event.action.label === 'Edit') {
      this.formMode = 'edit';
      this.editingId = group.id;
      this.formName = group.name;
      this.formDescription = group.description ?? '';
      this.formAcademicYearId = group.academicYearId;
      this.formGradeScaleId = group.gradeScaleId ?? '';
      this.formEvaluationType = group.evaluationType;
      this.formError = '';
      this.showForm = true;
    } else if (event.action.label === 'Delete') {
      this.deleteGroup(group);
    }
  }

  save(): void {
    if (!this.formName.trim()) {
      this.formError = 'Group name is required.';
      return;
    }
    if (!this.formAcademicYearId) {
      this.formError = 'Academic year is required.';
      return;
    }

    const payload = {
      name: this.formName.trim(),
      description: this.formDescription.trim() || null,
      academicYearId: this.formAcademicYearId,
      gradeScaleId: this.formGradeScaleId || null,
      evaluationType: Number(this.formEvaluationType) as ExamEvaluationType,
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
        recordMeta: `${group.examCount} exam(s) · ${group.academicYearTitle}`,
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
