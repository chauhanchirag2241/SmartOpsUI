import { Component, OnDestroy, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { PermissionService } from '../../../core/services/permission.service';
import { MenuCodes } from '../../../core/constants/menu-codes';
import { DeleteConfirmDialogComponent } from '../../../shared/components/delete-confirm-dialog/delete-confirm-dialog.component';
import { ActionButtonComponent } from '../../../shared/components/action-button/action-button.component';
import { PageChromeDirective } from '../../../shared/directives/page-chrome.directive';
import { DynamicFieldComponent } from '../../../shared/form-controls/dynamic-field/dynamic-field.component';
import { FormFieldConfig } from '../../../shared/interfaces/form-field-config';
import {
  ExamService,
  ExamListItem,
  ExamClassInfo,
  ExamMarksGrid,
  ExamSubjectProgress,
  ExamStudentMarksRow,
} from '../../../core/services/exam.service';

interface MarkCell {
  componentId: string;
  value: number | null;
}

interface StudentMarksDraft {
  studentId: string;
  studentName: string;
  rollNo: string;
  isAbsent: boolean;
  remark: string;
  cells: MarkCell[];
}

@Component({
  selector: 'app-marks-entry',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
    MatDialogModule,
    ActionButtonComponent,
    PageChromeDirective,
    DynamicFieldComponent,
  ],
  templateUrl: './marks-entry.component.html',
  styleUrl: './marks-entry.component.css',
})
export class MarksEntryComponent implements OnInit, OnDestroy {
  private examService = inject(ExamService);
  private snackBar = inject(NotificationService);
  private permissions = inject(PermissionService);
  private dialog = inject(MatDialog);
  private cdr = inject(ChangeDetectorRef);
  private fb = inject(FormBuilder);
  private readonly subs = new Subscription();

  exams: ExamListItem[] = [];
  subjectProgress: ExamSubjectProgress[] = [];
  grid: ExamMarksGrid | null = null;
  rows: StudentMarksDraft[] = [];
  dirty = false;

  selectedScheduleId = '';

  loadingGrid = false;
  saving = false;

  readonly filterForm = this.fb.group({
    selectedExamId: [''],
    selectedClassId: [''],
  });

  examConfig: FormFieldConfig = {
    type: 'select',
    controlName: 'selectedExamId',
    label: 'Exam',
    placeholder: 'Select exam',
    options: [{ label: 'Select exam', value: '' }],
  };

  classConfig: FormFieldConfig = {
    type: 'select',
    controlName: 'selectedClassId',
    label: 'Class',
    placeholder: 'Select class',
    options: [{ label: 'Select class', value: '' }],
  };

  get canEdit(): boolean {
    return (
      this.permissions.canEdit(MenuCodes.ExamMarksEntry) ||
      this.permissions.canAdd(MenuCodes.ExamMarksEntry)
    );
  }

  get selectedExamId(): string {
    return String(this.filterForm.get('selectedExamId')?.value ?? '');
  }

  get selectedClassId(): string {
    return String(this.filterForm.get('selectedClassId')?.value ?? '');
  }

  get selectedExam(): ExamListItem | undefined {
    return this.exams.find((e) => e.id === this.selectedExamId);
  }

  get examClasses(): ExamClassInfo[] {
    return this.selectedExam?.classes ?? [];
  }

  get maxTotal(): number {
    return (this.grid?.components ?? []).reduce((sum, c) => sum + c.maxMarks, 0);
  }

