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
import { FileUploadComponent } from '../../components/file-upload/file-upload.component';
import type { FormFieldConfig, SelectOption } from '../../interfaces/form-field-config';
import {
  formatAadhaarDisplay,
  sanitizeAlphanumericInput,
  sanitizeNameInput,
  stripAadhaarDigits,
  syncShiftTimeValidity,
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
    FileUploadComponent,
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

  @HostBinding('class')
  get customClass(): string {
    return this.config?.className || '';
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

  get datepickerMax(): Date | null {
    const max = this.config.maxDate;
    if (!max) {
      return null;
    }
    if (max === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today;
    }
    return max;
  }

  get datepickerMin(): Date | null {
    const min = this.config.minDate;
    if (!min) {
      return null;
    }
    if (min === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today;
    }
    return min;
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

  setControlValue(controlName: string, value: unknown): void {
    const control = this.group.get(controlName);
    if (!control || control.disabled || this.config.disabled) return;
    control.setValue(value);
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
    if (this.config.inputType === 'tel') return this.config.maxLength || 10;
    if (this.isNameField() && this.config.maxLength) return this.config.maxLength;
    if (this.config.maxLength) return this.config.maxLength;
    return null;
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

  openTimePicker(event: Event): void {
    try {
      if ('showPicker' in HTMLInputElement.prototype) {
        (event.target as HTMLInputElement).showPicker();
      }
    } catch {
      // Fallback if showPicker fails
    }
  }

  onFieldInput(event: Event): void {
    if (this.config.inputType === 'time') {
      this.onTimeInput();
      return;
    }
    if (this.isAadhaarField()) {
      this.onAadhaarInput(event, this.config.controlName);
    } else if (this.isPanField()) {
      this.onPanInput(event, this.config.controlName);
    } else if (this.isNameField()) {
      this.onNameInput(event, this.config.controlName);
    } else if (this.isAlphanumericField()) {
      this.onAlphanumericInput(event, this.config.controlName);
    }
  }

  onFieldBlur(): void {
    if (this.config.inputType === 'time') {
      this.onTimeBlur();
      return;
    }
    if (this.isNameField()) {
      this.onNameBlur(this.config.controlName);
    } else if (this.isAlphanumericField()) {
      this.onAlphanumericBlur(this.config.controlName);
    }
  }

  private onTimeInput(): void {
    if (this.isShiftTimeField()) {
      syncShiftTimeValidity(this.group);
    }
  }

  private onTimeBlur(): void {
    const control = this.group.get(this.config.controlName);
    control?.markAsTouched();
    if (this.isShiftTimeField()) {
      syncShiftTimeValidity(this.group);
    }
  }

  private isShiftTimeField(): boolean {
    return (
      this.config.controlName === 'shiftStartTime' || this.config.controlName === 'shiftEndTime'
    );
  }

  isNameField(): boolean {
    return this.config.inputFormat === 'name';
  }

  isAlphanumericField(): boolean {
    return this.config.inputFormat === 'alphanumeric';
  }

  usesDigitsOnly(): boolean {
    return this.config.inputType === 'tel' || this.isAadhaarField();
  }
}
