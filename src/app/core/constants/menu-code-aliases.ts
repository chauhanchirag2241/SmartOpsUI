/** Legacy menu codes that map to their canonical replacement. */
export const LEGACY_MENU_CODE_ALIASES: Record<string, string> = {
  TEACHERS: 'EMPLOYEES',
};

export function canonicalMenuCode(code: string | null | undefined): string {
  const key = code?.trim().toUpperCase() ?? '';
  if (!key) {
    return key;
  }
  return LEGACY_MENU_CODE_ALIASES[key] ?? key;
}
