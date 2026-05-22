import { FormGroup } from '@angular/forms';

/**
 * Mark and validate only the listed controls on a form (or nested group).
 * Returns true when every listed control is valid.
 */
export function validateFormControls(
  form: FormGroup,
  controlNames: string[],
  markTouched = true
): boolean {
  let valid = true;

  for (const path of controlNames) {
    const control = form.get(path);
    if (!control) {
      continue;
    }
    if (markTouched) {
      control.markAsTouched();
    }
    if (control.invalid) {
      valid = false;
    }
  }

  return valid;
}

/** Collect control names from wizard card field keys and configs. */
export function controlNamesFromFieldKeys(
  keys: string[],
  configs: Record<string, { controlName: string }>
): string[] {
  return keys
    .map((key) => configs[key]?.controlName)
    .filter((name): name is string => !!name);
}
