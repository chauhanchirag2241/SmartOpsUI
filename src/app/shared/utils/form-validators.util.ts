import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { BANK_NAME_MAX_LENGTH, PERSON_NAME_MAX_LENGTH } from '../constants/form.constants';

/** Alphabets and spaces only; trims on validate. */
export const NAME_PATTERN = /^[A-Za-z ]+$/;

/** Letters, digits, spaces, and common separators for class / TC fields. */
export const ALPHANUMERIC_PATTERN = /^[A-Za-z0-9\s.\-/]+$/;

export const AADHAAR_DIGITS_PATTERN = /^[2-9][0-9]{11}$/;

export const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

/** Attached to control errors so UI can show a specific reason. */
export interface ValidationErrorDetail {
  message: string;
}

export function trimNameValue(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Strip digits and symbols while typing (letters and spaces only). */
export function sanitizeNameInput(value: string, maxLength = PERSON_NAME_MAX_LENGTH): string {
  return value.replace(/[^A-Za-z ]/g, '').slice(0, maxLength);
}

export function describeNameError(raw: unknown, maxLength = PERSON_NAME_MAX_LENGTH): string | null {
  const value = String(raw ?? '');
  if (!value.trim()) {
    return null;
  }

  if (/[^A-Za-z ]/.test(value)) {
    return 'Only letters (A–Z) and spaces are allowed — numbers and symbols are not permitted';
  }

  const trimmed = trimNameValue(value);
  if (trimmed.length > maxLength) {
    return `Name cannot exceed ${maxLength} characters`;
  }

  if (!NAME_PATTERN.test(trimmed)) {
    return 'Only letters (A–Z) and spaces are allowed';
  }

  return null;
}

export function nameValidator(maxLength = PERSON_NAME_MAX_LENGTH): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = control.value;
    if (raw == null || String(raw).trim() === '') {
      return null;
    }

    const sanitized = sanitizeNameInput(String(raw), maxLength);
    const trimmed = trimNameValue(sanitized);
    const nextValue = trimmed !== sanitized ? trimmed : sanitized;

    if (nextValue !== String(raw)) {
      control.setValue(nextValue, { emitEvent: false });
    }

    const message = describeNameError(nextValue, maxLength);
    return message ? { namePattern: { message } satisfies ValidationErrorDetail } : null;
  };
}

export function sanitizeAlphanumericInput(value: string, maxLength: number): string {
  return value.replace(/[^A-Za-z0-9\s.\-/]/g, '').slice(0, maxLength);
}

export function describeAlphanumericError(raw: unknown, maxLength: number): string | null {
  const value = String(raw ?? '');
  if (!value.trim()) {
    return null;
  }
  if (value.length > maxLength) {
    return `Cannot exceed ${maxLength} characters`;
  }
  if (!ALPHANUMERIC_PATTERN.test(value.trim())) {
    return 'Only letters, numbers, spaces, and . - / are allowed';
  }
  return null;
}

export function alphanumericValidator(maxLength: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = control.value;
    if (raw == null || String(raw).trim() === '') {
      return null;
    }
    const sanitized = sanitizeAlphanumericInput(String(raw), maxLength);
    if (sanitized !== String(raw)) {
      control.setValue(sanitized, { emitEvent: false });
    }
    const message = describeAlphanumericError(sanitized, maxLength);
    return message ? { alphanumeric: { message } satisfies ValidationErrorDetail } : null;
  };
}

export function maxLengthValidator(maxLength: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = control.value;
    if (raw == null || String(raw).trim() === '') {
      return null;
    }
    const text = String(raw);
    if (text.length > maxLength) {
      return {
        maxLength: { message: `Cannot exceed ${maxLength} characters` } satisfies ValidationErrorDetail,
      };
    }
    return null;
  };
}

