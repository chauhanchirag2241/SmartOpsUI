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
  | 'datetime'
  | 'custom';

export type FormFieldVariant = 'default' | 'filter';
