import { ChangeDetectorRef, Component, EventEmitter, Input, NgZone, OnChanges, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { finalize } from 'rxjs';
import { StudentService } from '../../../core/services/student.service';
import { ClassService } from '../../../core/services/class.service';
import { AcademicYearService } from '../../../core/services/academic-year.service';
import { AcademicYearContextService } from '../../../core/services/academic-year-context.service';
import { NotificationService } from '../../../core/services/notification.service';

export type PromoteStudentRow = {
  id: string;
  name: string;
  class?: string;
};

@Component({
  selector: 'app-promote-students-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './promote-students-dialog.component.html',
  styleUrl: './promote-students-dialog.component.css',
})
export class PromoteStudentsDialogComponent implements OnChanges {
  private readonly studentService = inject(StudentService);
  private readonly classService = inject(ClassService);
  private readonly academicYearService = inject(AcademicYearService);
  private readonly ayContext = inject(AcademicYearContextService);
  private readonly snackBar = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);

  @Input({ required: true }) students: PromoteStudentRow[] = [];
  @Input() visible = false;

  @Output() closed = new EventEmitter<void>();
  @Output() completed = new EventEmitter<void>();

  sourceYearId = '';
  sourceYearLabel = '';
  targetYearId = '';
  targetClassId = '';
  autoRollNumber = true;

  academicYears: { id: string; name: string }[] = [];
  targetClasses: { id: string; name: string }[] = [];
  promoting = false;
  checkingFees = false;
  feeSetupError = '';
  resultErrors: string[] = [];

  ngOnChanges(): void {
    if (this.visible) {
      this.resetForm();
      this.loadAcademicYears();
    }
  }

  private resetForm(): void {
    this.sourceYearId = this.ayContext.effectiveYearId() ?? '';
    this.sourceYearLabel = this.ayContext.effectiveYearLabel();
    this.targetYearId = '';
    this.targetClassId = '';
    this.targetClasses = [];
    this.feeSetupError = '';
    this.resultErrors = [];
    this.autoRollNumber = true;
  }

  get canPromote(): boolean {
    return (
      !!this.targetYearId &&
      !!this.targetClassId &&
      this.targetClasses.length > 0 &&
      !this.feeSetupError &&
      !this.promoting &&
      !this.checkingFees
    );
  }

  private loadAcademicYears(): void {
    this.academicYearService.getAcademicYearDropdown().subscribe({
      next: (years) => {
        this.academicYears = (years || []).map((y: { id: string; name: string }) => ({
          id: String(y.id),
          name: String(y.name ?? ''),
        }));
        const next = this.academicYears.find((y) => y.id !== this.sourceYearId);
        if (next) {
          this.targetYearId = next.id;
          this.onTargetYearChange();
        }
        this.refreshView();
      },
      error: () => {
        this.snackBar.open('Failed to load academic years', 'Close', { duration: 3000, panelClass: 'snack-error' });
        this.refreshView();
      },
    });
  }

  onTargetYearChange(): void {
    this.targetClassId = '';
    this.targetClasses = [];
    this.feeSetupError = '';
    if (!this.targetYearId) {
      return;
    }
    this.classService.getClassDropdown(this.targetYearId).subscribe({
      next: (items) => {
        this.targetClasses = (items || []).map((c: { id: string; name: string }) => ({
          id: String(c.id),
          name: String(c.name ?? ''),
        }));
        if (this.targetClasses.length === 1) {
          this.targetClassId = this.targetClasses[0].id;
          this.validateTargetFees();
        }
        this.refreshView();
      },
      error: () => {
        this.snackBar.open('Failed to load classes for target year', 'Close', { duration: 3000, panelClass: 'snack-error' });
        this.refreshView();
      },
    });
  }

  onTargetClassChange(): void {
    this.validateTargetFees();
  }

  private validateTargetFees(): void {
    this.feeSetupError = '';
    if (!this.targetYearId || !this.targetClassId) {
      return;
    }
    this.checkingFees = true;
    this.refreshView();
    this.studentService.getPromoteReadiness(this.targetYearId, this.targetClassId).subscribe({
      next: (res) => {
        const ready = !!(res?.ready ?? (res as { Ready?: boolean })?.Ready);
        const message = res?.message ?? (res as { Message?: string })?.Message ?? '';
        this.feeSetupError = ready
          ? ''
          : message || 'Fees are not configured for the target academic year.';
        this.checkingFees = false;
        this.refreshView();
      },
      error: () => {
        this.feeSetupError = 'Could not verify fee setup for the target year.';
        this.checkingFees = false;
        this.refreshView();
      },
    });
  }

  private refreshView(): void {
    this.ngZone.run(() => this.cdr.detectChanges());
  }

  close(): void {
    if (this.promoting) {
      return;
    }
    this.closed.emit();
  }

  submit(): void {
    if (!this.canPromote) {
      if (this.feeSetupError) {
        this.snackBar.open(this.feeSetupError, 'Close', { duration: 5000, panelClass: 'snack-warning' });
      } else {
        this.snackBar.open('Select target academic year and class', 'Close', { duration: 3000, panelClass: 'snack-warning' });
      }
      return;
    }
    if (this.sourceYearId === this.targetYearId) {
      this.snackBar.open('Target year must be different from source year', 'Close', { duration: 3000, panelClass: 'snack-warning' });
      return;
    }
    if (!this.students.length) {
      this.snackBar.open('No students selected', 'Close', { duration: 3000, panelClass: 'snack-warning' });
      return;
    }

    this.promoting = true;
    this.resultErrors = [];

    const payload = {
      sourceAcademicYearId: this.sourceYearId,
      targetAcademicYearId: this.targetYearId,
      students: this.students.map((s) => ({
        studentId: s.id,
        targetClassId: this.targetClassId,
        rollNumber: this.autoRollNumber ? undefined : '',
      })),
    };

    this.studentService
      .promoteStudents(payload)
      .pipe(finalize(() => {
        this.promoting = false;
        this.refreshView();
      }))
      .subscribe({
        next: (res) => {
          this.resultErrors = res.errors ?? [];
          this.refreshView();
          if (res.promotedCount > 0) {
            this.snackBar.open(`${res.promotedCount} student(s) promoted successfully`, 'Close', {
              duration: 4000,
              panelClass: 'snack-success',
            });
            this.completed.emit();
          }
          if (this.resultErrors.length) {
            this.snackBar.open(`${this.resultErrors.length} student(s) could not be promoted`, 'Close', {
              duration: 5000,
              panelClass: 'snack-warning',
            });
          }
          if (res.promotedCount === 0 && !this.resultErrors.length) {
            this.snackBar.open('No students were promoted', 'Close', { duration: 3000, panelClass: 'snack-info' });
          }
        },
        error: (err) => {
          const msg = err?.error?.message ?? err?.error ?? 'Promotion failed';
          this.snackBar.open(typeof msg === 'string' ? msg : 'Promotion failed', 'Close', {
            duration: 4000,
            panelClass: 'snack-error',
          });
          this.refreshView();
        },
      });
  }
}
