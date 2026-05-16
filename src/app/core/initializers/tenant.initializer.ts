import { inject } from '@angular/core';
import { SchoolConfigService } from '../services/school-config.service';

export function tenantInitializer(): () => Promise<void> {
  const schoolConfig = inject(SchoolConfigService);
  return () => schoolConfig.loadForCurrentHost();
}
