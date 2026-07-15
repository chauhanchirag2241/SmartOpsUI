import { Component, EventEmitter, Output, Input, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NotificationService } from '../../../core/services/notification.service';
import { finalize } from 'rxjs';

import { DynamicFieldComponent } from '../../../shared/form-controls/dynamic-field/dynamic-field.component';
import { ActionButtonComponent } from '../../../shared/components/action-button/action-button.component';
import { FormFieldConfig } from '../../../shared/interfaces/form-field-config';
import { AcademicYearService } from '../../../core/services/academic-year.service';

import { FormTab } from '../../../shared/interfaces/form-layout';

type SemesterFormRow = {
  semesterIndex: number;
  name: string;
  startDate: string;
  endDate: string;
};

function dateRangeValidator(group: AbstractControl): ValidationErrors | null {
  const start = group.get('startDate')?.value;
  const end = group.get('endDate')?.value;
  if (!start || !end) return null;
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
  return e < s ? { dateRange: true } : null;
}

@Component({
  selector: 'app-add-academic-year',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, MatIconModule, MatSnackBarModule, DynamicFieldComponent, ActionButtonComponent],
  templateUrl: './add-academic-year.component.html',
  styleUrl: './add-academic-year.component.css',
})
export class AddAcademicYearComponent implements OnInit {
  @Input() mode: 'add' | 'edit' | 'view' = 'add';
  @Input() yearId?: string;