  ngOnInit(): void {
    this.subs.add(
      this.filterForm.get('selectedExamId')!.valueChanges.subscribe(() => this.onExamChange()),
    );
    this.subs.add(
      this.filterForm.get('selectedClassId')!.valueChanges.subscribe(() => this.onClassChange()),
    );

    this.examService.getExams().subscribe({
      next: (exams) => {
        this.exams = exams ?? [];
        this.examConfig = {
          ...this.examConfig,
          options: [
            { label: 'Select exam', value: '' },
            ...this.exams.map((e) => ({
              label: `${e.name} (${e.examGroupName})`,
              value: e.id,
            })),
          ],
        };
        if (this.exams.length > 0) {
          this.filterForm.patchValue({ selectedExamId: this.exams[0].id }, { emitEvent: false });
          this.onExamChange();
        }
        this.cdr.detectChanges();
      },
      error: () =>
        this.snackBar.open('Failed to load exams', 'Close', {
          duration: 3000,
          panelClass: 'snack-error',
        }),
    });
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  onExamChange(): void {
    const classes = this.examClasses;
    this.classConfig = {
      ...this.classConfig,
      options: [
        { label: 'Select class', value: '' },
        ...classes.map((c) => ({ label: c.className, value: c.classId })),
      ],
    };
    const nextClassId = classes[0]?.classId ?? '';
    this.filterForm.patchValue({ selectedClassId: nextClassId }, { emitEvent: false });
    this.onClassChange();
  }

  onClassChange(): void {
    this.grid = null;
    this.rows = [];
    this.subjectProgress = [];
    this.selectedScheduleId = '';
    this.dirty = false;
    if (!this.selectedExamId || !this.selectedClassId) {
      return;
    }
    this.examService.getSubjectProgress(this.selectedExamId, this.selectedClassId).subscribe({
      next: (progress) => {
        this.subjectProgress = progress ?? [];
        if (this.subjectProgress.length > 0) {
          this.selectSubject(this.subjectProgress[0], true);
        }
        this.cdr.detectChanges();
      },
      error: () =>
        this.snackBar.open('Failed to load subjects for this exam/class', 'Close', {
          duration: 3000,
          panelClass: 'snack-error',
        }),
    });
  }

  selectSubject(subject: ExamSubjectProgress, skipDirtyCheck = false): void {
    if (!skipDirtyCheck && this.dirty) {
      const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
        data: {
          title: 'Discard unsaved marks?',
          description: 'You have unsaved changes for the current subject.',
          recordName: this.grid?.subjectName ?? 'Current subject',
          recordMeta: this.grid?.className ?? '',
          initials: 'MK',
          warningMessage: 'Unsaved marks will be lost.',
          confirmButtonText: 'Discard',
          cancelButtonText: 'Stay',
          variant: 'danger',
          headerIcon: 'warning',
        },
        panelClass: 'erp-dialog',
        disableClose: true,
      });
      dialogRef.afterClosed().subscribe((confirmed) => {
        if (!confirmed) return;
        this.selectedScheduleId = subject.examScheduleId;
        this.loadGrid();
      });
      return;
    }
    this.selectedScheduleId = subject.examScheduleId;
    this.loadGrid();
  }

  loadGrid(): void {
    if (!this.selectedScheduleId) return;
    this.loadingGrid = true;
    this.examService.getMarksGrid(this.selectedScheduleId).subscribe({
      next: (grid) => {
        this.grid = grid;
        this.rows = (grid.students ?? []).map((s: ExamStudentMarksRow) => ({
          studentId: s.studentId,
          studentName: s.studentName,
          rollNo: s.rollNo,
          isAbsent: s.isAbsent,
          remark: s.remark ?? '',
          cells: (grid.components ?? []).map((c) => ({
            componentId: c.id!,
            value: s.marks?.find((m) => m.componentId === c.id)?.marksObtained ?? null,
          })),
        }));
        this.dirty = false;
        this.loadingGrid = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingGrid = false;
        this.snackBar.open('Failed to load marks grid', 'Close', {
          duration: 3000,
          panelClass: 'snack-error',
        });
        this.cdr.detectChanges();
      },
    });
  }

  markDirty(): void {
    this.dirty = true;
  }

  toggleAbsent(row: StudentMarksDraft): void {
    if (row.isAbsent) {
      row.cells.forEach((cell) => (cell.value = null));
    }
    this.dirty = true;
  }

  isOverMax(row: StudentMarksDraft, index: number): boolean {
    const max = this.grid?.components?.[index]?.maxMarks ?? 0;
    const value = row.cells[index]?.value;
    return value !== null && value !== undefined && (value < 0 || value > max);
  }

  total(row: StudentMarksDraft): number | null {
    if (row.isAbsent) return null;
    if (row.cells.every((c) => c.value === null || c.value === undefined)) return null;
    return row.cells.reduce((sum, c) => sum + (c.value ?? 0), 0);
  }

  percent(row: StudentMarksDraft): number | null {
    const total = this.total(row);
    if (total === null || this.maxTotal === 0) return null;
    return Math.round((total / this.maxTotal) * 10000) / 100;
  }

  isPass(row: StudentMarksDraft): boolean | null {
    if (row.isAbsent) return false;
    const pct = this.percent(row);
    if (pct === null || !this.grid) return null;
    for (let i = 0; i < row.cells.length; i++) {
      const passing = this.grid.components[i]?.passingMarks;
      if (passing !== null && passing !== undefined && (row.cells[i].value ?? 0) < passing) {
        return false;
      }
    }
    return pct >= this.grid.minPassPercent;
  }

  get enteredCount(): number {
    return this.rows.filter((r) => r.isAbsent || this.total(r) !== null).length;
  }

  get summary(): { avg: number; high: number; low: number; pass: number; fail: number } | null {
    const totals = this.rows
      .filter((r) => !r.isAbsent)
      .map((r) => this.total(r))
      .filter((t): t is number => t !== null);
    if (!totals.length) return null;
    const pass = this.rows.filter((r) => this.isPass(r) === true).length;
    const fail = this.rows.filter((r) => this.isPass(r) === false).length;
    return {
      avg: Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 100) / 100,
      high: Math.max(...totals),
      low: Math.min(...totals),
      pass,
      fail,
    };
  }

  progressPercent(subject: ExamSubjectProgress): number {
    return subject.total === 0 ? 0 : Math.round((subject.entered / subject.total) * 100);
  }

  save(): void {
    if (!this.grid) return;

    for (const row of this.rows) {
      for (let i = 0; i < row.cells.length; i++) {
        if (this.isOverMax(row, i)) {
          this.snackBar.open(
            `${row.studentName}: marks exceed max for ${this.grid.components[i].name}`,
            'Close',
            { duration: 3500, panelClass: 'snack-error' },
          );
          return;
        }
      }
    }

    const payload = {
      examScheduleId: this.grid.examScheduleId,
      students: this.rows.map((row) => ({
        studentId: row.studentId,
        isAbsent: row.isAbsent,
        remark: row.remark.trim() || null,
        marks: row.cells.map((cell) => ({
          componentId: cell.componentId,
          marksObtained: row.isAbsent ? null : cell.value,
        })),
      })),
    };

    this.saving = true;
    this.examService.saveMarks(payload).subscribe({
      next: () => {
        this.saving = false;
        this.dirty = false;
        this.snackBar.open('Marks saved', 'Close', {
          duration: 2500,
          panelClass: 'snack-success',
        });
        this.refreshProgress();
      },
      error: (err) => {
        this.saving = false;
        this.snackBar.open(
          typeof err?.error === 'string' ? err.error : 'Failed to save marks',
          'Close',
          { duration: 3500, panelClass: 'snack-error' },
        );
        this.cdr.detectChanges();
      },
    });
  }

  private refreshProgress(): void {
    this.examService.getSubjectProgress(this.selectedExamId, this.selectedClassId).subscribe({
      next: (progress) => {
        this.subjectProgress = progress ?? [];
        this.cdr.detectChanges();
      },
    });
  }
}
