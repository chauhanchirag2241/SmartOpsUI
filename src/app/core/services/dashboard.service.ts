import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { IDashboardLayout, IDashboardResponse } from '../models/dashboard.model';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly api = inject(ApiService);

  getLayout(): Observable<IDashboardLayout> {
    return this.api.get<IDashboardLayout>('dashboard/layout');
  }

  getDashboard(): Observable<IDashboardResponse> {
    return this.api.get<IDashboardResponse>('dashboard');
  }
}
