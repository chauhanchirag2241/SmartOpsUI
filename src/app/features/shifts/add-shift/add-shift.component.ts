import { Component, EventEmitter, Input, Output, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { NotificationService } from '../../../core/services/notification.service';

import { DynamicFieldComponent } from '../../../shared/form-controls/dynamic-field/dynamic-field.component';
import { ActionButtonComponent } from '../../../shared/components/action-button/action-button.component';
import { PageChromeDirective } from '../../../shared/directives/page-chrome.directive';
import { FormTab } from '../../../shared/interfaces/form-layout';
import { FormFieldConfig } from '../../../shared/interfaces/form-field-config';
import { ShiftService } from '../../../core/services/shift.service';
import { getUserFacingApiError } from '../../../shared/utils/api-error.util';

@Component({
  selector: 'app-add-shift',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    DynamicFieldComponent,
    ActionButtonComponent,
    PageChromeDirective,
  ],
  templateUrl: './add-shift.component.html',
  styleUrl: './add-shift.component.css',
})
export class AddShiftComponent implements OnInit {
  @Input() mode: 'add' | 'edit' | 'view' = 'add';
  @Input() shiftId?: string;
  @Output() cancel = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  shiftForm: FormGroup;
  isSaving = false;

  readonly configs: Record<string, FormFieldConfig> = {
    shiftName: {
      type: 'input',
      controlName: 'shiftName',
      label: 'Shift name',
      placeholder: 'e.g. Morning',
      validations: [
        { name: 'required', message: 'Shift name is required', validator: Validators.required },
      ],
    },
    startTime: {
      type: 'input',
      inputType: 'time',
      controlName: 'startTime',
      label: 'Start time',
      validations: [
        { name: 'required', message: 'Start time is required', validator: Validators.required },
      ],
    },
    endTime: {
      type: 'input',
      inputType: 'time',
      controlName: 'endTime',
      label: 'End time',
      validations: [
        { name: 'required', message: 'End time is required', validator: Validators.required },
      ],
    },
    displayOrder: {
      type: 'input',
      inputType: 'number',
      controlName: 'displayOrder',
      label: 'Display order',
      placeholder: '0',
    },
  };

  readonly tabs: FormTab[] = [
    {
      stepIndex: 0,
      sections: [
        {
          title: 'Shift details',
          icon: 'schedule',
          layout: 'grid2',
          fields: ['shiftName', 'displayOrder', 'startTime', 'endTime'],
        },
      ],
    },
  ];

  constructor(
    private fb: FormBuilder,
    private snackBar: NotificationService,
    private shiftService: ShiftService,
    private cdr: ChangeDetectorRef,
  ) {
    this.shiftForm = this.fb.group({
      shiftName: ['', Validators.required],
      startTime: ['', Validators.required],
      endTime: ['', Validators.required],
      displayOrder: [0],
    });
  }

  get pageTitle(): string {
    if (this.mode === 'edit') return 'Edit shift';
    if (this.mode === 'view') return 'View shift';
    return 'Add shift';
  }

  ngOnInit(): void {
    if (this.shiftId && this.mode !== 'add') {
      this.loadShift(this.shiftId);
    }
    if (this.mode === 'view') {
      this.shiftForm.disable();
    }
  }

  private loadShift(id: string): void {
    this.shiftService.getShift(id).subscribe({
      next: (res: any) => {
        this.shiftForm.patchValue({
          shiftName: res.shiftName,
          startTime: this.toTimeInput(res.startTime),
          endTime: this.toTimeInput(res.endTime),
          displayOrder: res.displayOrder ?? 0,
        });
        if (this.mode === 'view') {
          this.shiftForm.disable();
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.snackBar.open('Failed to load shift', 'Close', {
          duration: 3000,
          panelClass: 'snack-error',
        });
      },
    });
  }

  saveShift(): void {
    if (this.shiftForm.invalid || this.mode === 'view') {
      this.shiftForm.markAllAsTouched();
      this.snackBar.open('Please fill all required fields', 'Close', {
        duration: 3000,
        panelClass: 'snack-error',
      });
      return;
    }

    const raw = this.shiftForm.getRawValue();
    const payload = {
      shiftName: String(raw.shiftName).trim(),
      startTime: this.toApiTime(raw.startTime),
      endTime: this.toApiTime(raw.endTime),
      displayOrder: Number(raw.displayOrder) || 0,
    };

    this.isSaving = true;
    const done = () => {
      this.isSaving = false;
      this.cdr.detectChanges();
    };

    if (this.mode === 'edit' && this.shiftId) {
      this.shiftService.updateShift(this.shiftId, payload).subscribe({
        next: () => {
          done();
          this.snackBar.open('Shift updated', 'Close', {
            duration: 3000,
            panelClass: 'snack-success',
          });
          this.saved.emit();
        },
        error: (err: unknown) => {
          done();
          this.snackBar.open(getUserFacingApiError(err, 'Failed to save shift'), 'Close', {
            duration: 3500,
            panelClass: 'snack-error',
          });
        },
      });
      return;
    }

    this.shiftService.createShift(payload).subscribe({
      next: () => {
        done();
        this.snackBar.open('Shift created', 'Close', {
          duration: 3000,
          panelClass: 'snack-success',
        });
        this.saved.emit();
      },
      error: (err: unknown) => {
        done();
        this.snackBar.open(getUserFacingApiError(err, 'Failed to save shift'), 'Close', {
          duration: 3500,
          panelClass: 'snack-error',
        });
      },
    });
  }

  private toTimeInput(value: string | null | undefined): string {
    if (!value) return '';
    return value.length >= 5 ? value.slice(0, 5) : value;
  }

  private toApiTime(value: string | null | undefined): string {
    if (!value) return '';
    return value.length >= 5 ? value.slice(0, 5) : value;
  }
}
