import { Component, EventEmitter, Output, Input, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';

import { DynamicFieldComponent } from '../../../shared/form-controls/dynamic-field/dynamic-field.component';
import { FormFieldConfig } from '../../../shared/interfaces/form-field-config';
import { Section, StreamGroup, Shift, Medium, enumToOptions } from '../../../shared/enums/field-options.enum';
import { ClassService } from '../../../core/services/class.service';
import { AcademicYearService } from '../../../core/services/academic-year.service';

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
  selector: 'app-add-class',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule, MatSnackBarModule, DynamicFieldComponent],
  templateUrl: './add-class.component.html',
  styleUrl: './add-class.component.css',
})
export class AddClassComponent implements OnInit {
  @Input() mode: 'add' | 'edit' | 'view' = 'add';
  @Input() classId?: string;

  @Output() cancel = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  protected readonly finalTabIndex = 0;
  protected readonly totalTabs = 1;

  classForm: FormGroup;
  currentTab = 0;
  isSaving = false;

  readonly tabs = [
    { label: 'Details', hint: 'Step 1 of 1 — Class details & assignment' },
  ];

  readonly footerHints = [
    'Fill class name, section and teacher details',
  ];

  readonly configs: Record<string, FormFieldConfig> = {
    className: {
      type: 'select',
      controlName: 'className',
      label: 'Class name',
      placeholder: 'Select class',
      options: [
        { label: 'Class 1', value: 'Class 1' },
        { label: 'Class 2', value: 'Class 2' },
        { label: 'Class 3', value: 'Class 3' },
        { label: 'Class 4', value: 'Class 4' },
        { label: 'Class 5', value: 'Class 5' },
        { label: 'Class 6', value: 'Class 6' },
        { label: 'Class 7', value: 'Class 7' },
        { label: 'Class 8', value: 'Class 8' },
        { label: 'Class 9', value: 'Class 9' },
        { label: 'Class 10', value: 'Class 10' },
        { label: 'Class 11', value: 'Class 11' },
        { label: 'Class 12', value: 'Class 12' },
      ],
      validations: [{ name: 'required', message: 'Class name is required', validator: Validators.required }],
    },
    section: {
      type: 'select',
      controlName: 'section',
      label: 'Section',
      placeholder: 'Select section',
      options: enumToOptions(Section),
      validations: [{ name: 'required', message: 'Section is required', validator: Validators.required }],
    },
    streamGroup: {
      type: 'select',
      controlName: 'streamGroup',
      label: 'Stream / group',
      placeholder: 'Select stream or group',
      options: enumToOptions(StreamGroup, (value) => value === StreamGroup.None ? 'None (primary)' : value),
    },
    academicYear: {
      type: 'select',
      controlName: 'academicYear',
      label: 'Academic year',
      placeholder: 'Select year',
      options: [],
      validations: [{ name: 'required', message: 'Academic year is required', validator: Validators.required }],
    },
    studentCapacity: {
      type: 'input',
      inputType: 'number',
      controlName: 'studentCapacity',
      label: 'Student capacity',
      placeholder: 'Enter capacity',
      validations: [{ name: 'required', message: 'Capacity is required', validator: Validators.required }],
    },
    classTeacher: {
      type: 'select',
      controlName: 'classTeacher',
      label: 'Class teacher',
      placeholder: 'Select teacher',
      options: [
        { label: 'Assign later', value: '' },
        { label: 'Mr. Patel', value: 'Mr. Patel' },
        { label: 'Ms. Sharma', value: 'Ms. Sharma' },
        { label: 'Mrs. Kapoor', value: 'Mrs. Kapoor' },
      ],
    },
    roomNumber: {
      type: 'input',
      controlName: 'roomNumber',
      label: 'Room number',
      placeholder: 'e.g. 101',
    },
    shift: {
      type: 'select',
      controlName: 'shift',
      label: 'Shift',
      placeholder: 'Select shift',
      options: enumToOptions(Shift),
    },
    medium: {
      type: 'select',
      controlName: 'medium',
      label: 'Medium',
      placeholder: 'Select medium',
      options: enumToOptions(Medium),
    },
    description: {
      type: 'textarea',
      controlName: 'description',
      label: 'Description / notes',
      placeholder: 'Any special notes about this class...',
    },
  };

