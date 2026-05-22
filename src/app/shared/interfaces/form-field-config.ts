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
  type: 'input' | 'select' | 'datepicker' | 'textarea' | 'checkbox' | 'multi-checkbox' | 'number' | 'badges' | 'file';
  label: string;
  controlName: string;
  inputType?: 'text' | 'email' | 'tel' | 'number' | 'password' | 'time';
  /** Special input formatting: aadhaar, pan, name-only, or alphanumeric text. */
  inputFormat?: 'aadhaar' | 'pan' | 'name' | 'alphanumeric' | 'discount';
  placeholder?: string;
  options?: SelectOption[];
  validations?: ValidationConfig[];
  disabled?: boolean;
  defaultValue?: unknown;
  /** Max characters (enforced on input and validation). */
  maxLength?: number;
  /** Optional CSS class (like col-3, col-2, etc.) to apply to the host element */
  className?: string;
  /** Accepted file types for file upload (e.g. image/png,image/jpeg) */
  accept?: string;
  /** Mode for file upload (avatar or document) */
  fileMode?: 'avatar' | 'document';
}
