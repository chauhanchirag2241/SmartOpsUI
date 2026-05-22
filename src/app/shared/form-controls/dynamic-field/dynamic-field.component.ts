import { Component, HostBinding, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { SELECT_PLACEHOLDER } from '../../constants/form.constants';
import { DigitsOnlyDirective } from '../../directives/digits-only.directive';
import { LettersOnlyDirective } from '../../directives/letters-only.directive';
import type { FormFieldConfig, SelectOption } from '../../interfaces/form-field-config';
import {
  formatAadhaarDisplay,
  sanitizeAlphanumericInput,
  sanitizeDiscountValueInput,
  sanitizeNameInput,
  stripAadhaarDigits,
  trimNameValue,
} from '../../utils/form-validators.util';

@Component({
  selector: 'app-dynamic-field',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatCheckboxModule,
    DigitsOnlyDirective,
    LettersOnlyDirective,
  ],
  templateUrl: './dynamic-field.component.html',
  styleUrl: './dynamic-field.component.css',
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

  @HostBinding('style.min-width')
  get minWidth(): string {
    return '0';
  }

  get controlId(): string {
    return `df-${this.config.controlName}`;
  }

  get isRequired(): boolean {
    return !!this.config.validations?.some((v) => v.name === 'required');
  }

  getError(): string {
    const control = this.group.get(this.config.controlName);
    if (!control?.errors) {
      return '';
    }

    for (const item of this.config.validations ?? []) {
      if (control.hasError(item.name)) {
        return this.messageForErrorKey(control.errors[item.name], item.message);
      }
    }

    const firstKey = Object.keys(control.errors)[0];
    return this.messageForErrorKey(control.errors[firstKey], 'Invalid field');
  }

  private messageForErrorKey(errorValue: unknown, fallback: string): string {
    if (
      errorValue &&
      typeof errorValue === 'object' &&
      'message' in errorValue &&
      typeof (errorValue as { message: unknown }).message === 'string'
    ) {
      return (errorValue as { message: string }).message;
    }
    return fallback;
  }

  getPlaceholder(): string {
    if (this.group.get(this.config.controlName)?.disabled) {
      return '';
    }
    if (this.config.type === 'select' && !this.config.placeholder) {
      return SELECT_PLACEHOLDER;
    }
    return this.config.placeholder ?? '';
  }

  optionTrack(index: number, option: SelectOption): string {
    return `${index}-${String(option.value)}`;
  }

  onMultiCheckboxChange(controlName: string, value: unknown, checked: boolean): void {
    const control = this.group.get(controlName);
    if (!control) return;

    const currentArray = (control.value ?? []) as unknown[];
    let newArray: unknown[];

    if (checked) {
      newArray = [...currentArray, value];
    } else {
      newArray = currentArray.filter((item) => item !== value);
    }

    control.setValue(newArray);
    control.markAsTouched();
  }

  onNameInput(event: Event, controlName: string): void {
    const input = event.target as HTMLInputElement;
    const maxLen = this.config.maxLength;
    const sanitized = sanitizeNameInput(input.value, maxLen);
    const control = this.group.get(controlName);
    control?.setValue(sanitized, { emitEvent: true });
    if (input.value !== sanitized) {
      input.value = sanitized;
    }
  }

  get inputMaxLength(): number | null {
    if (this.isAadhaarField()) return 14;
    if (this.isPanField()) return 10;
    if (this.config.inputType === 'tel') return 10;
    if (this.isNameField() && this.config.maxLength) return this.config.maxLength;
    if (this.config.maxLength) return this.config.maxLength;
    return null;
  }

  get discountMaxDigits(): number {
    const unit = this.group.get('discountUnit')?.value;
    if (unit === '%') {
      return 3;
    }
    if (unit === 'amount') {
      return 5;
    }
    return 5;
  }

  onDiscountInput(event: Event, controlName: string): void {
    const input = event.target as HTMLInputElement;
    const unit = this.group.get('discountUnit')?.value;
    const sanitized = sanitizeDiscountValueInput(input.value, unit);
    const control = this.group.get(controlName);
    control?.setValue(sanitized === '' ? null : sanitized, { emitEvent: true });
    if (input.value !== sanitized) {
      input.value = sanitized;
    }
    control?.updateValueAndValidity();
  }

  onAlphanumericInput(event: Event, controlName: string): void {
    const input = event.target as HTMLInputElement;
    const maxLen = this.config.maxLength ?? 255;
    const sanitized = sanitizeAlphanumericInput(input.value, maxLen);
    const control = this.group.get(controlName);
    control?.setValue(sanitized, { emitEvent: true });
    if (input.value !== sanitized) {
      input.value = sanitized;
    }
  }

  onAlphanumericBlur(controlName: string): void {
    if (this.config.inputFormat !== 'alphanumeric') return;
    const control = this.group.get(controlName);
    if (!control) return;
    const maxLen = this.config.maxLength ?? 255;
    const sanitized = sanitizeAlphanumericInput(String(control.value ?? ''), maxLen).trim();
    if (sanitized !== control.value) {
      control.setValue(sanitized);
    }
    control.markAsTouched();
  }

  onNameBlur(controlName: string): void {
    if (this.config.inputFormat !== 'name') return;
    const control = this.group.get(controlName);
    if (!control) return;
    const sanitized = sanitizeNameInput(String(control.value ?? ''), this.config.maxLength);
    const trimmed = trimNameValue(sanitized);
    if (trimmed !== control.value) {
      control.setValue(trimmed);
    }
    control.markAsTouched();
  }

  onAadhaarInput(event: Event, controlName: string): void {
    const input = event.target as HTMLInputElement;
    const digits = stripAadhaarDigits(input.value);
    const formatted = formatAadhaarDisplay(digits);
    const control = this.group.get(controlName);
    control?.setValue(formatted, { emitEvent: true });
    if (input.value !== formatted) {
      input.value = formatted;
    }
  }

  onPanInput(event: Event, controlName: string): void {
    const input = event.target as HTMLInputElement;
    const upper = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    const control = this.group.get(controlName);
    control?.setValue(upper, { emitEvent: true });
    if (input.value !== upper) {
      input.value = upper;
    }
  }

  isAadhaarField(): boolean {
    return this.config.inputFormat === 'aadhaar';
  }

  isPanField(): boolean {
    return this.config.inputFormat === 'pan';
  }

  isNameField(): boolean {
    return this.config.inputFormat === 'name';
  }

  isAlphanumericField(): boolean {
    return this.config.inputFormat === 'alphanumeric';
  }

  isDiscountField(): boolean {
    return this.config.inputFormat === 'discount';
  }

  usesDigitsOnly(): boolean {
    return this.config.inputType === 'tel' || this.isAadhaarField() || this.isDiscountField();
  }
}
