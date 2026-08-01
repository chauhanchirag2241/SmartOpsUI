/**
 * Calendar (date-only) helpers — never use Date#toISOString() for YYYY-MM-DD.
 * UTC conversion shifts the calendar day behind local midnight (e.g. IST → previous day).
 */

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})/;

/** Parse API / form date-only value into a local calendar Date (no UTC shift). */
export function parseDateOnly(value: unknown): Date | null {
  if (value == null || value === '') return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const raw = String(value).trim();
  const iso = ISO_DAY.exec(raw);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    const date = new Date(y, m - 1, d);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // DD-MM-YYYY or DD/MM/YYYY
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(raw);
  if (dmy) {
    const d = Number(dmy[1]);
    const m = Number(dmy[2]);
    const y = Number(dmy[3]);
    const date = new Date(y, m - 1, d);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const fallback = new Date(raw);
  if (Number.isNaN(fallback.getTime())) return null;
  return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
}

/** Format a Date / string as YYYY-MM-DD using local calendar parts (API-safe). */
export function toDateOnlyString(value: unknown): string | null {
  if (value == null || value === '') return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (ISO_DAY.test(trimmed)) return trimmed.slice(0, 10);
  }

  const date = parseDateOnly(value);
  if (!date) return null;

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Display as DD-MM-YYYY. */
export function formatDateOnlyDisplay(value: unknown, empty = '—'): string {
  const date = parseDateOnly(value);
  if (!date) {
    if (value == null || value === '') return empty;
    return String(value);
  }
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}-${m}-${y}`;
}

/** Today's local calendar date as YYYY-MM-DD. */
export function todayDateOnlyString(): string {
  return toDateOnlyString(new Date())!;
}
