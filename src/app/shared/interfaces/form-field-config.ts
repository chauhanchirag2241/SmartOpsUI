import { ValidatorFn } from '@angular/forms';

export interface SelectOption {
  label: string;
  value: unknown;
}

export interface ValidationConfig {
  name: string;
  validator: ValidatorFn;
  message: string;
}

export interface FormFieldConfig {
  type: 'input' | 'select' | 'datepicker' | 'textarea' | 'checkbox' | 'multi-checkbox' | 'number';
  label: string;
  controlName: string;
  inputType?: 'text' | 'email' | 'tel' | 'number' | 'password';
  /** Special input formatting: aadhaar, pan, name-only, or alphanumeric text. */
  inputFormat?: 'aadhaar' | 'pan' | 'name' | 'alphanumeric' | 'discount';
  placeholder?: string;
  options?: SelectOption[];
  validations?: ValidationConfig[];
  disabled?: boolean;
  defaultValue?: unknown;
  /** Max characters (enforced on input and validation). */
  maxLength?: number;
}
