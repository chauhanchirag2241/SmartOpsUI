import { AuditHistoryEntityType } from '../../core/services/audit.service';
import {
  BloodGroup,
  Gender,
  Medium,
  SubjectCategory,
  SubjectType,
} from '../enums/field-options.enum';
import { formatStreamGroupDisplay, streamGroupFromApiInt } from './stream-group.util';
import {
  callTypeLabel,
  complaintStatusLabel,
  inquiryStatusLabel,
} from './front-office-enum.util';

const GUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Maps stored audit values (often 1-based ints or GUIDs) to UI labels. */
export function formatAuditFieldValue(
  entityType: AuditHistoryEntityType,
  field: string,
  value: string | null | undefined,
  lookupLabels: Record<string, string> = {},
): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  const normalizedField = field.replace(/\s/g, '').toLowerCase();
  const trimmedValue = value.trim();

  // Resolve any GUID via shared id→name lookup (branch, class group, shift, subject, …)
  if (GUID_RE.test(trimmedValue)) {
    const lookupValue = lookupLabels[trimmedValue.toLowerCase()];
    if (lookupValue) {
      return lookupValue;
    }
  } else {
    const lookupValue = lookupLabels[trimmedValue.toLowerCase()];
    if (lookupValue) {
      return lookupValue;
    }
  }

  const mapped = mapFieldValue(entityType, normalizedField, trimmedValue);
  return mapped ?? value;
}

function mapFieldValue(
  entityType: AuditHistoryEntityType,
  field: string,
  value: string,
): string | null {
  // Shared boolean / active flags on any entity
  if (
    field === 'isactive' ||
    field === 'iscurrent' ||
    field === 'isanonymous' ||
    field === 'autofollowup'
  ) {
    return mapBooleanLabel(value);
  }

  switch (entityType) {
    case 'class':
      return mapClassField(field, value);
    case 'subject':
      return mapSubjectField(field, value);
    case 'academic-year':
      return mapAcademicYearField(field, value);
    case 'academic-period':
      return null;
    case 'student':
    case 'employee':
      return mapPersonField(field, value);
    case 'phone-log':
      return mapPhoneLogField(field, value);
    case 'complaint':
      return mapComplaintField(field, value);
    case 'admission-inquiry':
      return mapAdmissionInquiryField(field, value);
    default:
      return null;
  }
}

function mapPhoneLogField(field: string, value: string): string | null {
  switch (field) {
    case 'calltype':
      return callTypeLabel(value);
    default:
      return null;
  }
}

function mapComplaintField(field: string, value: string): string | null {
  switch (field) {
    case 'status':
      return complaintStatusLabel(value);
    default:
      return null;
  }
}

function mapAdmissionInquiryField(field: string, value: string): string | null {
  switch (field) {
    case 'status':
      return inquiryStatusLabel(value);
    case 'streamgroup':
      return mapStreamGroup(value);
    default:
      return null;
  }
}

function mapAcademicYearField(_field: string, _value: string): string | null {
  return null;
}

function mapBooleanLabel(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return 'Yes';
  if (normalized === 'false' || normalized === '0') return 'No';
  return null;
}

function mapClassField(field: string, value: string): string | null {
  switch (field) {
    case 'medium':
      return intToEnumLabel(Medium, value);
    case 'streamgroup':
      return mapStreamGroup(value);
    // Section is free text now — do not map via A/B/C enum indexes
    case 'section':
      return value || null;
    default:
      return null;
  }
}

function mapSubjectField(field: string, value: string): string | null {
  switch (field) {
    case 'subjecttype':
      return intToEnumLabel(SubjectType, value) ?? enumNameLabel(value, SubjectType);
    case 'subjectcategory':
      return intToEnumLabel(SubjectCategory, value) ?? enumNameLabel(value, SubjectCategory);
    case 'medium':
      return intToEnumLabel(Medium, value);
    default:
      return null;
  }
}

function mapPersonField(field: string, value: string): string | null {
  switch (field) {
    case 'gender':
      return intToEnumLabel(Gender, value) ?? enumNameLabel(value, Gender);
    case 'bloodgroup':
      return intToEnumLabel(BloodGroup, value) ?? enumNameLabel(value, BloodGroup);
    default:
      return null;
  }
}

function intToEnumLabel<T extends Record<string, string>>(
  enumObj: T,
  raw: string,
): string | null {
  const values = Object.values(enumObj);
  if (values.includes(raw)) {
    return raw;
  }

  const index = Number(raw);
  if (!Number.isFinite(index) || index <= 0) {
    return null;
  }

  return values[index - 1] ?? null;
}

function enumNameLabel(value: string, enumObj: Record<string, string>): string | null {
  const key = value.replace(/\s/g, '');
  if (key in enumObj) {
    return enumObj[key as keyof typeof enumObj];
  }
  return null;
}

function mapStreamGroup(value: string): string | null {
  const asInt = Number(value);
  if (Number.isFinite(asInt) && asInt > 0) {
    return streamGroupFromApiInt(asInt) ?? formatStreamGroupDisplay(value);
  }
  return formatStreamGroupDisplay(value) === '—' ? null : formatStreamGroupDisplay(value);
}
