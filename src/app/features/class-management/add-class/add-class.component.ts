import { Component, EventEmitter, Output, Input, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NotificationService } from '../../../core/services/notification.service';
import { EMPTY, finalize, switchMap } from 'rxjs';

import { DynamicFieldComponent } from '../../../shared/form-controls/dynamic-field/dynamic-field.component';
import { ActionButtonComponent } from '../../../shared/components/action-button/action-button.component';
import { PageChromeDirective } from '../../../shared/directives/page-chrome.directive';
import { FormTab } from '../../../shared/interfaces/form-layout';
import { FormFieldConfig } from '../../../shared/interfaces/form-field-config';
import { SELECT_PLACEHOLDER } from '../../../shared/constants/form.constants';
import { ClassService } from '../../../core/services/class.service';
import { ShiftService } from '../../../core/services/shift.service';
import { getUserFacingApiError } from '../../../shared/utils/api-error.util';

@Component({
  selector: 'app-add-class',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule, MatSnackBarModule, DynamicFieldComponent, ActionButtonComponent, PageChromeDirective],
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
    classGroupId: {
      type: 'select',
      controlName: 'classGroupId',
      label: 'Class',
      placeholder: 'Select class group',
      options: [],
      validations: [{ name: 'required', message: 'Class is required', validator: Validators.required }],
    },
    section: {
      type: 'input',
      controlName: 'section',
      label: 'Section',
      placeholder: 'e.g. A, B, 1, 2',
      validations: [{ name: 'required', message: 'Section is required', validator: Validators.required }],
    },
    studentCapacity: {
      type: 'input',
      inputType: 'number',
      controlName: 'studentCapacity',
      label: 'Student capacity',
      placeholder: 'Enter capacity',
    },
    roomNumber: { type: 'input', controlName: 'roomNumber', label: 'Room number', placeholder: 'Room number' },
    shiftId: {
      type: 'select',
      controlName: 'shiftId',
      label: 'Shift',
      placeholder: SELECT_PLACEHOLDER,
      options: [],
    },
  };

  readonly tabs: FormTab[] = [
    {
      stepIndex: 0,
      sections: [
        {
          title: 'Class identity',
          icon: 'school',
          layout: 'grid2',
          fields: ['classGroupId', 'section'],
        },
        {
          title: 'Room & schedule',
          icon: 'meeting_room',
          layout: 'grid2',
          fields: ['studentCapacity', 'roomNumber', 'shiftId'],
        },
      ],
    },
  ];

  constructor(
    private fb: FormBuilder,
    private classService: ClassService,
    private shiftService: ShiftService,
    private snackBar: NotificationService,
    private cdr: ChangeDetectorRef
  ) {
    this.classForm = this.fb.group({
      classGroupId: ['', Validators.required],
      section: ['', Validators.required],
      studentCapacity: [''],
      roomNumber: [''],
      shiftId: [null],
      status: ['Active'],
    });
  }

  get pageTitle(): string {
    if (this.mode === 'edit') return 'Edit class';
    if (this.mode === 'view') return 'View class';
    return 'Add new class';
  }

  ngOnInit(): void {
    this.loadClassGroupOptions();
    this.loadShiftOptions();
    if ((this.mode === 'edit' || this.mode === 'view') && this.classId) {
      this.loadClass(this.classId);
    }
    if (this.mode === 'view') {
      this.classForm.disable();
    }
  }

  private loadClassGroupOptions(): void {
    this.classService.getClassDropdown(undefined, 'group').subscribe({
      next: (items) => {
        this.configs['classGroupId'].options = (items || []).map((g) => ({
          label: g.name,
          value: g.id,
        }));
        this.cdr.detectChanges();
      },
      error: () => {
        this.configs['classGroupId'].options = [];
        this.snackBar.open('Failed to load class groups. Create them in Config first.', 'Close', {
          duration: 4000,
          panelClass: 'snack-error',
        });
      },
    });
  }

  private loadShiftOptions(): void {
    this.shiftService.getShiftDropdown().subscribe({
      next: (items) => {
        this.configs['shiftId'].options = (items || []).map((s) => ({
          label: s.name,
          value: s.id,
        }));
        this.cdr.detectChanges();
      },
      error: () => {
        this.configs['shiftId'].options = [];
      },
    });
  }

  private loadClass(id: string): void {
    this.classService.getClassById(id).subscribe({
      next: (res: any) => {
        this.classForm.patchValue({
          classGroupId: res.classGroupId ?? '',
          section: res.section ?? '',
          studentCapacity: res.capacity,
          roomNumber: res.roomNumber,
          shiftId: res.shiftId ?? null,
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
            const classLabel =
              this.configs['classGroupId'].options?.find((o) => o.value === payloadRaw.classGroupId)?.label ??
              'Class';
            this.snackBar.open(
              `Duplicate class not allowed: ${classLabel} - ${payloadRaw.section}`,
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
        error: (err) =>
          this.snackBar.open(
            getUserFacingApiError(err, 'Failed to save class'),
            'Close',
            { duration: 3000, panelClass: 'snack-error' },
          ),
      });
  }

  private isDuplicateCombination(row: any, payload: any): boolean {
    const rowId = String(row?.id ?? '');
    if (this.mode === 'edit' && this.classId && rowId === String(this.classId)) {
      return false;
    }

    const rowGroup = String(row?.classGroupId ?? '').trim().toLowerCase();
    const rowSection = String(row?.section ?? '').trim().toLowerCase();
    const formGroup = String(payload?.classGroupId ?? '').trim().toLowerCase();
    const formSection = String(payload?.section ?? '').trim().toLowerCase();

    return rowGroup === formGroup && rowSection === formSection;
  }
}
