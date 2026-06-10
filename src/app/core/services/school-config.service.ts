import { HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { SKIP_GLOBAL_LOADER } from '../http/loader-http.context';
import { ApiService } from './api.service';
import { SchoolBootstrap } from '../models/school-bootstrap.model';
import { TenantService } from './tenant.service';

@Injectable({ providedIn: 'root' })
export class SchoolConfigService {
  private readonly api = inject(ApiService);
  private readonly tenant = inject(TenantService);
  private inflightLoad: Promise<void> | null = null;

  async loadForCurrentHost(): Promise<void> {
    if (this.tenant.isReady) {
      return;
    }

    if (this.inflightLoad) {
      return this.inflightLoad;
    }

    this.inflightLoad = this.loadInternal().finally(() => {
      this.inflightLoad = null;
    });

    return this.inflightLoad;
  }

  private async loadInternal(): Promise<void> {
    const subdomain = this.tenant.resolveSubdomainFromHost();
    this.tenant.setSubdomain(subdomain);

    if (!subdomain) {
      this.tenant.setLoadError(
        'Invalid school URL. Open your school portal link (e.g. dps-ahmedabad.smartops.com).',
      );
      return;
    }

    const bootstrapContext = new HttpContext().set(SKIP_GLOBAL_LOADER, true);

    try {
      const school = await firstValueFrom(
        this.api
          .get<SchoolBootstrap>(
            `schools/by-subdomain/${encodeURIComponent(subdomain)}`,
            undefined,
            bootstrapContext,
          )
          .pipe(timeout(15_000)),
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
