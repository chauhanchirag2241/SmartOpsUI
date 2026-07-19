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
  imports: [CommonModule, FormsModule, MatIconModule, MatDialogModule],
  templateUrl: './exam-groups.component.html',
  styleUrls: ['../exam-shared.css'],
})
export class ExamGroupsComponent implements OnInit {
  private examService = inject(ExamService);
  private academicYearService = inject(AcademicYearService);
  private snackBar = inject(NotificationService);
  private dialog = inject(MatDialog);
  private permissions = inject(PermissionService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  ExamEvaluationType = ExamEvaluationType;

  groups: ExamGroup[] = [];
  academicYears: AcademicYearDropdownItem[] = [];
  gradeScales: ExamGradeScale[] = [];
  loading = false;

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

  get canAdd(): boolean {
    return this.permissions.canAdd(MenuCodes.ExamGroups);
  }
  get canEdit(): boolean {
    return this.permissions.canEdit(MenuCodes.ExamGroups);
  }
  get canDelete(): boolean {
    return this.permissions.canDelete(MenuCodes.ExamGroups);
  }

  ngOnInit(): void {
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
    this.loading = true;
    this.examService.getGroups().subscribe({
      next: (groups) => {
        this.groups = groups ?? [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.snackBar.open('Failed to load exam groups', 'Close', { duration: 3000 });
        this.cdr.detectChanges();
      },
    });
  }

  openCreate(): void {
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

  openEdit(group: ExamGroup): void {
    this.formMode = 'edit';
    this.editingId = group.id;
    this.formName = group.name;
    this.formDescription = group.description ?? '';
    this.formAcademicYearId = group.academicYearId;
    this.formGradeScaleId = group.gradeScaleId ?? '';
    this.formEvaluationType = group.evaluationType;
    this.formError = '';
    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
    this.editingId = null;
    this.formError = '';
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
          { duration: 2500 },
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
          this.snackBar.open('Exam group deleted', 'Close', { duration: 2500 });
          this.load();
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

  viewExams(group: ExamGroup): void {
    this.router.navigate(['/exams/list'], { queryParams: { groupId: group.id } });
  }
}
