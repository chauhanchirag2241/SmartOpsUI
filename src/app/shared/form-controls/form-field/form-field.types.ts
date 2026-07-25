export interface FormFieldOption {
  label: string;
  value: string | number | boolean | null;
}

export type FormFieldType =
  | 'text'
  | 'number'
  | 'select'
  | 'textarea'
  | 'date'
  | 'time'
  | 'custom';

export type FormFieldVariant = 'default' | 'filter';
