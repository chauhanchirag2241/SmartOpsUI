const CALL_TYPE: Record<string, number> = {
  Incoming: 0,
  Outgoing: 1,
};

const COMPLAINT_STATUS: Record<string, number> = {
  Pending: 0,
  InProgress: 1,
  Resolved: 2,
  Closed: 3,
};

const INQUIRY_STATUS: Record<string, number> = {
  New: 0,
  FollowUp: 1,
  VisitScheduled: 2,
  AdmissionForm: 3,
  Enrolled: 4,
  NotInterested: 5,
};

function parseEnumValue(
  map: Record<string, number>,
  value: unknown,
  fallback: number,
): number {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed in map) {
      return map[trimmed];
    }
    const num = Number(trimmed);
    if (!Number.isNaN(num)) {
      return num;
    }
  }
  return fallback;
}

export function parseCallType(value: unknown, fallback = 0): number {
  return parseEnumValue(CALL_TYPE, value, fallback);
}

export function parseComplaintStatus(value: unknown, fallback = 0): number {
  return parseEnumValue(COMPLAINT_STATUS, value, fallback);
}

export function parseInquiryStatus(value: unknown, fallback = 0): number {
  return parseEnumValue(INQUIRY_STATUS, value, fallback);
}

export function callTypeLabel(value: unknown): string {
  const n = parseCallType(value, -1);
  if (n === 0) return 'Incoming';
  if (n === 1) return 'Outgoing';
  return String(value ?? '—');
}

export function complaintStatusLabel(value: unknown): string {
  const labels = ['Pending', 'In Progress', 'Resolved', 'Closed'];
  const n = parseComplaintStatus(value, -1);
  return n >= 0 && n < labels.length ? labels[n] : String(value ?? '—');
}

export function inquiryStatusLabel(value: unknown): string {
  const labels = [
    'New',
    'Follow-up',
    'Visit Scheduled',
    'Admission Form',
    'Enrolled',
    'Not Interested',
  ];
  const n = parseInquiryStatus(value, -1);
  return n >= 0 && n < labels.length ? labels[n] : String(value ?? '—');
}