  @Output() cancel = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  private readonly ayService = inject(AcademicYearService);
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);

  ayForm: FormGroup;
  isSaving = false;
  semesterError = '';

  semesters: SemesterFormRow[] = [
    { semesterIndex: 1, name: 'Semester 1', startDate: '', endDate: '' },
    { semesterIndex: 2, name: 'Semester 2', startDate: '', endDate: '' },
  ];

  readonly configs: Record<string, FormFieldConfig> = {
    title: {
      type: 'input',
      controlName: 'title',
      label: 'Academic Year Title',
      placeholder: 'e.g. 2024-25',
      validations: [{ name: 'required', message: 'Title is required', validator: Validators.required }],
    },
    startDate: {
      type: 'datepicker',
      controlName: 'startDate',
      label: 'Start Date',
      validations: [{ name: 'required', message: 'Start date is required', validator: Validators.required }],
    },
    endDate: {
      type: 'datepicker',
      controlName: 'endDate',
      label: 'End Date',
      validations: [{ name: 'required', message: 'End date is required', validator: Validators.required }],
    },
  };

  readonly tabs: FormTab[] = [
    {
      stepIndex: 0,
      sections: [
        {
          title: 'Year Details',
          icon: 'calendar_today',
          layout: 'grid2',
          fields: ['title', 'startDate', 'endDate'],
        },
      ],
    },
  ];

  constructor() {
    this.ayForm = this.fb.group(
      {
        title: ['', Validators.required],
        startDate: ['', Validators.required],
        endDate: ['', Validators.required],
      },
      { validators: dateRangeValidator },
    );
  }

  get pageTitle(): string {
    if (this.mode === 'edit') return 'Edit Academic Year';
    if (this.mode === 'view') return 'View Academic Year';
    return 'Add New Academic Year';
  }

  ngOnInit(): void {
    if ((this.mode === 'edit' || this.mode === 'view') && this.yearId) {
      this.loadYear(this.yearId);
      this.loadSemesters(this.yearId);
    }
    if (this.mode === 'view') {
      this.ayForm.disable();
    }
  }

  private loadYear(id: string): void {
    this.ayService.getAcademicYearById(id).subscribe({
      next: (res: any) => {
        this.ayForm.patchValue({
          title: res.title,
          startDate: res.startDate,
          endDate: res.endDate,
        });
        this.cdr.detectChanges();
      },
      error: () => {
        this.snackBar.open('Failed to load year details', 'Close', { duration: 3000, panelClass: 'snack-error' });
      },
    });
  }

  private loadSemesters(yearId: string): void {
    this.ayService.getSemesters(yearId).subscribe({
      next: (list) => {
        if (Array.isArray(list) && list.length) {
          this.semesters = list.map((s: any) => ({
            semesterIndex: Number(s.semesterIndex ?? s.SemesterIndex ?? 1),
            name: String(s.name ?? s.Name ?? ''),
            startDate: this.toInputDate(s.startDate ?? s.StartDate),
            endDate: this.toInputDate(s.endDate ?? s.EndDate),
          }));
        }
        this.cdr.detectChanges();
      },
    });
  }

  saveAll(): void {
    if (this.mode === 'view') return;

    this.semesterError = '';
    if (this.ayForm.invalid) {
      this.ayForm.markAllAsTouched();
      if (this.ayForm.hasError('dateRange')) {
        this.snackBar.open('Academic year end date cannot be earlier than start date', 'Close', {
          duration: 3500,
          panelClass: 'snack-error',
        });
      } else {
        this.snackBar.open('Please fill all required fields', 'Close', { duration: 3000, panelClass: 'snack-error' });
      }
      return;
    }

    const semesterValidation = this.validateSemesters();
    if (semesterValidation) {
      this.semesterError = semesterValidation;
      this.snackBar.open(semesterValidation, 'Close', { duration: 4000, panelClass: 'snack-error' });
      return;
    }

    this.isSaving = true;
    const raw = this.ayForm.getRawValue();
    const payload = {
      title: String(raw.title ?? '').trim(),
      startDate: this.formatDate(raw.startDate),
      endDate: this.formatDate(raw.endDate),
      semesters: this.semesters.map((s) => ({
        semesterIndex: s.semesterIndex,
        name: s.name.trim(),
        startDate: s.startDate,
        endDate: s.endDate,
      })),
    };

    const request$ =
      this.mode === 'edit' && this.yearId
        ? this.ayService.updateAcademicYear(this.yearId, payload)
        : this.ayService.createAcademicYear(payload);

    request$
      .pipe(
        finalize(() => {
          this.isSaving = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: () => {
          this.snackBar.open(
            this.mode === 'edit' ? 'Academic year updated successfully' : 'Academic year saved as Draft',
            'Close',
            { duration: 3000, panelClass: 'snack-success' },
          );
          this.saved.emit();
        },
        error: (err) => {
          const msg =
            err?.error?.message ||
            (typeof err?.error === 'string' ? err.error : null) ||
            'Failed to save academic year';
          this.snackBar.open(msg, 'Close', { duration: 4500, panelClass: 'snack-error' });
        },
      });
  }

  private validateSemesters(): string | null {
    const raw = this.ayForm.getRawValue();
    const yearStart = this.formatDate(raw.startDate);
    const yearEnd = this.formatDate(raw.endDate);

    for (const sem of this.semesters) {
      if (!sem.name.trim() || !sem.startDate || !sem.endDate) {
        return 'Fill all semester fields';
      }
      if (sem.endDate < sem.startDate) {
        return `Semester '${sem.name.trim()}': end date cannot be earlier than start date`;
      }
      if (sem.startDate < yearStart || sem.endDate > yearEnd) {
        return `Semester '${sem.name.trim()}': dates must fall within the academic year range`;
      }
    }
    return null;
  }

  private formatDate(date: any): string {
    if (!date) return '';
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
      return date.slice(0, 10);
    }
    const d = new Date(date);
    const month = '' + (d.getMonth() + 1);
    const day = '' + d.getDate();
    const year = d.getFullYear();
    return [year, month.padStart(2, '0'), day.padStart(2, '0')].join('-');
  }

  private toInputDate(date: any): string {
    if (!date) return '';
    if (typeof date === 'string' && date.length >= 10) {
      return date.slice(0, 10);
    }
    return this.formatDate(date);
  }
}
