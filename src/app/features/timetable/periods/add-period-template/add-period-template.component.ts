import { Component, EventEmitter, Input, Output, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { NotificationService } from '../../../../core/services/notification.service';
import { finalize } from 'rxjs';

import { ActionButtonComponent } from '../../../../shared/components/action-button/action-button.component';
import { DynamicFieldComponent } from '../../../../shared/form-controls/dynamic-field/dynamic-field.component';
import { PageChromeDirective } from '../../../../shared/directives/page-chrome.directive';
import { FormFieldConfig } from '../../../../shared/interfaces/form-field-config';
import { PeriodTemplateService } from '../../../../core/services/period-template.service';
import { getUserFacingApiError } from '../../../../shared/utils/api-error.util';

@Component({
  selector: 'app-add-period-template',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    ActionButtonComponent,
    DynamicFieldComponent,
    PageChromeDirective,
  ],
  templateUrl: './add-period-template.component.html',
  styleUrl: './add-period-template.component.css',
})
export class AddPeriodTemplateComponent implements OnInit {
  @Input() mode: 'add' | 'edit' | 'view' = 'add';
  @Input() templateId?: string;
  @Output() cancel = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  form: FormGroup;
  isSaving = false;

  readonly configs: Record<string, FormFieldConfig> = {
    name: {
      type: 'input',
      controlName: 'name',
      label: 'Template name',
      placeholder: 'e.g. Primary short day (2 periods)',
      validations: [
        { name: 'required', message: 'Template name is required', validator: Validators.required },
      ],
    },
    description: {
      type: 'input',
      controlName: 'description',
      label: 'Description',
      placeholder: 'Optional notes',
    },
  };

  constructor(
    private fb: FormBuilder,
    private snackBar: NotificationService,
    private templateService: PeriodTemplateService,
    private cdr: ChangeDetectorRef,
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      isActive: [true],
      periods: this.fb.array([]),
    });
  }

  get periods(): FormArray {
    return this.form.get('periods') as FormArray;
  }

  get pageTitle(): string {
    if (this.mode === 'edit') return 'Edit period template';
    if (this.mode === 'view') return 'View period template';
    return 'Add period template';
  }

  ngOnInit(): void {
    if (this.templateId && this.mode !== 'add') {
      this.load(this.templateId);
    } else {
      this.addPeriodRow();
      this.addPeriodRow({ name: 'Break', shortName: 'Br', isBreak: true, startTime: '09:00', endTime: '09:15' });
    }
  }

  addPeriodRow(defaults?: {
    name?: string;
    shortName?: string;
    startTime?: string;
    endTime?: string;
    isBreak?: boolean;
    id?: string;
  }): void {
    const order = this.periods.length + 1;
    this.periods.push(
      this.fb.group({
        id: [defaults?.id || ''],
        name: [defaults?.name || `Period ${order}`, Validators.required],
        shortName: [defaults?.shortName || `P${order}`, Validators.required],
        periodOrder: [order, Validators.required],
        startTime: [defaults?.startTime || '', Validators.required],
        endTime: [defaults?.endTime || '', Validators.required],
        isBreak: [defaults?.isBreak ?? false],
      }),
    );
  }

  removePeriodRow(index: number): void {
    if (this.periods.length <= 1) {
      this.snackBar.open('Template needs at least one period', 'Close', {
        duration: 3000,
        panelClass: 'snack-error',
      });
      return;
    }
    this.periods.removeAt(index);
    this.reindexOrders();
  }

  private reindexOrders(): void {
    this.periods.controls.forEach((ctrl, i) => ctrl.get('periodOrder')?.setValue(i + 1));
  }

  load(id: string): void {
    this.templateService.get(id).subscribe({
      next: (data) => {
        this.form.patchValue({
          name: data.name,
          description: data.description || '',
          isActive: data.isActive ?? true,
        });
        this.periods.clear();
        for (const p of data.periods || []) {
          this.periods.push(
            this.fb.group({
              id: [p.id || ''],
              name: [p.name, Validators.required],
              shortName: [p.shortName, Validators.required],
              periodOrder: [p.periodOrder, Validators.required],
              startTime: [p.startTime, Validators.required],
              endTime: [p.endTime, Validators.required],
              isBreak: [p.isBreak ?? false],
            }),
          );
        }
        if (this.periods.length === 0) this.addPeriodRow();
        if (this.mode === 'view') this.form.disable();
        this.cdr.detectChanges();
      },
      error: () => this.snackBar.open('Error loading template', 'Close', { duration: 3000 }),
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snackBar.open('Please fill template name and all period fields', 'Close', {
        duration: 3000,
        panelClass: 'snack-error',
      });
      return;
    }

    this.isSaving = true;
    const raw = this.form.getRawValue();
    const payload = {
      name: String(raw.name ?? '').trim(),
      description: String(raw.description ?? '').trim() || null,
      isActive: raw.isActive ?? true,
      periods: (raw.periods || []).map((p: any, i: number) => ({
        id: p.id || undefined,
        name: String(p.name ?? '').trim(),
        shortName: String(p.shortName ?? '').trim(),
        periodOrder: Number(p.periodOrder) || i + 1,
        startTime: String(p.startTime ?? '').trim(),
        endTime: String(p.endTime ?? '').trim(),
        isBreak: !!p.isBreak,
      })),
    };

    const done = () => {
      this.isSaving = false;
      this.cdr.detectChanges();
    };
    const onSuccess = () => {
      this.snackBar.open(`Template ${this.mode === 'edit' ? 'updated' : 'saved'} successfully`, 'Close', {
        duration: 3000,
        panelClass: 'snack-success',
      });
      this.saved.emit();
    };
    const onError = (err: unknown) => {
      this.snackBar.open(getUserFacingApiError(err, 'Failed to save template.'), 'Close', {
        duration: 5000,
        panelClass: 'snack-error',
      });
    };

    if (this.mode === 'edit' && this.templateId) {
      this.templateService.update(this.templateId, payload).pipe(finalize(done)).subscribe({
        next: onSuccess,
        error: onError,
      });
    } else {
      this.templateService.create(payload).pipe(finalize(done)).subscribe({
        next: onSuccess,
        error: onError,
      });
    }
  }
}
