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
  type: 'input' | 'select' | 'datepicker' | 'textarea' | 'checkbox';
  label: string;
  controlName: string;
  placeholder?: string;
  options?: SelectOption[];
  validations?: ValidationConfig[];
  disabled?: boolean;
  defaultValue?: unknown;
}