export function alphanumericValidationConfig(
  maxLength: number,
  required = false,
): {
  validations: { name: string; validator: ValidatorFn; message: string }[];
} {
  const validations = [
    {
      name: 'alphanumeric',
      validator: alphanumericValidator(maxLength),
      message: `Use letters and numbers only (max ${maxLength} characters)`,
    },
  ];
  if (required) {
    validations.unshift({
      name: 'required',
      validator: Validators.required,
      message: 'This field is required',
    });
  }
  return { validations };
}

export function textMaxLengthValidationConfig(maxLength: number): {
  validations: { name: string; validator: ValidatorFn; message: string }[];
} {
  return {
    validations: [
      {
        name: 'maxLength',
        validator: maxLengthValidator(maxLength),
        message: `Cannot exceed ${maxLength} characters`,
      },
    ],
  };
}

export function bankNameValidator(maxLength = BANK_NAME_MAX_LENGTH): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = control.value;
    if (raw == null || String(raw).trim() === '') {
      return null;
    }
    const text = String(raw).trim();
    if (text.length > maxLength) {
      return {
        bankName: { message: `Bank name cannot exceed ${maxLength} characters` } satisfies ValidationErrorDetail,
      };
    }
    return null;
  };
}

/** Human-readable reason when Aadhaar value is present but invalid. */
export function describeAadhaarError(raw: unknown): string | null {
  const digits = stripAadhaarDigits(String(raw ?? ''));
  if (!digits) {
    return null;
  }

  if (digits.length !== 12) {
    return digits.length < 12
      ? `Aadhaar must be 12 digits (${digits.length} entered so far)`
      : `Aadhaar must be exactly 12 digits (${digits.length} entered)`;
  }

  if (digits[0] === '0' || digits[0] === '1') {
    return 'Aadhaar cannot start with 0 or 1 — first digit must be between 2 and 9';
  }

  if (!/^\d+$/.test(digits)) {
    return 'Aadhaar must contain only numbers (no letters or symbols)';
  }

  if (!AADHAAR_DIGITS_PATTERN.test(digits)) {
    return 'Aadhaar format is invalid — use 12 digits with first digit 2–9 (e.g. 2345 6789 0123)';
  }

  return null;
}

/** Human-readable reason when PAN value is present but invalid. */
export function describePanError(raw: unknown): string | null {
  const normalized = String(raw ?? '')
    .trim()
    .toUpperCase();

  if (!normalized) {
    return null;
  }

  if (normalized.length !== 10) {
    return normalized.length < 10
      ? `PAN must be 10 characters (${normalized.length} entered so far)`
      : `PAN must be exactly 10 characters (${normalized.length} entered)`;
  }

  if (!/^[A-Z]{5}/.test(normalized)) {
    return 'First 5 characters of PAN must be letters (A–Z), e.g. ABCDE in ABCDE1234F';
  }

  if (!/^[A-Z]{5}[0-9]{4}/.test(normalized)) {
    return 'Characters 6–9 of PAN must be digits (0–9), e.g. 1234 in ABCDE1234F';
  }

  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(normalized)) {
    return 'Last character of PAN must be a letter (A–Z), e.g. F in ABCDE1234F';
  }

  return null;
}

export function aadhaarValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = control.value;
    if (raw == null || String(raw).trim() === '') {
      return null;
    }
    const message = describeAadhaarError(raw);
    return message ? { aadhaar: { message } satisfies ValidationErrorDetail } : null;
  };
}

export function panValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = control.value;
    if (raw == null || String(raw).trim() === '') {
      return null;
    }
    const normalized = String(raw).trim().toUpperCase();
    if (normalized !== String(raw)) {
      control.setValue(normalized, { emitEvent: false });
    }
    const message = describePanError(normalized);
    return message ? { pan: { message } satisfies ValidationErrorDetail } : null;
  };
}

/** Teacher experience: 0–99 years, max 2 digits. */
export const EXPERIENCE_MAX = 99;

export function sanitizeExperienceInput(value: string): number | null {
  const digits = value.replace(/\D/g, '').slice(0, 2);
  if (!digits) {
    return null;
  }
  return Math.min(EXPERIENCE_MAX, parseInt(digits, 10));
}

