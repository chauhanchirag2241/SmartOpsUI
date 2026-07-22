import { Component, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';

import { ActionButtonComponent } from '../../../shared/components/action-button/action-button.component';
import { DynamicFieldComponent } from '../../../shared/form-controls/dynamic-field/dynamic-field.component';
import { FormFieldConfig, SelectOption } from '../../../shared/interfaces/form-field-config';
import { SELECT_PLACEHOLDER } from '../../../shared/constants/form.constants';

export interface TimetableSlotDialogData {
  dayLabel: string;
  periodName: string;
  subjectId: string;
  employeeId: string;
  roomNo: string;
  subjects: { id: string; name: string; code?: string }[];
  employeesForSubject: (subjectId: string) => { id: string; name: string }[];
}

export interface TimetableSlotDialogResult {
  subjectId: string;
  employeeId: string;
  roomNo: string;
}

@Component({
  selector: 'app-timetable-slot-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatIconModule,
    DynamicFieldComponent,
    ActionButtonComponent,
  ],
  template: `
    <div class="slot-dialog">
      <div class="dialog-header">
        <div class="dialog-header-text">
          <div class="dialog-eyebrow">Assign slot</div>
          <h2 class="dialog-title">{{ data.dayLabel }} / {{ data.periodName }}</h2>
        </div>
        <button type="button" class="dialog-close" mat-dialog-close aria-label="Close">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form class="dialog-body" [formGroup]="form" (ngSubmit)="save()">
        <div class="card">
          <div class="card-title"><mat-icon>event_available</mat-icon> Slot details</div>
          <div class="grid1">
            <app-dynamic-field [config]="configs['subjectId']" [group]="form" [full]="true" />
            <app-dynamic-field [config]="configs['employeeId']" [group]="form" [full]="true" />
            <app-dynamic-field [config]="configs['roomNo']" [group]="form" [full]="true" />
          </div>
          @if (!data.subjects.length) {
            <p class="form-hint">
              No subjects available. Add subjects in Subject Master first.
            </p>
          }
        </div>

        <div class="footer-actions">
          <app-action-button type="cancel" label="Clear" icon="delete_outline" (action)="clear()" />
          <div class="footer-actions-right">
            <app-action-button type="cancel" (action)="ref.close()" />
            <app-action-button
              type="save"
              label="Apply"
              icon="check_circle"
              [disabled]="form.invalid"
              (action)="save()"
            />
          </div>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      .slot-dialog {
        min-width: min(420px, 92vw);
        max-width: 480px;
      }

      .dialog-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        padding: 16px 16px 0;
      }

      .dialog-eyebrow {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--g600, #4a7c18);
        margin-bottom: 2px;
      }

      .dialog-title {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 600;
        color: var(--text-heading, #1a1a1a);
        line-height: 1.3;
      }

      .dialog-close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border: none;
        border-radius: 8px;
        background: transparent;
        color: var(--text-secondary, #6b7280);
        cursor: pointer;
      }

      .dialog-close:hover {
        background: var(--g50, #eaf3de);
        color: var(--g600, #4a7c18);
      }

      .dialog-body {
        padding: 12px 16px 4px;
      }

      .dialog-body .card {
        margin-bottom: 0;
      }

      .grid1 {
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px;
      }

      .footer-actions {
        margin-top: 8px;
        margin-bottom: 8px;
        border-top: none;
        padding-top: 8px;
      }
    `,
  ],
})
export class TimetableSlotDialogComponent implements OnDestroy {
  readonly data = inject<TimetableSlotDialogData>(MAT_DIALOG_DATA);
  readonly ref = inject(MatDialogRef<TimetableSlotDialogComponent, TimetableSlotDialogResult | 'clear'>);
  private readonly fb = inject(FormBuilder);

  private subjectSub?: Subscription;

  readonly form = this.fb.group({
    subjectId: [this.data.subjectId || '', Validators.required],
    employeeId: [this.data.employeeId || ''],
    roomNo: [this.data.roomNo || ''],
  });

  readonly configs: Record<string, FormFieldConfig> = {
    subjectId: {
      type: 'select',
      controlName: 'subjectId',
      label: 'Subject',
      placeholder: SELECT_PLACEHOLDER,
      options: this.toSubjectOptions(this.data.subjects),
      validations: [{ name: 'required', message: 'Subject is required', validator: Validators.required }],
    },
    employeeId: {
      type: 'select',
      controlName: 'employeeId',
      label: 'Teacher',
      placeholder: SELECT_PLACEHOLDER,
      options: this.toEmployeeOptions(this.data.employeesForSubject(this.data.subjectId || '')),
    },
    roomNo: {
      type: 'input',
      controlName: 'roomNo',
      label: 'Room no.',
      placeholder: 'e.g. Lab-2',
    },
  };

  constructor() {
    this.subjectSub = this.form.get('subjectId')!.valueChanges.subscribe((subjectId) => {
      this.refreshTeachers(subjectId || '');
    });
  }

  ngOnDestroy(): void {
    this.subjectSub?.unsubscribe();
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    this.ref.close({
      subjectId: String(raw.subjectId ?? '').trim(),
      employeeId: String(raw.employeeId ?? '').trim(),
      roomNo: String(raw.roomNo ?? '').trim(),
    });
  }

  clear(): void {
    this.ref.close('clear');
  }

  private refreshTeachers(subjectId: string): void {
    const employees = this.data.employeesForSubject(subjectId);
    this.configs['employeeId'] = {
      ...this.configs['employeeId'],
      options: this.toEmployeeOptions(employees),
    };
    const current = this.form.get('employeeId')?.value;
    if (!employees.some((e) => e.id === current)) {
      this.form.patchValue({ employeeId: employees[0]?.id || '' }, { emitEvent: false });
    }
  }

  private toSubjectOptions(subjects: { id: string; name: string; code?: string }[]): SelectOption[] {
    return subjects.map((s) => ({
      value: s.id,
      label: s.code ? `${s.name} (${s.code})` : s.name,
    }));
  }

  private toEmployeeOptions(employees: { id: string; name: string }[]): SelectOption[] {
    return employees.map((e) => ({ value: e.id, label: e.name }));
  }
}
