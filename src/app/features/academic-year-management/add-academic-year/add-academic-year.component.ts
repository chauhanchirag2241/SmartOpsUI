import { Component, EventEmitter, Output, Input, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';

import { DynamicFieldComponent } from '../../../shared/form-controls/dynamic-field/dynamic-field.component';
import { ActionButtonComponent } from '../../../shared/components/action-button/action-button.component';
import { FormFieldConfig } from '../../../shared/interfaces/form-field-config';
import { AcademicYearService } from '../../../core/services/academic-year.service';

import { FormTab } from '../../../shared/interfaces/form-layout';

@Component({
  selector: 'app-add-academic-year',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule, MatSnackBarModule, DynamicFieldComponent, ActionButtonComponent],
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
  private readonly snackBar = inject(MatSnackBar);
  private readonly cdr = inject(ChangeDetectorRef);

  ayForm: FormGroup;
  isSaving = false;

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
    this.ayForm = this.fb.group({
      title: ['', Validators.required],
      startDate: ['', Validators.required],
      endDate: ['', Validators.required],
    });
  }

  get pageTitle(): string {
    if (this.mode === 'edit') return 'Edit Academic Year';
    if (this.mode === 'view') return 'View Academic Year';
    return 'Add New Academic Year';
  }

  ngOnInit(): void {
    if ((this.mode === 'edit' || this.mode === 'view') && this.yearId) {
      this.loadYear(this.yearId);
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
      error: (err: any) => {
        console.error('Error loading academic year:', err);
        this.snackBar.open('Failed to load year details', 'Close', { duration: 3000, panelClass: 'snack-error' });
      }
    });
  }

  saveYear(): void {
    if (this.ayForm.invalid || this.mode === 'view') {
      this.ayForm.markAllAsTouched();
      this.snackBar.open('Please fill all required fields', 'Close', { duration: 3000, panelClass: 'snack-error' });
      return;
    }

    this.isSaving = true;
    const raw = this.ayForm.getRawValue();
    
    // Format dates to yyyy-MM-dd for DateOnly compatibility
    const payload = {
      ...raw,
      startDate: this.formatDate(raw.startDate),
      endDate: this.formatDate(raw.endDate)
    };

    const request$ = this.mode === 'edit' && this.yearId
      ? this.ayService.updateAcademicYear(this.yearId, payload)
      : this.ayService.createAcademicYear(payload);

    request$
      .pipe(finalize(() => {
        this.isSaving = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: () => {
          this.snackBar.open(this.mode === 'edit' ? 'Academic year updated successfully' : 'Academic year added successfully', 'Close', { duration: 3000, panelClass: 'snack-success' });
          this.saved.emit();
        },
        error: (err: any) => {
          console.error('Save failed:', err);
          this.snackBar.open('Failed to save academic year', 'Close', { duration: 3000, panelClass: 'snack-error' });
        }
      });
  }

  private formatDate(date: any): string {
    if (!date) return '';
    const d = new Date(date);
    const month = '' + (d.getMonth() + 1);
    const day = '' + d.getDate();
    const year = d.getFullYear();

    return [year, month.padStart(2, '0'), day.padStart(2, '0')].join('-');
  }
}
