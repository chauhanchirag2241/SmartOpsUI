import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { SchoolBootstrap } from '../models/school-bootstrap.model';
import { TenantService } from './tenant.service';

@Injectable({ providedIn: 'root' })
export class SchoolConfigService {
  private readonly api = inject(ApiService);
  private readonly tenant = inject(TenantService);

  async loadForCurrentHost(): Promise<void> {
    const subdomain = this.tenant.resolveSubdomainFromHost();
    this.tenant.setSubdomain(subdomain);

    if (!subdomain) {
      this.tenant.setLoadError(
        'Invalid school URL. Open your school portal link (e.g. dps-ahmedabad.smartops.com).',
      );
      return;
    }

    try {
      const school = await firstValueFrom(
        this.api.get<SchoolBootstrap>(`schools/by-subdomain/${encodeURIComponent(subdomain)}`),
      );
      this.tenant.setSchool(school);
    } catch {
      const localHint =
        window.location.hostname === 'localhost'
          ? ` On localhost, set tenantSubdomain in environment.ts to match the school you created (currently looking for "${subdomain}").`
          : '';
      this.tenant.setLoadError(
        `School "${subdomain}" was not found. Check the subdomain in Config UI or contact your administrator.${localHint}`,
      );
    }
  }
}
