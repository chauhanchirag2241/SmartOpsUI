import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, ValidatorFn } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

import { DynamicFieldComponent } from '../../form-controls/dynamic-field/dynamic-field.component';
import { FormFieldConfig } from '../../interfaces/form-field-config';
import { ErpDialogShellComponent } from '../erp-dialog-shell/erp-dialog-shell.component';
import { ERP_FORM_DIALOG_WIDTH } from '../../constants/dialog.constants';

export interface FormDialogData {
  title: string;
  subtitle?: string;
  saveLabel?: string;
  fields: FormFieldConfig[];
  initialValue?: Record<string, unknown>;
  layout?: 'grid1' | 'grid2';
  /** Dialog content width (defaults to shared add/edit size). */
  width?: string;
  /** Card section title (same pattern as Add Subject). */
  sectionTitle?: string;
  /** Material icon for the card section title. */
  sectionIcon?: string;
  /** Read-only view — no save, fields disabled. */
  viewOnly?: boolean;
}

@Component({
  selector: 'app-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    DynamicFieldComponent,
    ErpDialogShellComponent,
  ],
  template: `
    <app-erp-dialog-shell
      [title]="data.title"
      [subtitle]="data.subtitle || ''"
      [width]="dialogWidth"
      [saveLabel]="data.saveLabel || 'Save'"
      [showSave]="!data.viewOnly"
      [saveDisabled]="form.invalid"
      (cancel)="ref.close()"
      (save)="save()"
    >
      <form [formGroup]="form" (ngSubmit)="save()">
        <div class="card">
          <div class="card-title">
            <mat-icon>{{ data.sectionIcon || 'edit_note' }}</mat-icon>
            {{ data.sectionTitle || 'Details' }}
          </div>
          <div [class]="layoutClass">
            @for (field of data.fields; track field.controlName) {
              <app-dynamic-field
                [config]="field"
                [group]="form"
                [full]="layoutClass === 'grid1'"
              />
            }
          </div>
        </div>
      </form>
    </app-erp-dialog-shell>
  `,
  styles: [
    `
      .card {
        margin-bottom: 0;
      }

      .grid1 {
        display: grid;
        gap: 12px;
      }

      .grid2 {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      @media (max-width: 560px) {
        .grid2 {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class FormDialogComponent {
  readonly data = inject<FormDialogData>(MAT_DIALOG_DATA);
  readonly ref = inject(MatDialogRef<FormDialogComponent, Record<string, unknown> | undefined>);
  private readonly fb = inject(FormBuilder);

  readonly form: FormGroup;
  readonly layoutClass = this.data.layout === 'grid1' ? 'grid1' : 'grid2';
  readonly dialogWidth = this.data.width || ERP_FORM_DIALOG_WIDTH;

  constructor() {
    const controls: Record<string, unknown> = {};
    for (const field of this.data.fields) {
      const validators: ValidatorFn[] = (field.validations ?? [])
        .map((v) => v.validator)
        .filter((v): v is ValidatorFn => !!v);
      const initial = this.data.initialValue?.[field.controlName] ?? (field.type === 'select' ? null : '');
      controls[field.controlName] = [initial, validators];
    }
    this.form = this.fb.group(controls);
    if (this.data.viewOnly) {
      this.form.disable({ emitEvent: false });
    }
  }

  save(): void {
    if (this.data.viewOnly) {
      this.ref.close();
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.ref.close(this.form.getRawValue());
  }
}
