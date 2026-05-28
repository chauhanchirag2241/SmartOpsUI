const NATURAL_TEXT_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

/**
 * Natural, case-insensitive text compare.
 * Example: 1-A, 1-B, 2-A, ... 10-A.
 */
export function naturalTextCompare(a: unknown, b: unknown): number {
  return NATURAL_TEXT_COLLATOR.compare(String(a ?? ''), String(b ?? ''));
}

