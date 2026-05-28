import { StreamGroup } from '../enums/field-options.enum';

/** Frontend stream label → API enum int (SmartOps.Domain.Modules.Class.StreamGroup). */
const STREAM_GROUP_TO_INT: Record<string, number> = {
  [StreamGroup.Primary]: 6,
  [StreamGroup.Science]: 2,
  [StreamGroup.Commerce]: 3,
  [StreamGroup.Arts]: 4,
  [StreamGroup.Regional]: 5,
};

const STREAM_GROUP_FROM_API: Record<string, string | null> = {
  None: null,
  Science: StreamGroup.Science,
  Commerce: StreamGroup.Commerce,
  Arts: StreamGroup.Arts,
  Regional: StreamGroup.Regional,
  Primary: StreamGroup.Primary,
};

const STREAM_GROUP_FROM_INT: Record<number, string | null> = {
  1: null,
  2: StreamGroup.Science,
  3: StreamGroup.Commerce,
  4: StreamGroup.Arts,
  5: StreamGroup.Regional,
  6: StreamGroup.Primary,
};

/** API int (get-by-id) → dropdown value. */
export function streamGroupFromApiInt(intValue: number | null | undefined): string | null {
  if (intValue == null || intValue <= 0) {
    return null;
  }
  return STREAM_GROUP_FROM_INT[intValue] ?? null;
}

/** List API string label → dropdown value (null = not selected). */
export function streamGroupFromApi(value: unknown): string | null {
  if (value == null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  if (!text || text === '-' || text.toLowerCase() === 'none') {
    return null;
  }

  if (text in STREAM_GROUP_FROM_API) {
    return STREAM_GROUP_FROM_API[text];
  }

  const known = Object.values(StreamGroup) as string[];
  return known.includes(text) ? text : null;
}

/** Dropdown value → API int for save (null when not selected). */
export function streamGroupToApiInt(value: unknown): number | null {
  const label = streamGroupFromApi(value);
  if (!label) {
    return null;
  }
  return STREAM_GROUP_TO_INT[label] ?? null;
}

/** Table display: only explicit stream names; unset shows dash. */
export function formatStreamGroupDisplay(value: unknown): string {
  const label = streamGroupFromApi(value);
  return label ?? '—';
}

/** Duplicate check key: empty vs primary vs other streams. */
export function streamGroupDuplicateKey(value: unknown): string {
  const label = streamGroupFromApi(value);
  return label ? label.toLowerCase() : '';
}
