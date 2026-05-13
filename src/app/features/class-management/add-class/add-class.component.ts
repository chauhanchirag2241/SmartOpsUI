import { Component, EventEmitter, Output, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { DynamicFieldComponent } from '../../../shared/form-controls/dynamic-field/dynamic-field.component';
import { FormFieldConfig } from '../../../shared/interfaces/form-field-config';
import { ClassService } from '../../../core/services/class.service';

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

  classForm: FormGroup;
  isSaving = false;

  readonly formFields = [
    'className',
    'section',
    'streamGroup',
    'academicYear',
    'studentCapacity',
    'classTeacher',
    'roomNumber',
    'description',
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
      options: [
        { label: 'A', value: 'A' },
        { label: 'B', value: 'B' },
        { label: 'C', value: 'C' },
        { label: 'D', value: 'D' },
      ],
      validations: [{ name: 'required', message: 'Section is required', validator: Validators.required }],
    },
    streamGroup: {
      type: 'select',
      controlName: 'streamGroup',
      label: 'Stream / group',
      placeholder: 'Select stream or group',
      options: [
        { label: 'None (primary)', value: 'None' },
        { label: 'Science', value: 'Science' },
        { label: 'Commerce', value: 'Commerce' },
        { label: 'Arts', value: 'Arts' },
      ],
    },
    academicYear: {
      type: 'select',
      controlName: 'academicYear',
      label: 'Academic year',
      placeholder: 'Select year',
      options: [
        { label: '2024-2025', value: '2024-2025' },
        { label: '2025-2026', value: '2025-2026' },
        { label: '2026-2027', value: '2026-2027' },
      ],
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
    description: {
      type: 'textarea',
      controlName: 'description',
      label: 'Description / notes',
      placeholder: 'Any special notes about this class...',
    },
  };

  readonly formCard = {
    title: 'Class details',
    icon: 'school',
    grid: 'grid3',
    fields: this.formFields,
  };

  constructor(
    private fb: FormBuilder,
    private classService: ClassService,
    private snackBar: MatSnackBar
  ) {
    this.classForm = this.fb.group({
      className: ['', Validators.required],
      section: ['', Validators.required],
      streamGroup: ['None'],
      academicYear: ['', Validators.required],
      studentCapacity: ['', Validators.required],
      classTeacher: [''],
      roomNumber: [''],
      description: [''],
      status: ['Active'],
    });
  }

  get pageTitle(): string {
    return this.mode === 'add' ? 'Add new class' : this.mode === 'edit' ? 'Edit class' : 'Class details';
  }

  ngOnInit(): void {
    if ((this.mode === 'edit' || this.mode === 'view') && this.classId) {
      this.loadClass(this.classId);
    }
    if (this.mode === 'view') {
      this.classForm.disable();
    }
  }

  private loadClass(id: string): void {
    this.classService.getClassById(id).subscribe({
      next: (res: any) => {
        this.classForm.patchValue({
          className: res.className,
          section: res.section,
          streamGroup: res.streamGroup || 'None',
          academicYear: res.academicYear,
          studentCapacity: res.capacity,
          classTeacher: res.classTeacher,
          roomNumber: res.roomNumber,
          description: res.description,
          status: res.status || 'Active',
        });
        if (this.mode === 'view') {
          this.classForm.disable();
        }
      },
      error: (err: any) => {
        console.error('Error loading class:', err);
        this.snackBar.open('Failed to load class details', 'Close', { duration: 3000, panelClass: 'snack-error' });
      }
    });
  }

  saveClass(): void {
    if (this.classForm.invalid || this.mode === 'view') {
      this.classForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    const payload = this.classForm.getRawValue();

    const request$ = this.mode === 'edit' && this.classId
      ? this.classService.updateClass(this.classId, payload)
      : this.classService.createClass(payload);

    request$.subscribe({
      next: () => {
        this.snackBar.open(this.mode === 'edit' ? 'Class updated successfully' : 'Class added successfully', 'Close', { duration: 3000, panelClass: 'snack-success' });
        this.isSaving = false;
        this.saved.emit();
      },
      error: (err: any) => {
        console.error('Class save failed:', err);
        this.snackBar.open('Failed to save class', 'Close', { duration: 3000, panelClass: 'snack-error' });
        this.isSaving = false;
      }
    });
  }
}
