import { Component, Input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { DateAdapter, MAT_DATE_FORMATS, NativeDateAdapter, MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormFieldConfig } from '../../interfaces/form-field-config';

import { NgIf } from '@angular/common';

const DATE_ONLY_FORMATS = {
  parse: {
    dateInput: 'DD-MM-YYYY',
  },
  display: {
    dateInput: 'DD-MM-YYYY',
    monthYearLabel: 'MMM YYYY',
    dateA11yLabel: 'DD-MM-YYYY',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};

class DateOnlyAdapter extends NativeDateAdapter {
  override parse(value: unknown): Date | null {
    if (typeof value === 'string') {
      const parts = value.trim().split(/[-/]/).map(Number);
      if (parts.length === 3 && parts.every((part) => Number.isFinite(part))) {
        const [day, month, year] = parts;
        return this.createDate(year, month - 1, day);
      }
    }

    return value ? new Date(value as string | number | Date) : null;
  }

  override format(date: Date, displayFormat: any): string {
    if (displayFormat === DATE_ONLY_FORMATS.display.dateInput) {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    }

    return super.format(date, displayFormat);
  }
}

@Component({
  selector: 'app-datepicker-field',
  imports: [MatDatepickerModule, MatFormFieldModule, MatInputModule, MatNativeDateModule, ReactiveFormsModule, NgIf],
  providers: [
    { provide: DateAdapter, useClass: DateOnlyAdapter },
    { provide: MAT_DATE_FORMATS, useValue: DATE_ONLY_FORMATS },
  ],
  template: `
    <div class="custom-field" [formGroup]="group">
      <label>
        {{ config.label }} 
        <span *ngIf="config.validations?.length">*</span>
      </label>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full-width compact-field">
        <input matInput [matDatepicker]="picker" [formControlName]="config.controlName" [placeholder]="config.placeholder ?? ''" />
        <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
        <mat-datepicker #picker></mat-datepicker>
        <mat-error *ngIf="group.get(config.controlName)?.invalid">Invalid field</mat-error>
      </mat-form-field>
    </div>
  `,
  styles: [`
    .full-width { width: 100%; }
    .custom-field { display: flex; flex-direction: column; gap: 5px; }
    label { font-size: 11px; color: var(--muted, #6b7280); font-weight: 500; }
    label span { color: #E24B4A; margin-left: 2px; }
  `],
})
export class DatepickerFieldComponent {
  @Input({ required: true }) config!: FormFieldConfig;
  @Input({ required: true }) group!: FormGroup;
}