export function clampExperienceValue(raw: unknown): number {
  if (raw == null || raw === '') {
    return 0;
  }
  const num = Number(raw);
  if (Number.isNaN(num) || num < 0) {
    return 0;
  }
  return Math.min(EXPERIENCE_MAX, Math.floor(num));
}

export function describeExperienceError(raw: unknown): string | null {
  if (raw == null || raw === '') {
    return null;
  }
  const num = Number(raw);
  if (Number.isNaN(num)) {
    return 'Experience must be a number';
  }
  if (!Number.isInteger(num)) {
    return 'Experience must be a whole number (0–99)';
  }
  if (num < 0) {
    return 'Experience cannot be negative';
  }
  if (num > EXPERIENCE_MAX) {
    return `Experience cannot exceed ${EXPERIENCE_MAX} years`;
  }
  return null;
}

export function experienceValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const message = describeExperienceError(control.value);
    return message ? { experience: { message } satisfies ValidationErrorDetail } : null;
  };
}

export function experienceValidationConfig(): {
  validations: { name: string; validator: ValidatorFn; message: string }[];
} {
  return {
    validations: [
      {
        name: 'experience',
        validator: experienceValidator(),
        message: `Experience must be between 0 and ${EXPERIENCE_MAX} years`,
      },
    ],
  };
}

/** Indian bank account: 9–18 digits, numeric only, no spaces/symbols. */
export const BANK_ACCOUNT_MIN_LENGTH = 9;
export const BANK_ACCOUNT_MAX_LENGTH = 18;

export const IFSC_LENGTH = 11;
export const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export function stripBankAccountDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, BANK_ACCOUNT_MAX_LENGTH);
}

export function sanitizeBankAccountInput(value: string): string {
  return stripBankAccountDigits(value);
}

export function describeBankAccountError(raw: unknown): string | null {
  const rawStr = String(raw ?? '');
  if (!rawStr.trim()) {
    return null;
  }

  if (/\s/.test(rawStr)) {
    return 'Bank account number cannot contain spaces';
  }

  if (/[^0-9]/.test(rawStr)) {
    return 'Bank account number must contain only digits (0–9) — no letters or special characters';
  }

  const digits = stripBankAccountDigits(rawStr);
  if (digits.length < BANK_ACCOUNT_MIN_LENGTH) {
    return `Bank account number must be ${BANK_ACCOUNT_MIN_LENGTH}–${BANK_ACCOUNT_MAX_LENGTH} digits (${digits.length} entered so far)`;
  }

  if (digits.length > BANK_ACCOUNT_MAX_LENGTH) {
    return `Bank account number cannot exceed ${BANK_ACCOUNT_MAX_LENGTH} digits`;
  }

  return null;
}

export function bankAccountValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = control.value;
    if (raw == null || String(raw).trim() === '') {
      return null;
    }

    const digits = sanitizeBankAccountInput(String(raw));
    if (digits !== String(raw)) {
      control.setValue(digits, { emitEvent: false });
    }

    const message = describeBankAccountError(digits);
    return message ? { bankAccount: { message } satisfies ValidationErrorDetail } : null;
  };
}

export function sanitizeIfscInput(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, IFSC_LENGTH);
}

export function describeIfscError(raw: unknown): string | null {
  const normalized = sanitizeIfscInput(String(raw ?? ''));
  if (!normalized) {
    return null;
  }

  if (normalized.length !== IFSC_LENGTH) {
    return normalized.length < IFSC_LENGTH
      ? `IFSC code must be 11 characters (${normalized.length} entered so far)`
      : `IFSC code must be exactly 11 characters (${normalized.length} entered)`;
  }

  if (!/^[A-Z]{4}/.test(normalized)) {
    return 'First 4 characters of IFSC must be uppercase letters (A–Z) for the bank code, e.g. SBIN';
  }

  if (normalized[4] !== '0') {
    return '5th character of IFSC must be 0 (reserved), e.g. SBIN0XXXXXX';
  }

  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(normalized)) {
    return 'Last 6 characters of IFSC must be letters or digits (A–Z, 0–9), e.g. 001234 in SBIN0001234';
  }

  return null;
}

