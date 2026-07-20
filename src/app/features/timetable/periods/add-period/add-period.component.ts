import { Component, EventEmitter, Input, Output, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { NotificationService } from '../../../../core/services/notification.service';
import { finalize } from 'rxjs';

import { DynamicFieldComponent } from '../../../../shared/form-controls/dynamic-field/dynamic-field.component';
import { ActionButtonComponent } from '../../../../shared/components/action-button/action-button.component';
import { PageChromeDirective } from '../../../../shared/directives/page-chrome.directive';
import { FormTab } from '../../../../shared/interfaces/form-layout';
import { FormFieldConfig } from '../../../../shared/interfaces/form-field-config';
import { PeriodService } from '../../../../core/services/period.service';
import { getUserFacingApiError } from '../../../../shared/utils/api-error.util';

@Component({
  selector: 'app-add-period',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule, DynamicFieldComponent, ActionButtonComponent, PageChromeDirective],
  templateUrl: './add-period.component.html',
  styleUrl: './add-period.component.css',
})
export class AddPeriodComponent implements OnInit {
  @Input() mode: 'add' | 'edit' | 'view' = 'add';
  @Input() periodId?: string;
  @Output() cancel = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  periodForm: FormGroup;
  isSaving = false;

  readonly configs: Record<string, FormFieldConfig> = {
    name: {
      type: 'input',
      controlName: 'name',
      label: 'Period name',
      placeholder: 'e.g. Period 1',
      validations: [{ name: 'required', message: 'Name is required', validator: Validators.required }],
    },
    shortName: {
      type: 'input',
      controlName: 'shortName',
      label: 'Short name',
      placeholder: 'e.g. P1',
      validations: [{ name: 'required', message: 'Short name is required', validator: Validators.required }],
    },
    periodOrder: {
      type: 'number',
      controlName: 'periodOrder',
      label: 'Display order',
      placeholder: '1',
      validations: [{ name: 'required', message: 'Order is required', validator: Validators.required }],
    },
    startTime: {
      type: 'input',
      controlName: 'startTime',
      label: 'Start time',
      inputType: 'time',
      validations: [{ name: 'required', message: 'Start time is required', validator: Validators.required }],
    },
    endTime: {
      type: 'input',
      controlName: 'endTime',
      label: 'End time',
      inputType: 'time',
      validations: [{ name: 'required', message: 'End time is required', validator: Validators.required }],
    },
    isBreak: {
      type: 'checkbox',
      controlName: 'isBreak',
      label: 'This is a break / recess',
    },
  };

  readonly tabs: FormTab[] = [
    {
      stepIndex: 0,
      sections: [
        {
          title: 'Period details',
          icon: 'schedule',
          layout: 'grid2',
          fields: ['name', 'shortName', 'periodOrder', 'startTime', 'endTime', 'isBreak'],
        },
      ],
    },
  ];

  constructor(
    private fb: FormBuilder,
    private snackBar: NotificationService,
    private periodService: PeriodService,
    private cdr: ChangeDetectorRef,
  ) {
    this.periodForm = this.fb.group({
      name: ['', Validators.required],
      shortName: ['', Validators.required],
      periodOrder: [1, Validators.required],
      startTime: ['', Validators.required],
      endTime: ['', Validators.required],
      isBreak: [false],
      isActive: [true],
    });
  }

  ngOnInit(): void {
    if (this.periodId && this.mode !== 'add') {
      this.loadPeriodData(this.periodId);
    }
  }

  get pageTitle(): string {
    if (this.mode === 'edit') return 'Edit period';
    if (this.mode === 'view') return 'View period';
    return 'Add period';
  }

  loadPeriodData(id: string): void {
    this.periodService.getPeriod(id).subscribe({
      next: (data: any) => {
        this.periodForm.patchValue({
          name: data?.name,
          shortName: data?.shortName,
          periodOrder: data?.periodOrder ?? 1,
          startTime: data?.startTime,
          endTime: data?.endTime,
          isBreak: data?.isBreak ?? false,
          isActive: data?.isActive ?? true,
        });
        if (this.mode === 'view') this.periodForm.disable();
        this.cdr.detectChanges();
      },
      error: () => this.snackBar.open('Error loading period', 'Close', { duration: 3000 }),
    });
  }

  savePeriod(): void {
    if (this.periodForm.invalid) {
      this.periodForm.markAllAsTouched();
      this.snackBar.open('Please fill all required fields', 'Close', {
        duration: 3000,
        panelClass: 'snack-error',
      });
      return;
    }

    this.isSaving = true;
    const raw = this.periodForm.getRawValue();
    const payload = {
      name: String(raw.name ?? '').trim(),
      shortName: String(raw.shortName ?? '').trim(),
      periodOrder: Number(raw.periodOrder) || 1,
      startTime: String(raw.startTime ?? '').trim(),
      endTime: String(raw.endTime ?? '').trim(),
      isBreak: !!raw.isBreak,
      isActive: raw.isActive ?? true,
    };

    const onSuccess = () => {
      this.snackBar.open(`Period ${this.mode === 'edit' ? 'updated' : 'saved'} successfully`, 'Close', {
        duration: 3000,
        panelClass: 'snack-success',
      });
      this.saved.emit();
    };
    const onError = (err: unknown) => {
      this.snackBar.open(getUserFacingApiError(err, 'Failed to save period.'), 'Close', {
        duration: 5000,
        panelClass: 'snack-error',
      });
    };
    const done = () => {
      this.isSaving = false;
      this.cdr.detectChanges();
    };

    if (this.mode === 'edit' && this.periodId) {
      this.periodService.updatePeriod(this.periodId, payload).pipe(finalize(done)).subscribe({
        next: onSuccess,
        error: onError,
      });
    } else {
      this.periodService.createPeriod(payload).pipe(finalize(done)).subscribe({
        next: onSuccess,
        error: onError,
      });
    }
  }
}
