import { ChangeDetectorRef } from '@angular/core';

/** Zoneless / async callbacks: refresh template after mutating component state. */
export function refreshUi(cdr: ChangeDetectorRef): void {
  cdr.detectChanges();
}