export function ifscValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = control.value;
    if (raw == null || String(raw).trim() === '') {
      return null;
    }

    const normalized = sanitizeIfscInput(String(raw));
    if (normalized !== String(raw)) {
      control.setValue(normalized, { emitEvent: false });
    }

    const message = describeIfscError(normalized);
    return message ? { ifsc: { message } satisfies ValidationErrorDetail } : null;
  };
}

export function bankAccountValidationConfig(required = false): {
  validations: { name: string; validator: ValidatorFn; message: string }[];
} {
  const validations = [
    {
      name: 'bankAccount',
      validator: bankAccountValidator(),
      message: `Bank account number must be ${BANK_ACCOUNT_MIN_LENGTH}–${BANK_ACCOUNT_MAX_LENGTH} digits`,
    },
  ];
  if (required) {
    validations.unshift({
      name: 'required',
      validator: Validators.required,
      message: 'Bank account number is required',
    });
  }
  return { validations };
}

export function ifscValidationConfig(required = false): {
  validations: { name: string; validator: ValidatorFn; message: string }[];
} {
  const validations = [
    {
      name: 'ifsc',
      validator: ifscValidator(),
      message: 'Enter a valid 11-character IFSC (e.g. SBIN0001234)',
    },
  ];
  if (required) {
    validations.unshift({
      name: 'required',
      validator: Validators.required,
      message: 'IFSC code is required',
    });
  }
  return { validations };
}

/** Optional weekly periods / max periods per day (positive integers). */
export function optionalPositiveIntValidator(max: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = control.value;
    if (raw == null || raw === '') {
      return null;
    }
    const num = Number(raw);
    if (!Number.isInteger(num) || num < 1) {
      return { positiveInt: { message: 'Enter a whole number of at least 1' } satisfies ValidationErrorDetail };
    }
    if (num > max) {
      return {
        positiveInt: { message: `Value cannot exceed ${max}` } satisfies ValidationErrorDetail,
      };
    }
    return null;
  };
}

export function describeShiftTimeError(start: unknown, end: unknown): string | null {
  const startStr = normalizeTimeValue(start);
  const endStr = normalizeTimeValue(end);

  if (!startStr && !endStr) {
    return null;
  }
  if (startStr && !endStr) {
    return 'Select shift end time';
  }
  if (!startStr && endStr) {
    return 'Select shift start time';
  }
  if (startStr && endStr && timeToMinutes(startStr) >= timeToMinutes(endStr)) {
    return 'Shift end time must be after start time';
  }
  return null;
}

/** Shift start: only errors that belong on the start field (missing start, invalid range). */
export function shiftStartTimeValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const group = control.parent;
    if (!group) {
      return null;
    }
    const message = describeShiftTimeError(control.value, group.get('shiftEndTime')?.value);
    if (!message || message === 'Select shift end time') {
      return null;
    }
    return { shiftTime: { message } satisfies ValidationErrorDetail };
  };
}

/** Shift end: missing end and “end after start” errors show on the end field only. */
export function shiftEndTimeValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const group = control.parent;
    if (!group) {
      return null;
    }
    const message = describeShiftTimeError(group.get('shiftStartTime')?.value, control.value);
    if (!message || message === 'Select shift start time') {
      return null;
    }
    return { shiftTime: { message } satisfies ValidationErrorDetail };
  };
}

/** Re-validate both shift controls when either value changes. */
export function syncShiftTimeValidity(scheduleGroup: {
  get(name: string): AbstractControl | null;
}): void {
  scheduleGroup.get('shiftStartTime')?.updateValueAndValidity({ emitEvent: false });
  scheduleGroup.get('shiftEndTime')?.updateValueAndValidity({ emitEvent: false });
}

