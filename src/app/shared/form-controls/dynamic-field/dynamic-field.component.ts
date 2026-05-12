import { Component, HostBinding, Input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  DateAdapter,
  MAT_DATE_FORMATS,
  MatNativeDateModule,
  NativeDateAdapter,
} from '@angular/material/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import type { FormFieldConfig, SelectOption } from '../../interfaces/form-field-config';

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

  override format(date: Date, displayFormat: object): string {
    if (String(displayFormat) === DATE_ONLY_FORMATS.display.dateInput) {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    }

    return super.format(date, displayFormat);
  }
}

@Component({
  selector: 'app-dynamic-field',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatCheckboxModule,
  ],
  templateUrl: './dynamic-field.component.html',
  styleUrl: './dynamic-field.component.css',
  providers: [
    { provide: DateAdapter, useClass: DateOnlyAdapter },
    { provide: MAT_DATE_FORMATS, useValue: DATE_ONLY_FORMATS },
  ],
})
export class DynamicFieldComponent {
  @Input({ required: true }) config!: FormFieldConfig;
  @Input({ required: true }) group!: FormGroup;
  @Input() full = false;

  @HostBinding('class.field') readonly fieldClass = true;

  @HostBinding('class.full')
  get fullClass(): boolean {
    return this.full;
  }

  get controlId(): string {
    return `df-${this.config.controlName}`;
  }

  getError(): string {
    const control = this.group.get(this.config.controlName);
    const validation = this.config.validations?.find((item) => control?.hasError(item.name));
    return validation?.message ?? 'Invalid field';
  }

  optionTrack(index: number, option: SelectOption): string {
    return `${index}-${String(option.value)}`;
  }
}
