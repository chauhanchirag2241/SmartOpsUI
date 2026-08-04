import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  Output,
  EventEmitter,
  forwardRef,
  HostBinding,
} from '@angular/core';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { DatePicker } from 'primeng/datepicker';
import type { FormFieldOption, FormFieldType, FormFieldVariant } from './form-field.types';
import { parseDateOnly, toDateOnlyString } from '../../utils/date-only.util';

let nextId = 0;

/**
 * Shared themed form field for template-driven screens (exams, reports, etc.).
 * Matches portal `.field` / `.form-control` look; dates use Material datepicker;
 * datetime uses PrimeNG (same as dynamic-field / visitors).
 */
@Component({
  selector: 'app-form-field',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    DatePicker,
  ],
  templateUrl: './form-field.component.html',
  styleUrl: './form-field.component.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => FormFieldComponent),
      multi: true,
    },
  ],
})
export class FormFieldComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() type: FormFieldType = 'custom';
  @Input() variant: FormFieldVariant = 'default';
  @Input() required = false;
  @Input() fullWidth = false;
  @Input() placeholder = '';
  @Input() options: FormFieldOption[] = [];
  /** Shown as first select option when set (uses emptyValue). */
  @Input() emptyOptionLabel = '';
  @Input() emptyValue: string | number | null = '';
  @Input() rows = 2;
  @Input() min: number | null = null;
  @Input() max: number | null = null;
  @Input() step: number | string | null = null;
  /** Date-only min/max for `type="date"` (YYYY-MM-DD string or Date). */
  @Input() minDate: string | Date | null = null;
  @Input() maxDate: string | Date | null = null;
  @Input() inputId = `app-ff-${++nextId}`;
  @Input() disabled = false;

  @Output() valueChange = new EventEmitter<unknown>();

  value: unknown = '';
  dateValue: Date | null = null;
  datetimeValue: Date | null = null;

  @HostBinding('class.full')
  get hostFull(): boolean {
    return this.fullWidth;
  }

  @HostBinding('class.filter-variant')
  get hostFilter(): boolean {
    return this.variant === 'filter';
  }

  private onChange: (value: unknown) => void = () => undefined;
  private onTouchedFn: () => void = () => undefined;

  writeValue(value: unknown): void {
    if (this.type === 'datetime') {
      this.datetimeValue = this.parseDateTime(value);
      this.value = this.datetimeValue;
      return;
    }

    this.value = value ?? (this.type === 'number' ? null : '');
    if (this.type === 'date') {
      this.dateValue = this.parseDate(value);
    }
  }

  registerOnChange(fn: (value: unknown) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouchedFn = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  emit(value: unknown): void {
    this.value = value;
    this.onChange(value);
    this.valueChange.emit(value);
    this.onTouched();
  }

  onTouched(): void {
    this.onTouchedFn();
  }

  onDatePicked(date: Date | null): void {
    this.dateValue = date;
    this.emit(toDateOnlyString(date) ?? '');
  }

  onDatetimePicked(date: Date | null): void {
    this.datetimeValue = date;
    this.emit(date);
  }

  get dateMinBound(): Date | null {
    return this.parseDate(this.minDate);
  }

  get dateMaxBound(): Date | null {
    return this.parseDate(this.maxDate);
  }

  trackOption(index: number, option: FormFieldOption): string {
    return `${index}:${String(option.value)}`;
  }

  private parseDate(value: unknown): Date | null {
    return parseDateOnly(value);
  }

  private parseDateTime(value: unknown): Date | null {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  }
}