/** Normalize HTML time input / API value to HH:mm. */
export function normalizeTimeValue(raw: unknown): string | null {
  if (raw == null || String(raw).trim() === '') {
    return null;
  }
  const text = String(raw).trim();
  const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return null;
  }
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function timeToMinutes(value: string): number {
  const normalized = normalizeTimeValue(value);
  if (!normalized) {
    return 0;
  }
  const [h, m] = normalized.split(':').map(Number);
  return h * 60 + m;
}

export function formatTimeDisplay(raw: unknown): string {
  const normalized = normalizeTimeValue(raw);
  if (!normalized) {
    return '—';
  }
  const [h, m] = normalized.split(':').map(Number);
  const date = new Date();
  date.setHours(h, m, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatShiftRangeDisplay(start: unknown, end: unknown): string {
  const startNorm = normalizeTimeValue(start);
  const endNorm = normalizeTimeValue(end);
  if (!startNorm && !endNorm) {
    return '—';
  }
  if (startNorm && endNorm) {
    return `${formatTimeDisplay(startNorm)} – ${formatTimeDisplay(endNorm)}`;
  }
  return formatTimeDisplay(startNorm ?? endNorm);
}

/** Rejects calendar dates after today (for date of birth, etc.). */
export function noFutureDateValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = control.value;
    if (raw == null || raw === '') {
      return null;
    }

    const date = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    const valueDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const today = new Date();
    const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    if (valueDay.getTime() > todayDay.getTime()) {
      return {
        noFutureDate: {
          message: 'Date cannot be in the future',
        },
      };
    }

    return null;
  };
}

export function dateOfBirthValidationConfig(required = true): {
  validations: { name: string; validator: ValidatorFn; message: string }[];
} {
  const validations = [
    {
      name: 'noFutureDate',
      validator: noFutureDateValidator(),
      message: 'Date of birth cannot be in the future',
    },
  ];
  if (required) {
    validations.unshift({
      name: 'required',
      validator: Validators.required,
      message: 'DOB is required',
    });
  }
  return { validations };
}

/** Discount and similar numeric fields: minimum 0, no negatives. */
export function minZeroValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = control.value;
    if (raw == null || raw === '') {
      return null;
    }
    const num = Number(raw);
    if (Number.isNaN(num) || num < 0) {
      return { minZero: true };
    }
    return null;
  };
}

export function stripAadhaarDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 12);
}

export function formatAadhaarDisplay(digits: string): string {
  const d = stripAadhaarDigits(digits);
  return d.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

export function nameValidationConfig(
  required = false,
  maxLength = PERSON_NAME_MAX_LENGTH,
): {
  validations: { name: string; validator: ValidatorFn; message: string }[];
} {
  const validations = [
    {
      name: 'namePattern',
      validator: nameValidator(maxLength),
      message: `Only letters (A–Z) and spaces are allowed (max ${maxLength} characters)`,
    },
  ];
  if (required) {
    validations.unshift({
      name: 'required',
      validator: Validators.required,
      message: 'This field is required',
    });
  }
  return { validations };
}

export function aadhaarValidationConfig(required = false): {
  validations: { name: string; validator: ValidatorFn; message: string }[];
} {
  const validations = [
    {
      name: 'aadhaar',
      validator: aadhaarValidator(),
      message: 'Enter a valid 12-digit Aadhaar (first digit 2–9, e.g. 2345 6789 0123)',
    },
  ];
  if (required) {
    validations.unshift({
      name: 'required',
      validator: Validators.required,
      message: 'Aadhaar number is required',
    });
  }
  return { validations };
}

export function panValidationConfig(required = false): {
  validations: { name: string; validator: ValidatorFn; message: string }[];
} {
  const validations = [
    {
      name: 'pan',
      validator: panValidator(),
      message: 'Enter a valid PAN: 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F)',
    },
  ];
  if (required) {
    validations.unshift({
      name: 'required',
      validator: Validators.required,
      message: 'PAN is required',
    });
  }
  return { validations };
}

