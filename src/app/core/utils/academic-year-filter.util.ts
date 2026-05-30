import { AcademicYearDropdownItem } from '../services/academic-year.service';

function normalizeStartDate(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 10) : null;
}

function resolveCurrentStartDate(
  items: AcademicYearDropdownItem[],
  currentStartDate: string | null | undefined,
): string | null {
  return normalizeStartDate(currentStartDate) ?? normalizeStartDate(items.find((y) => y.isCurrent)?.startDate);
}

/** Current + future years only; excludes archived (past) years. Dedupes by id. */
export function filterCurrentAndFutureAcademicYears(
  items: AcademicYearDropdownItem[],
  currentStartDate: string | null | undefined,
): AcademicYearDropdownItem[] {
  const currentStart = resolveCurrentStartDate(items, currentStartDate);
  const filtered = items.filter((y) => {
    if (y.isCurrent) {
      return true;
    }
    const start = normalizeStartDate(y.startDate);
    if (!currentStart) {
      return false;
    }
    if (!start) {
      return true;
    }
    return start >= currentStart;
  });

  const seen = new Set<string>();
  return filtered.filter((y) => {
    if (seen.has(y.id)) {
      return false;
    }
    seen.add(y.id);
    return true;
  });
}

export function normalizeAcademicYearDropdownItem(raw: Record<string, unknown>): AcademicYearDropdownItem {
  return {
    id: String(raw['id'] ?? raw['Id'] ?? ''),
    name: String(raw['name'] ?? raw['Name'] ?? ''),
    isCurrent: !!(raw['isCurrent'] ?? raw['IsCurrent']),
    startDate: String(raw['startDate'] ?? raw['StartDate'] ?? ''),
  };
}
