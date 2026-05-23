/** Returns true when value looks like a usable bearer token. */
export function isUsableAccessToken(token: unknown): token is string {
  if (typeof token !== 'string') {
    return false;
  }
  const trimmed = token.trim();
  if (trimmed.length < 20) {
    return false;
  }
  if (trimmed === 'null' || trimmed === 'undefined') {
    return false;
  }
  return !isJwtExpired(trimmed);
}

function isJwtExpired(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64)) as { exp?: number };
    if (!payload.exp) {
      return false;
    }
    return Date.now() >= payload.exp * 1000;
  } catch {
    return false;
  }
}
