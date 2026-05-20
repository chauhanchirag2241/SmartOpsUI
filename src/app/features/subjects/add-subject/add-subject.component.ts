import { Component, EventEmitter, Input, Output, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';

import { DynamicFieldComponent } from '../../../shared/form-controls/dynamic-field/dynamic-field.component';
import { FormFieldConfig } from '../../../shared/interfaces/form-field-config';
import {
  enumToOptions,
  Medium,
  SubjectType,
  SubjectCategory,
} from '../../../shared/enums/field-options.enum';
import { SubjectService } from '../../../core/services/subject.service';

type FieldItem = { key: string; full?: boolean };
type FormCard = { tab: number; icon: string; title: string; grid: 'grid2' | 'grid3'; fields: FieldItem[] };

@Component({
  selector: 'app-add-subject',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule, DynamicFieldComponent],
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
    subjectType: { type: 'select', controlName: 'subjectType', label: 'Subject type', options: enumToOptions(SubjectType) },
    subjectCategory: {
      type: 'select',
      controlName: 'subjectCategory',
      label: 'Subject category',
      options: enumToOptions(SubjectCategory),
    },
    medium: { type: 'select', controlName: 'medium', label: 'Medium of instruction', options: enumToOptions(Medium) },
  };

  readonly formCards: FormCard[] = [
    {
      tab: 0,
      icon: 'auto_stories',
      title: 'Subject identity',
      grid: 'grid2',
      fields: [
        { key: 'subjectName' },
        { key: 'subjectCode' },
        { key: 'subjectType' },
        { key: 'subjectCategory' },
        { key: 'medium', full: true },
      ],
    },
  ];

  constructor(
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private subjectService: SubjectService,
    private cdr: ChangeDetectorRef
  ) {
    this.subjectForm = this.fb.group({
      subjectName: ['', Validators.required],
      subjectCode: ['', Validators.required],
      subjectType: [''],
      subjectCategory: [''],
      medium: [''],
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

  get cardsForCurrentTab(): FormCard[] {
    return this.formCards;
  }

  trackFormCard(_index: number, card: FormCard): string {
    return `${card.tab}-${card.title}`;
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

  private normalizeEnumValue<T extends Record<string, string>>(enumObj: T, value: unknown): string {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'number') return Object.values(enumObj)[value - 1] ?? '';
    const text = String(value);
    const exact = Object.values(enumObj).find((o) => o === text);
    if (exact) return exact;
    const n = text.replace(/[-_\s]/g, '').toLowerCase();
    return Object.values(enumObj).find((o) => o.replace(/[-_\s]/g, '').toLowerCase() === n) ?? '';
  }

  private buildSubjectApiPayload(raw: Record<string, unknown>): Record<string, unknown> {
    return {
      subjectName: raw['subjectName'],
      subjectCode: raw['subjectCode'],
      subjectType: raw['subjectType'],
      subjectCategory: raw['subjectCategory'],
      medium: raw['medium'],
      assignedClasses: [],
      periodsPerWeek: 1,
      periodDuration: '',
      teachingDays: [],
      maxTheory: 80,
      maxPractical: 20,
      passingMarks: 33,
      gradeSystem: 'marks',
      syllabusTextbook: '',
      curriculum: '',
      description: '',
      isActive: raw['isActive'] ?? true,
    };
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
          const errorMsg = err?.error?.message || err?.message || 'Error saving subject';
          this.snackBar.open(errorMsg, 'Close', { duration: 4000, panelClass: 'snack-error' });
        },
      });
  }
}
