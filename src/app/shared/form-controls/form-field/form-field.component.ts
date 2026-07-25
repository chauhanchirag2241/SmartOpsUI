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
import type { FormFieldOption, FormFieldType, FormFieldVariant } from './form-field.types';

let nextId = 0;

/**
 * Shared themed form field for template-driven screens (exams, reports, etc.).
 * Matches portal `.field` / `.form-control` look; dates use Material datepicker.
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
  @Input() inputId = `app-ff-${++nextId}`;
  @Input() disabled = false;

  @Output() valueChange = new EventEmitter<unknown>();

  value: unknown = '';
  dateValue: Date | null = null;

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
    this.emit(this.formatDate(date));
  }

  trackOption(index: number, option: FormFieldOption): string {
    return `${index}:${String(option.value)}`;
  }

  private parseDate(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }
    const raw = String(value).slice(0, 10);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private formatDate(value: Date | null): string {
    if (!value || Number.isNaN(value.getTime())) return '';
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
