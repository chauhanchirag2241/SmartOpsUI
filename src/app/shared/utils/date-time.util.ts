/**
 * Date/time display helpers — portal always shows school-local (IST) wall-clock in 24-hour format.
 * Stored values are IST; treat naive ISO strings as local, not UTC.
 */

const ISO_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Parse API datetime; if no timezone marker, treat as IST/local wall-clock. */
export function parseDateTime(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const raw = String(value).trim();
  const m = ISO_DATE_TIME.exec(raw);
  if (m && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const h = Number(m[4]);
    const mi = Number(m[5]);
    const s = Number(m[6] ?? 0);
    const date = new Date(y, mo - 1, d, h, mi, s);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

/** Display as `dd MMM yyyy, HH:mm` (24-hour). */
export function formatDateTime24(value: unknown, empty = '—'): string {
  const date = parseDateTime(value);
  if (!date) {
    if (value == null || value === '') return empty;
    return String(value);
  }

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
}

/** Display time only as `HH:mm` (24-hour). */
export function formatClockTime24(value: unknown, empty = '—'): string {
  const date = parseDateTime(value);
  if (!date) {
    if (value == null || value === '') return empty;
    return String(value);
  }

  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
}

/**
 * Serialize browser-local wall-clock for API storage (IST on school machines).
 * Do not use Date#toISOString() — that converts to UTC.
 */
export function toLocalDateTimeString(value: unknown): string | null {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : parseDateTime(value);
  if (!date || Number.isNaN(date.getTime())) return null;
  return (
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}` +
    `T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
  );
}
