import { HttpErrorResponse } from '@angular/common/http';

const TECHNICAL_MESSAGE =
  /json value|byteposition|linenumber|system\.|path:\s*\$|could not be converted|unexpected token/i;

/** User-safe API error text; hides serializer/stack details. */
export function getUserFacingApiError(
  err: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  const status = resolveHttpStatus(err);
  if (status >= 500) {
    return 'Internal Server Error';
  }

  const messages = collectErrorMessages(err).filter((m) => m.trim());
  const friendly = messages.find((m) => !isTechnicalMessage(m));
  if (friendly) {
    return friendly;
  }

  if (messages.some(isTechnicalMessage)) {
    return status >= 400 ? 'Internal Server Error' : fallback;
  }

  return fallback;
}

function resolveHttpStatus(err: unknown): number {
  if (err instanceof HttpErrorResponse) {
    return err.status;
  }
  if (err && typeof err === 'object' && 'status' in err) {
    const status = Number((err as { status?: number }).status);
    return Number.isFinite(status) ? status : 0;
  }
  return 0;
}

function collectErrorMessages(err: unknown): string[] {
  const out: string[] = [];
  const body =
    err instanceof HttpErrorResponse
      ? err.error
      : err && typeof err === 'object' && 'error' in err
        ? (err as { error?: unknown }).error
        : undefined;

  if (typeof body === 'string' && body.trim()) {
    out.push(body.trim());
    return out;
  }

  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    const errors = record['errors'];
    if (errors && typeof errors === 'object') {
      for (const value of Object.values(errors as Record<string, unknown>)) {
        if (Array.isArray(value)) {
          out.push(...value.map((v) => String(v)));
        } else if (value != null) {
          out.push(String(value));
        }
      }
    }
    const message = record['message'] ?? record['title'] ?? record['error'];
    if (typeof message === 'string' && message.trim()) {
      out.push(message.trim());
    }
  }

  return out;
}

function isTechnicalMessage(message: string): boolean {
  return TECHNICAL_MESSAGE.test(message) || message.includes('$.');
}
