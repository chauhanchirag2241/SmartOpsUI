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
  PeriodDuration,
  GradeSystem,
  Curriculum
} from '../../../shared/enums/field-options.enum';
import { SubjectService } from '../../../core/services/subject.service';
import { ClassService } from '../../../core/services/class.service';

type FieldItem = {
  key: string;
  full?: boolean;
};

type FormCard = {
  tab: number;
  icon: string;
  title: string;
  grid: 'grid2' | 'grid3';
  fields: FieldItem[];
};

@Component({
  selector: 'app-add-subject',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    DynamicFieldComponent,
  ],
  templateUrl: './add-subject.component.html',
  styleUrl: './add-subject.component.css',
})
export class AddSubjectComponent implements OnInit {
  @Input() mode: 'add' | 'edit' | 'view' = 'add';
  @Input() subjectId?: string;

  @Output() cancel = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  protected readonly finalTabIndex = 2;
  protected readonly totalTabs = 3;

  subjectForm: FormGroup;
  currentTab = 0;
  isSaving = false;

  readonly tabs = [
    { label: 'Identity', hint: 'Step 1 of 3 — Subject identity' },
    { label: 'Schedule', hint: 'Step 2 of 3 — Schedule & teacher' },
    { label: 'Marks', hint: 'Step 3 of 3 — Marks & syllabus' },
  ];

