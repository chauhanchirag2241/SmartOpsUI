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
import { ClassService } from '../../../core/services/class.service';
import {
  ExamService,
  ExamGroup,
  ExamGradeScale,
  ExamListItem,
  ExamStats,
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
  imports: [CommonModule, FormsModule, MatIconModule, MatDialogModule],
  templateUrl: './exam-list.component.html',
  styleUrls: ['../exam-shared.css'],
})
export class ExamListComponent implements OnInit {
  private examService = inject(ExamService);
  private classService = inject(ClassService);
  private snackBar = inject(NotificationService);
  private dialog = inject(MatDialog);
  private permissions = inject(PermissionService);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  ExamStatus = ExamStatus;
  examTypes = EXAM_TYPES;

  exams: ExamListItem[] = [];
  groups: ExamGroup[] = [];
  gradeScales: ExamGradeScale[] = [];
  classes: any[] = [];
  stats: ExamStats = { total: 0, ongoing: 0, completed: 0, upcoming: 0 };
  loading = false;

  filterGroupId = '';
  filterClassId = '';
  filterStatus = '';
  searchQuery = '';

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

  get canAdd(): boolean {
    return this.permissions.canAdd(MenuCodes.Exams);
  }
  get canEdit(): boolean {
    return this.permissions.canEdit(MenuCodes.Exams);
  }
  get canDelete(): boolean {
    return this.permissions.canDelete(MenuCodes.Exams);
  }

  ngOnInit(): void {
    const groupId = this.route.snapshot.queryParamMap.get('groupId');
    if (groupId) {
      this.filterGroupId = groupId;
    }
    this.loadDropdowns();
    this.loadStats();
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
        this.classes = classes ?? [];
        this.cdr.detectChanges();
      },
    });
  }

  loadStats(): void {
    this.examService.getExamStats().subscribe({
      next: (stats) => {
        this.stats = stats ?? this.stats;
        this.cdr.detectChanges();
      },
    });
  }

  loadList(): void {
    this.loading = true;
    this.examService
      .getExams({
        groupId: this.filterGroupId || undefined,
        classId: this.filterClassId || undefined,
        status: this.filterStatus === '' ? undefined : Number(this.filterStatus),
        search: this.searchQuery || undefined,
      })
      .subscribe({
        next: (exams) => {
          this.exams = exams ?? [];
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.exams = [];
          this.loading = false;
          this.snackBar.open('Failed to load exams', 'Close', { duration: 3000 });
          this.cdr.detectChanges();
        },
      });
  }

  statusBadgeClass(status: ExamStatus): string {
    switch (status) {
      case ExamStatus.Ongoing:
        return 'b-a';
      case ExamStatus.Completed:
        return 'b-b';
      case ExamStatus.ResultDeclared:
        return 'b-g';
      case ExamStatus.Scheduled:
        return 'b-p';
      default:
        return 'b-gray';
    }
  }

  classNames(exam: ExamListItem): string {
    return (exam.classes ?? []).map((c) => c.className).join(', ');
  }

  openCreate(): void {
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

  openEdit(exam: ExamListItem): void {
    this.examService.getExam(exam.id).subscribe({
      next: (detail) => {
        this.formMode = 'edit';
        this.editingId = detail.id;
        this.formGroupId = detail.examGroupId;
        this.formName = detail.name;
        this.formExamType = detail.examType;
        this.formStartDate = detail.startDate;
        this.formEndDate = detail.endDate;
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
      error: () => this.snackBar.open('Failed to load exam', 'Close', { duration: 3000 }),
    });
  }

  closeForm(): void {
    this.showForm = false;
    this.editingId = null;
    this.formError = '';
  }

  toggleClass(classId: string): void {
    const index = this.formClassIds.indexOf(classId);
    if (index >= 0) {
      this.formClassIds.splice(index, 1);
    } else {
      this.formClassIds.push(classId);
    }
  }

  addComponentRow(): void {
    this.componentRows.push({ name: '', maxMarks: null, passingMarks: null });
  }

  removeComponentRow(index: number): void {
    this.componentRows.splice(index, 1);
  }

  get totalMaxMarks(): number {
    return this.componentRows.reduce((sum, row) => sum + (row.maxMarks ?? 0), 0);
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
    if (this.formMinPassPercent === null || this.formMinPassPercent < 0 || this.formMinPassPercent > 100) {
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
        });
        this.closeForm();
        this.loadList();
        this.loadStats();
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
        this.snackBar.open('Exam status updated', 'Close', { duration: 2500 });
        this.loadList();
        this.loadStats();
      },
      error: (err) =>
        this.snackBar.open(
          typeof err?.error === 'string' ? err.error : 'Status update failed',
          'Close',
          { duration: 3000 },
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
          this.snackBar.open('Exam deleted', 'Close', { duration: 2500 });
          this.loadList();
          this.loadStats();
        },
        error: (err) =>
          this.snackBar.open(
            typeof err?.error === 'string' ? err.error : 'Delete failed',
            'Close',
            { duration: 3500 },
          ),
      });
    });
  }
}
