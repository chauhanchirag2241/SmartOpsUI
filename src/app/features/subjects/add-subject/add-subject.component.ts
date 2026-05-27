import { Component, EventEmitter, Input, Output, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { NotificationService } from '../../../core/services/notification.service';
import { finalize } from 'rxjs';

import { DynamicFieldComponent } from '../../../shared/form-controls/dynamic-field/dynamic-field.component';
import { ActionButtonComponent } from '../../../shared/components/action-button/action-button.component';
import { FormTab } from '../../../shared/interfaces/form-layout';
import { FormFieldConfig } from '../../../shared/interfaces/form-field-config';
import { SELECT_PLACEHOLDER } from '../../../shared/constants/form.constants';
import {
  enumToOptions,
  Medium,
  SubjectType,
  SubjectCategory,
} from '../../../shared/enums/field-options.enum';
import { SubjectService } from '../../../core/services/subject.service';

@Component({
  selector: 'app-add-subject',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule, DynamicFieldComponent, ActionButtonComponent],
  templateUrl: './add-subject.component.html',
  styleUrl: './add-subject.component.css',
})
export class AddSubjectComponent implements OnInit {
  @Input() mode: 'add' | 'edit' | 'view' = 'add';
  @Input() subjectId?: string;
  @Output() cancel = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  subjectForm: FormGroup;
  isSaving = false;

  readonly configs: Record<string, FormFieldConfig> = {
    subjectName: {
      type: 'input',
      controlName: 'subjectName',
      label: 'Subject name',
      placeholder: 'e.g. Mathematics',
      validations: [{ name: 'required', message: 'Subject name is required', validator: Validators.required }],
    },
    subjectCode: {
      type: 'input',
      controlName: 'subjectCode',
      label: 'Subject code',
      placeholder: 'e.g. MATH-01',
      validations: [{ name: 'required', message: 'Subject code is required', validator: Validators.required }],
    },
    subjectType: { type: 'select', controlName: 'subjectType', label: 'Subject type', placeholder: SELECT_PLACEHOLDER, options: enumToOptions(SubjectType) },
    subjectCategory: {
      type: 'select',
      controlName: 'subjectCategory',
      label: 'Subject category',
      placeholder: SELECT_PLACEHOLDER,
      options: enumToOptions(SubjectCategory),
    },
    medium: { type: 'select', controlName: 'medium', label: 'Medium of instruction', placeholder: SELECT_PLACEHOLDER, options: enumToOptions(Medium) },
  };

  readonly tabs: FormTab[] = [
    {
      stepIndex: 0,
      sections: [
        {
          title: 'Subject identity',
          icon: 'auto_stories',
          layout: 'grid2',
          fields: ['subjectName', 'subjectCode', 'subjectType', 'subjectCategory', 'medium'],
        },
      ],
    },
  ];

  constructor(
    private fb: FormBuilder,
    private snackBar: NotificationService,
    private subjectService: SubjectService,
    private cdr: ChangeDetectorRef
  ) {
    this.subjectForm = this.fb.group({
      subjectName: ['', Validators.required],
      subjectCode: ['', Validators.required],
      subjectType: [null],
      subjectCategory: [null],
      medium: [null],
      isActive: [true],
    });
  }

  ngOnInit() {
    if (this.subjectId && this.mode !== 'add') {
      this.loadSubjectData(this.subjectId);
    }
  }

  get pageTitle(): string {
    if (this.mode === 'edit') return 'Edit subject';
    if (this.mode === 'view') return 'View subject';
    return 'Add new subject';
  }



  loadSubjectData(id: string) {
    this.subjectService.getSubject(id).subscribe({
      next: (data: any) => {
        this.subjectForm.patchValue({
          subjectName: data?.subjectName,
          subjectCode: data?.subjectCode,
          subjectType: this.normalizeEnumValue(SubjectType, data?.subjectType),
          subjectCategory: this.normalizeEnumValue(SubjectCategory, data?.subjectCategory),
          medium: this.normalizeEnumValue(Medium, data?.medium),
          isActive: data?.isActive ?? true,
        });
        if (this.mode === 'view') {
          this.subjectForm.disable();
        }
        this.cdr.detectChanges();
      },
      error: () => this.snackBar.open('Error loading subject data', 'Close', { duration: 3000 }),
    });
  }

  private normalizeEnumValue<T extends Record<string, string>>(enumObj: T, value: unknown): string | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') {
      const label = Object.values(enumObj)[value - 1];
      return label ?? null;
    }
    const text = String(value);
    const exact = Object.values(enumObj).find((o) => o === text);
    if (exact) return exact;
    const n = text.replace(/[-_\s]/g, '').toLowerCase();
    return Object.values(enumObj).find((o) => o.replace(/[-_\s]/g, '').toLowerCase() === n) ?? null;
  }

  private buildSubjectApiPayload(raw: Record<string, unknown>): Record<string, unknown> {
    return {
      subjectName: String(raw['subjectName'] ?? '').trim(),
      subjectCode: String(raw['subjectCode'] ?? '').trim(),
      subjectType: raw['subjectType'] ?? null,
      subjectCategory: raw['subjectCategory'] ?? null,
      medium: raw['medium'] ?? null,
      assignedClasses: [],
      periodsPerWeek: 1,
      periodDuration: '45',
      teachingDays: [],
      maxTheory: 80,
      maxPractical: 20,
      passingMarks: 33,
      gradeSystem: 'marks',
      syllabusTextbook: null,
      curriculum: null,
      description: null,
      isActive: raw['isActive'] ?? true,
    };
  }

  private resolveSaveError(err: unknown): string {
    const body = (err as { error?: unknown })?.error;
    if (typeof body === 'string' && body.trim()) {
      return body;
    }
    if (body && typeof body === 'object') {
      const record = body as Record<string, unknown>;
      if (record['errors'] && typeof record['errors'] === 'object') {
        const messages = Object.values(record['errors'] as Record<string, unknown>)
          .flatMap((v) => (Array.isArray(v) ? v : [v]))
          .map((m) => String(m))
          .filter(Boolean);
        if (messages.length) {
          return messages.join(' ');
        }
      }
      const message = record['message'] ?? record['title'];
      if (typeof message === 'string' && message.trim()) {
        return message;
      }
    }
    return 'Failed to save subject. Please check the form and try again.';
  }

  saveSubject() {
    if (this.subjectForm.invalid) {
      this.subjectForm.markAllAsTouched();
      this.snackBar.open('Please fill all required fields correctly', 'Close', {
        duration: 3000,
        panelClass: 'snack-error',
      });
      return;
    }

    this.isSaving = true;
    const subjectPayload = this.buildSubjectApiPayload(this.subjectForm.getRawValue());

    const saveObs =
      this.mode === 'edit' && this.subjectId
        ? this.subjectService.updateSubject(this.subjectId, subjectPayload as any)
        : this.subjectService.createSubject(subjectPayload as any);

    saveObs
      .pipe(
        finalize(() => {
          this.isSaving = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: () => {
          this.snackBar.open(`Subject ${this.mode === 'edit' ? 'updated' : 'saved'} successfully`, 'Close', {
            duration: 3000,
            panelClass: 'snack-success',
          });
          this.saved.emit();
        },
        error: (err) => {
          this.snackBar.open(this.resolveSaveError(err), 'Close', { duration: 5000, panelClass: 'snack-error' });
        },
      });
  }
}