  readonly footerHints = [
    'Fill name, code and select type',
    'Select classes and teaching days',
    'Review subject details and save',
  ];

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
    subjectType: {
      type: 'select',
      controlName: 'subjectType',
      label: 'Subject type',
      options: enumToOptions(SubjectType),
    },
    subjectCategory: {
      type: 'select',
      controlName: 'subjectCategory',
      label: 'Subject category',
      options: enumToOptions(SubjectCategory),
    },
    medium: {
      type: 'select',
      controlName: 'medium',
      label: 'Medium of instruction',
      options: enumToOptions(Medium),
    },
    assignedClasses: {
      type: 'multi-checkbox',
      controlName: 'assignedClasses',
      label: 'Assign to classes',
      options: [],
    },
    periodsPerWeek: {
      type: 'number',
      controlName: 'periodsPerWeek',
      label: 'Periods per week',
      placeholder: '5',
      validations: [
        { name: 'required', message: 'Periods per week is required', validator: Validators.required },
        { name: 'min', message: 'Minimum 1 period', validator: Validators.min(1) },
        { name: 'max', message: 'Maximum 12 periods', validator: Validators.max(12) },
      ],
    },
    periodDuration: {
      type: 'select',
      controlName: 'periodDuration',
      label: 'Period duration',
      options: enumToOptions(PeriodDuration, (val) => `${val} min`),
    },
    teachingDays: {
      type: 'multi-checkbox',
      controlName: 'teachingDays',
      label: 'Teaching days',
      options: [
        { label: 'Mon', value: 'Mon' },
        { label: 'Tue', value: 'Tue' },
        { label: 'Wed', value: 'Wed' },
        { label: 'Thu', value: 'Thu' },
        { label: 'Fri', value: 'Fri' },
        { label: 'Sat', value: 'Sat' },
        { label: 'Sun', value: 'Sun' },
      ],
    },
    maxTheory: {
      type: 'number',
      controlName: 'maxTheory',
      label: 'Theory marks',
      placeholder: '80',
    },
    maxPractical: {
      type: 'number',
      controlName: 'maxPractical',
      label: 'Practical marks',
      placeholder: '20',
    },
    passingMarks: {
      type: 'number',
      controlName: 'passingMarks',
      label: 'Passing marks',
      placeholder: '33',
    },
    gradeSystem: {
      type: 'select',
      controlName: 'gradeSystem',
      label: 'Grade system',
      options: enumToOptions(GradeSystem, (val) => {
        if (val === GradeSystem.Marks) return 'Marks based';
        if (val === GradeSystem.Grade) return 'Grade based (A-F)';
        return 'CGPA';
      }),
    },
    syllabusTextbook: {
      type: 'input',
      controlName: 'syllabusTextbook',
      label: 'Syllabus / textbook',
      placeholder: 'e.g. NCERT Class 9',
    },
    curriculum: {
      type: 'select',
      controlName: 'curriculum',
      label: 'Curriculum',
      options: enumToOptions(Curriculum, (val) => val === Curriculum.StateBoard ? 'State Board' : val),
    },
    description: {
      type: 'textarea',
      controlName: 'description',
      label: 'Description',
      placeholder: 'Brief description of the subject...',
    },
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
    {
      tab: 1,
      icon: 'calendar_month',
      title: 'Teaching schedule',
      grid: 'grid2',
      fields: [
        { key: 'periodsPerWeek' },
        { key: 'periodDuration' },
        { key: 'teachingDays', full: true },
        { key: 'assignedClasses', full: true },
      ],
    },
    {
      tab: 2,
      icon: 'assignment',
      title: 'Marks & Assessment',
      grid: 'grid2',
      fields: [
        { key: 'maxTheory' },
        { key: 'maxPractical' },
        { key: 'passingMarks' },
        { key: 'gradeSystem' },
      ],
    },
    {
      tab: 2,
      icon: 'menu_book',
      title: 'Curriculum & Syllabus',
      grid: 'grid2',
      fields: [
        { key: 'syllabusTextbook' },
        { key: 'curriculum' },
        { key: 'description', full: true },
      ],
    },
  ];

  constructor(
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private subjectService: SubjectService,
    private classService: ClassService,
    private cdr: ChangeDetectorRef
  ) {
    this.subjectForm = this.fb.group({
      subjectName: ['', Validators.required],
      subjectCode: ['', Validators.required],
      subjectType: [''],
      subjectCategory: [''],
      medium: [''],
      assignedClasses: [[]],
      periodsPerWeek: [null, [Validators.required, Validators.min(1), Validators.max(12)]],
      periodDuration: [''],
      teachingDays: [[]],
      maxTheory: [80],
      maxPractical: [20],
      passingMarks: [33],
      gradeSystem: ['marks'],
      syllabusTextbook: [''],
      curriculum: [''],
      description: [''],
      isActive: [true]
    });
  }

  ngOnInit() {
    this.loadClasses();
    if (this.subjectId && this.mode !== 'add') {
      this.loadSubjectData(this.subjectId);
    }
  }

  loadClasses() {
    this.classService.getClassDropdown().subscribe({
      next: (classes) => {
        this.configs['assignedClasses'].options = (classes || []).map((c: any) => ({
          label: c.name,
          value: c.id
        }));
        this.cdr.detectChanges();
      },
      error: () => this.snackBar.open('Error loading classes', 'Close', { duration: 3000 })
    });
  }

  get pageTitle(): string {
    if (this.mode === 'edit') return 'Edit subject';
    if (this.mode === 'view') return 'View subject';
    return 'Add new subject';
  }

  get progressWidthPercent(): number {
    return ((this.currentTab + 1) / this.totalTabs) * 100;
  }

  get cardsForCurrentTab(): FormCard[] {
    return this.formCards.filter((c) => c.tab === this.currentTab);
  }

  trackFormCard(_index: number, card: FormCard): string {
    return `${card.tab}-${card.title}`;
  }

  loadSubjectData(id: string) {
    this.subjectService.getSubject(id).subscribe({
      next: (data: any) => {
        this.subjectForm.patchValue(this.toSubjectFormValue(data));
        if (this.mode === 'view') {
          this.subjectForm.disable();
        }
        this.cdr.detectChanges();
      },
      error: () => this.snackBar.open('Error loading subject data', 'Close', { duration: 3000 })
    });
  }

  private toSubjectFormValue(data: any): any {
    return {
      ...data,
      subjectType: this.normalizeEnumValue(SubjectType, data?.subjectType),
      subjectCategory: this.normalizeEnumValue(SubjectCategory, data?.subjectCategory),
      medium: this.normalizeEnumValue(Medium, data?.medium),
      assignedClasses: this.normalizeArray(data?.assignedClasses),
      teachingDays: this.normalizeArray(data?.teachingDays),
      gradeSystem: this.normalizeEnumValue(GradeSystem, data?.gradeSystem),
      curriculum: this.normalizeEnumValue(Curriculum, data?.curriculum),
    };
  }

  private normalizeEnumValue<T extends Record<string, string>>(enumObj: T, value: unknown): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    if (typeof value === 'number') {
      return Object.values(enumObj)[value - 1] ?? '';
    }

    const text = String(value);
    const exactValue = Object.values(enumObj).find((option) => option === text);
    if (exactValue) {
      return exactValue;
    }

    const normalizedText = text.replace(/[-_\s]/g, '').toLowerCase();
    return Object.values(enumObj).find((option) => option.replace(/[-_\s]/g, '').toLowerCase() === normalizedText) ?? '';
  }

  private normalizeArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    return [];
  }

  goTab(index: number) {
    this.currentTab = index;
  }

  nextTab() {
    if (this.currentTab === this.finalTabIndex) {
      this.saveSubject();
      return;
    }
    this.currentTab++;
  }

  prevTab() {
    if (this.currentTab > 0) {
      this.currentTab--;
    }
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
    const saveObs = (this.mode === 'edit' && this.subjectId)
      ? this.subjectService.updateSubject(this.subjectId, this.subjectForm.getRawValue())
      : this.subjectService.createSubject(this.subjectForm.value);

    saveObs
      .pipe(finalize(() => {
        this.isSaving = false;
        this.cdr.detectChanges();
      }))
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
          this.snackBar.open(errorMsg, 'Close', {
            duration: 4000,
            panelClass: 'snack-error',
          });
        }
      });
  }

  getTotalMarks(): number {
    const theory = this.subjectForm.get('maxTheory')?.value || 0;
    const practical = this.subjectForm.get('maxPractical')?.value || 0;
    return theory + practical;
  }

  getTheoryPercent(): string {
    const total = this.getTotalMarks();
    if (total === 0) return '—';
    const theory = this.subjectForm.get('maxTheory')?.value || 0;
    return `${Math.round((theory / total) * 100)}% of total`;
  }

  getPracticalPercent(): string {
    const total = this.getTotalMarks();
    if (total === 0) return '—';
    const practical = this.subjectForm.get('maxPractical')?.value || 0;
    return `${Math.round((practical / total) * 100)}% of total`;
  }

  getPassingPercent(): string {
    const total = this.getTotalMarks();
    if (total === 0) return '—';
    const passing = this.subjectForm.get('passingMarks')?.value || 0;
    return `${Math.round((passing / total) * 100)}%`;
  }

  isDaySelected(day: any): boolean {
    const selected = this.subjectForm.get('teachingDays')?.value as any[];
    return selected?.includes(day);
  }

  toggleDay(day: any): void {
    const control = this.subjectForm.get('teachingDays');
    const selected = [...(control?.value || [])] as any[];
    const index = selected.indexOf(day);
    if (index >= 0) {
      selected.splice(index, 1);
    } else {
      selected.push(day);
    }
    control?.setValue(selected);
    control?.markAsDirty();
  }

  isClassSelected(cls: any): boolean {
    const selected = this.subjectForm.get('assignedClasses')?.value as any[];
    return selected?.includes(cls);
  }

  toggleClass(cls: any): void {
    const control = this.subjectForm.get('assignedClasses');
    const selected = [...(control?.value || [])] as any[];
    const index = selected.indexOf(cls);
    if (index >= 0) {
      selected.splice(index, 1);
    } else {
      selected.push(cls);
    }
    control?.setValue(selected);
    control?.markAsDirty();
  }
}