  readonly formCards: FormCard[] = [
    {
      tab: 0,
      icon: 'school',
      title: 'Class identity',
      grid: 'grid3',
      fields: [
        { key: 'className' },
        { key: 'section' },
        { key: 'streamGroup' },
      ],
    },
    {
      tab: 0,
      icon: 'event',
      title: 'Academic details',
      grid: 'grid2',
      fields: [
        { key: 'academicYear' },
        { key: 'studentCapacity' },
      ],
    },
    {
      tab: 0,
      icon: 'person',
      title: 'Assignment & Room',
      grid: 'grid2',
      fields: [
        { key: 'classTeacher' },
        { key: 'roomNumber' },
        { key: 'shift' },
        { key: 'medium' },
        { key: 'description', full: true },
      ],
    },
  ];

  constructor(
    private fb: FormBuilder,
    private classService: ClassService,
    private ayService: AcademicYearService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
  ) {
    this.classForm = this.fb.group({
      className: ['', Validators.required],
      section: ['', Validators.required],
      streamGroup: [StreamGroup.None],
      academicYear: ['', Validators.required],
      studentCapacity: ['', Validators.required],
      classTeacher: [''],
      roomNumber: [''],
      shift: [''],
      medium: [''],
      description: [''],
      status: ['Active'],
    });
  }

  get pageTitle(): string {
    if (this.mode === 'edit') return 'Edit class';
    if (this.mode === 'view') return 'View class';
    return 'Add new class';
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

  ngOnInit(): void {
    this.loadAcademicYears();
    if ((this.mode === 'edit' || this.mode === 'view') && this.classId) {
      this.loadClass(this.classId);
    }
    if (this.mode === 'view') {
      this.classForm.disable();
    }
  }

  /** Maps backend int (1-based) → frontend enum string value */
  private static intToEnum<T extends Record<string, string>>(enumObj: T, intValue: number): string {
    const values = Object.values(enumObj);
    return values[intValue - 1] ?? values[0];
  }

  private loadClass(id: string): void {
    this.classService.getClassById(id).subscribe({
      next: (res: any) => {
        this.classForm.patchValue({
          className: res.className,
          section: AddClassComponent.intToEnum(Section, res.section),
          streamGroup: AddClassComponent.intToEnum(StreamGroup, res.streamGroup),
          academicYear: res.academicYear,
          studentCapacity: res.capacity,
          classTeacher: res.classTeacher,
          roomNumber: res.roomNumber,
          shift: AddClassComponent.intToEnum(Shift, res.shift),
          medium: AddClassComponent.intToEnum(Medium, res.medium),
          description: res.description,
          status: res.isActive ? 'Active' : 'Inactive',
        });
        if (this.mode === 'view') {
          this.classForm.disable();
        }
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error loading class:', err);
        this.snackBar.open('Failed to load class details', 'Close', { duration: 3000, panelClass: 'snack-error' });
      }
    });
  }

  private loadAcademicYears(): void {
    this.ayService.getAcademicYears(1, 100).subscribe({
      next: (res: any) => {
        this.configs['academicYear'].options = (res?.items || []).map((ay: any) => ({
          label: ay.title,
          value: ay.id
        }));
        this.cdr.detectChanges();
      }
    });
  }

  goTab(index: number) {
    this.currentTab = index;
  }

  nextTab() {
    if (this.currentTab === this.finalTabIndex) {
      this.saveClass();
      return;
    }
    this.currentTab++;
  }

  prevTab() {
    if (this.currentTab > 0) {
      this.currentTab--;
    }
  }

  saveClass(): void {
    if (this.classForm.invalid || this.mode === 'view') {
      this.classForm.markAllAsTouched();
      this.snackBar.open('Please fill all required fields', 'Close', { duration: 3000, panelClass: 'snack-error' });
      return;
    }

    this.isSaving = true;
    const payload = this.classForm.getRawValue();

    const request$ = this.mode === 'edit' && this.classId
      ? this.classService.updateClass(this.classId, payload)
      : this.classService.createClass(payload);

    request$
      .pipe(finalize(() => {
        this.isSaving = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: () => {
          this.snackBar.open(this.mode === 'edit' ? 'Class updated successfully' : 'Class added successfully', 'Close', { duration: 3000, panelClass: 'snack-success' });
          this.saved.emit();
        },
        error: (err: any) => {
          console.error('Class save failed:', err);
          this.snackBar.open('Failed to save class', 'Close', { duration: 3000, panelClass: 'snack-error' });
        }
      });
  }
}
