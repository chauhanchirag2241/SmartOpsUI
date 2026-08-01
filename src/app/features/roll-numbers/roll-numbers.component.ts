import { ChangeDetectorRef, Component, DestroyRef, NgZone, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';

import { NotificationService } from '../../core/services/notification.service';
import { StudentService } from '../../core/services/student.service';
import { ClassService } from '../../core/services/class.service';
import { AcademicYearContextService } from '../../core/services/academic-year-context.service';
import { PermissionService } from '../../core/services/permission.service';
import { MenuCodes } from '../../core/constants/menu-codes';
import { FormFieldComponent } from '../../shared/form-controls/form-field/form-field.component';
import type { FormFieldOption } from '../../shared/form-controls/form-field/form-field.types';
import { PageChromeDirective } from '../../shared/directives/page-chrome.directive';
import { StudentFilter } from '../../shared/enums/table-filters.enum';

type RollNumberRow = {
  id: string;
  name: string;
  admNo: string;
  class: string;
  rollNumber: string;
  originalRollNumber: string;
};

@Component({
  selector: 'app-roll-numbers',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FormFieldComponent,
    MatIconModule,
    MatSnackBarModule,
    PageChromeDirective,
  ],
  templateUrl: './roll-numbers.component.html',
  styleUrl: './roll-numbers.component.css',
})
export class RollNumbersComponent implements OnInit {
  readonly permissionService = inject(PermissionService);
  private readonly ayContext = inject(AcademicYearContextService);
  private readonly classService = inject(ClassService);
  private readonly studentService = inject(StudentService);
  private readonly snackBar = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);

  private loadSeq = 0;

  classId = '';
  classes: { id: string; name: string }[] = [];
  rows: RollNumberRow[] = [];
  loading = false;
  saving = false;
  searchQuery = '';
  resultErrors: string[] = [];

  get classOptions(): FormFieldOption[] {
    return this.classes.map((c) => ({ label: c.name, value: c.id }));
  }

  get academicYearId(): string {
    return this.ayContext.effectiveYearId() ?? '';
  }

  get academicYearLabel(): string {
    return this.ayContext.effectiveYearLabel();
  }

  get canEdit(): boolean {
    return (
      !this.ayContext.isReadOnlyScope() &&
      this.permissionService.canEdit(MenuCodes.RollNumbers)
    );
  }

  get filteredRows(): RollNumberRow[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) {
      return this.rows;
    }
    return this.rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.admNo.toLowerCase().includes(q) ||
        r.rollNumber.toLowerCase().includes(q),
    );
  }

  get hasChanges(): boolean {
    return this.rows.some((r) => r.rollNumber.trim() !== r.originalRollNumber.trim());
  }

  get canSave(): boolean {
    return this.canEdit && !!this.classId && this.rows.length > 0 && this.hasChanges && !this.saving;
  }

  get canAutoGenerate(): boolean {
    return this.canEdit && !!this.classId && this.rows.length > 0 && !this.saving && !this.loading;
  }

  ngOnInit(): void {
    this.loadClasses();
  }

  private refreshView(): void {
    this.ngZone.run(() => this.cdr.detectChanges());
  }

  private loadClasses(): void {
    this.classService
      .getClassDropdown()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.classes = (items || []).map((c: { id: string; name: string }) => ({
            id: String(c.id),
            name: String(c.name ?? ''),
          }));
          if (this.classes.length === 1) {
            this.classId = this.classes[0].id;
            this.onClassChange();
          }
          this.refreshView();
        },
        error: () => {
          this.snackBar.open('Failed to load classes', 'Close', {
            duration: 3000,
            panelClass: 'snack-error',
          });
        },
      });
  }

  onClassChange(): void {
    this.resultErrors = [];
    this.searchQuery = '';
    this.rows = [];
    if (!this.classId) {
      return;
    }
    this.loadStudents();
  }

  loadStudents(): void {
    if (!this.classId || !this.academicYearId) {
      this.rows = [];
      return;
    }

    const seq = ++this.loadSeq;
    this.loading = true;
    this.resultErrors = [];

    this.studentService
      .getStudents(1, 500, '', 'name', 'asc', StudentFilter.Active, [this.classId], this.academicYearId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (seq === this.loadSeq) {
            this.loading = false;
            this.refreshView();
          }
        }),
      )
      .subscribe({
        next: (res: any) => {
          if (seq !== this.loadSeq) {
            return;
          }
          this.rows = (res?.items || []).map((item: Record<string, unknown>) => {
            const roll = String(item['rollNumber'] ?? item['RollNumber'] ?? '');
            return {
              id: String(item['id'] ?? ''),
              name: String(item['name'] ?? 'Student'),
              admNo: String(item['admNo'] ?? ''),
              class: String(item['class'] ?? ''),
              rollNumber: roll,
              originalRollNumber: roll,
            } satisfies RollNumberRow;
          });
          this.refreshView();
        },
        error: () => {
          if (seq !== this.loadSeq) {
            return;
          }
          this.snackBar.open('Failed to load students', 'Close', {
            duration: 3000,
            panelClass: 'snack-error',
          });
        },
      });
  }

  autoGenerate(): void {
    if (!this.canAutoGenerate) {
      return;
    }

    const sorted = [...this.rows].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );

    sorted.forEach((row, index) => {
      row.rollNumber = String(index + 1);
    });

    this.resultErrors = [];
    this.snackBar.open('Roll numbers assigned by student name order. Click Save to apply.', 'Close', {
      duration: 4000,
      panelClass: 'snack-info',
    });
    this.refreshView();
  }

  onSave(): void {
    if (!this.canSave) {
      if (!this.hasChanges) {
        this.snackBar.open('No changes to save', 'Close', {
          duration: 2500,
          panelClass: 'snack-info',
        });
      }
      return;
    }

    if (!this.academicYearId) {
      this.snackBar.open('Select an academic year from the header', 'Close', {
        duration: 3000,
        panelClass: 'snack-warning',
      });
      return;
    }

    const duplicate = this.findDuplicateRoll();
    if (duplicate) {
      this.snackBar.open(`Duplicate roll number '${duplicate}'`, 'Close', {
        duration: 4000,
        panelClass: 'snack-warning',
      });
      return;
    }

    this.saving = true;
    this.resultErrors = [];

    this.studentService
      .updateRollNumbers({
        academicYearId: this.academicYearId,
        classId: this.classId,
        students: this.rows.map((r) => ({
          studentId: r.id,
          rollNumber: r.rollNumber.trim() || null,
        })),
      })
      .pipe(
        finalize(() => {
          this.saving = false;
          this.refreshView();
        }),
      )
      .subscribe({
        next: (res) => {
          this.resultErrors = (res.errors ?? []).map((e) => String(e));
          if (res.updatedCount > 0 && !this.resultErrors.length) {
            this.snackBar.open(`${res.updatedCount} roll number(s) saved`, 'Close', {
              duration: 4000,
              panelClass: 'snack-success',
            });
            this.loadStudents();
          } else if (res.updatedCount > 0 && this.resultErrors.length) {
            this.snackBar.open(
              `${res.updatedCount} saved, but some rows had issues. See details below.`,
              'Close',
              { duration: 5000, panelClass: 'snack-warning' },
            );
            this.loadStudents();
          } else if (this.resultErrors.length) {
            this.snackBar.open('Could not save roll numbers', 'Close', {
              duration: 4000,
              panelClass: 'snack-warning',
            });
          } else {
            this.snackBar.open('No roll numbers were updated', 'Close', {
              duration: 3000,
              panelClass: 'snack-info',
            });
          }
          this.refreshView();
        },
        error: (err) => {
          const msg = err?.error?.message ?? err?.error ?? 'Failed to save roll numbers';
          this.snackBar.open(typeof msg === 'string' ? msg : 'Failed to save roll numbers', 'Close', {
            duration: 4000,
            panelClass: 'snack-error',
          });
        },
      });
  }

  private findDuplicateRoll(): string | null {
    const seen = new Set<string>();
    for (const row of this.rows) {
      const roll = row.rollNumber.trim();
      if (!roll) {
        continue;
      }
      const key = roll.toLowerCase();
      if (seen.has(key)) {
        return roll;
      }
      seen.add(key);
    }
    return null;
  }

  initials(name: string): string {
    const parts = name.split(' ').filter(Boolean);
    if (parts.length > 1) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return (name.slice(0, 2) || 'NA').toUpperCase();
  }
}
