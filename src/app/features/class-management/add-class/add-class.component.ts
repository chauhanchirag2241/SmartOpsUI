import { Component, EventEmitter, Output, Input, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NotificationService } from '../../../core/services/notification.service';
import { EMPTY, finalize, switchMap } from 'rxjs';

import { DynamicFieldComponent } from '../../../shared/form-controls/dynamic-field/dynamic-field.component';
import { ActionButtonComponent } from '../../../shared/components/action-button/action-button.component';
import { FormTab } from '../../../shared/interfaces/form-layout';
import { FormFieldConfig } from '../../../shared/interfaces/form-field-config';
import { SELECT_PLACEHOLDER } from '../../../shared/constants/form.constants';
import { Section, StreamGroup, Shift, Medium, enumToOptions } from '../../../shared/enums/field-options.enum';
import {
  streamGroupDuplicateKey,
  streamGroupFromApiInt,
  formatStreamGroupDisplay,
} from '../../../shared/utils/stream-group.util';
import { ClassService } from '../../../core/services/class.service';
import { AcademicYearService } from '../../../core/services/academic-year.service';



@Component({
  selector: 'app-add-class',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule, MatSnackBarModule, DynamicFieldComponent, ActionButtonComponent],
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
      placeholder: SELECT_PLACEHOLDER,
      options: enumToOptions(StreamGroup),
    },
    academicYear: {
      type: 'select',
      controlName: 'academicYear',
      label: 'Academic year',
      placeholder: SELECT_PLACEHOLDER,
      options: [],
      validations: [{ name: 'required', message: 'Academic year is required', validator: Validators.required }],
    },
    studentCapacity: {
      type: 'input',
      inputType: 'number',
      controlName: 'studentCapacity',
      label: 'Student capacity',
      placeholder: 'Enter capacity',
    },
    roomNumber: { type: 'input', controlName: 'roomNumber', label: 'Room number', placeholder: 'Room number' },
    shift: { type: 'select', controlName: 'shift', label: 'Shift', placeholder: SELECT_PLACEHOLDER, options: enumToOptions(Shift) },
    medium: {
      type: 'select',
      controlName: 'medium',
      label: 'Medium',
      placeholder: SELECT_PLACEHOLDER,
      options: enumToOptions(Medium),
    },
    description: {
      type: 'textarea',
      controlName: 'description',
      label: 'Description / notes',
      placeholder: 'Any special notes about this class...',
    },
  };

  readonly tabs: FormTab[] = [
    {
      stepIndex: 0,
      sections: [
        {
          title: 'Class identity',
          icon: 'school',
          layout: 'grid3',
          fields: ['className', 'section', 'streamGroup'],
        },
        {
          title: 'Academic details',
          icon: 'event',
          layout: 'grid2',
          fields: ['academicYear', 'studentCapacity'],
        },
        {
          title: 'Room & schedule',
          icon: 'meeting_room',
          layout: 'grid2',
          fields: ['roomNumber', 'shift', 'medium', 'description'],
        },
      ],
    },
  ];

  constructor(
    private fb: FormBuilder,
    private classService: ClassService,
    private ayService: AcademicYearService,
    private snackBar: NotificationService,
    private cdr: ChangeDetectorRef
  ) {
    this.classForm = this.fb.group({
      className: ['', Validators.required],
      section: ['', Validators.required],
      streamGroup: [null],
      academicYear: ['', Validators.required],
      studentCapacity: [''],
      roomNumber: [''],
      shift: [null],
      medium: [null],
      description: [''],
      status: ['Active'],
    });
  }

  get pageTitle(): string {
    if (this.mode === 'edit') return 'Edit class';
    if (this.mode === 'view') return 'View class';
    return 'Add new class';
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

  private static intToEnum<T extends Record<string, string>>(
    enumObj: T,
    intValue: number | null | undefined
  ): string | null {
    if (intValue == null || intValue <= 0) {
      return null;
    }
    const values = Object.values(enumObj);
    return values[intValue - 1] ?? null;
  }

  private loadClass(id: string): void {
    this.classService.getClassById(id).subscribe({
      next: (res: any) => {
        this.classForm.patchValue({
          className: res.className,
          section: AddClassComponent.intToEnum(Section, res.section),
          streamGroup: streamGroupFromApiInt(res.streamGroup),
          academicYear: res.academicYearId,
          studentCapacity: res.capacity,
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
      error: () =>
        this.snackBar.open('Failed to load class details', 'Close', { duration: 3000, panelClass: 'snack-error' }),
    });
  }

  private loadAcademicYears(): void {
    this.ayService.getAcademicYearDropdown().subscribe({
      next: (years: any[]) => {
        this.configs['academicYear'].options = (years || []).map((ay: any) => ({
          label: ay.name,
          value: ay.id,
        }));
        this.cdr.detectChanges();
      },
      error: () =>
        this.snackBar.open('Failed to load academic years', 'Close', { duration: 3000, panelClass: 'snack-error' }),
    });
  }

  saveClass(): void {
    if (this.classForm.invalid || this.mode === 'view') {
      this.classForm.markAllAsTouched();
      this.snackBar.open('Please fill all required fields', 'Close', { duration: 3000, panelClass: 'snack-error' });
      return;
    }

    this.isSaving = true;
    const payloadRaw = this.classForm.getRawValue();
    this.classService
      .getClasses(1, 2000, '', null, null, 'All')
      .pipe(
        switchMap((res: any) => {
          const items = (res?.items || []) as any[];
          const duplicate = items.find((row) => this.isDuplicateCombination(row, payloadRaw));
          if (duplicate) {
            const streamLabel = this.getStreamLabel(payloadRaw.streamGroup);
            this.snackBar.open(
              `Duplicate class not allowed: ${payloadRaw.className} - ${payloadRaw.section} - ${streamLabel}`,
              'Close',
              { duration: 3500, panelClass: 'snack-error' },
            );
            return EMPTY;
          }

          return this.mode === 'edit' && this.classId
            ? this.classService.updateClass(this.classId, payloadRaw)
            : this.classService.createClass(payloadRaw);
        }),
        finalize(() => {
          this.isSaving = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: () => {
          this.snackBar.open(
            this.mode === 'edit' ? 'Class updated successfully' : 'Class added successfully',
            'Close',
            { duration: 3000, panelClass: 'snack-success' }
          );
          this.saved.emit();
        },
        error: () =>
          this.snackBar.open('Failed to save class', 'Close', { duration: 3000, panelClass: 'snack-error' }),
      });
  }

  private isDuplicateCombination(row: any, payload: any): boolean {
    const rowId = String(row?.id ?? '');
    if (this.mode === 'edit' && this.classId && rowId === String(this.classId)) {
      return false;
    }

    const rowClass = String(row?.className ?? '').trim().toLowerCase();
    const rowSection = String(row?.section ?? '').trim().toLowerCase();
    const rowStream = streamGroupDuplicateKey(row?.streamGroup);

    const formClass = String(payload?.className ?? '').trim().toLowerCase();
    const formSection = String(payload?.section ?? '').trim().toLowerCase();
    const formStream = streamGroupDuplicateKey(payload?.streamGroup);

    return rowClass === formClass && rowSection === formSection && rowStream === formStream;
  }

  private getStreamLabel(value: unknown): string {
    return formatStreamGroupDisplay(value);
  }
}
