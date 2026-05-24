import { HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { IDashboardLayout, IDashboardQuery, IDashboardResponse } from '../models/dashboard.model';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly api = inject(ApiService);

  getLayout(): Observable<IDashboardLayout> {
    return this.api.get<IDashboardLayout>('dashboard/layout');
  }

  getDashboard(query?: IDashboardQuery): Observable<IDashboardResponse> {
    let params = new HttpParams();
    if (query?.attendancePreset) {
      params = params.set('attendancePreset', query.attendancePreset);
    }
    if (query?.attendanceFrom) {
      params = params.set('attendanceFrom', query.attendanceFrom);
    }
    if (query?.attendanceTo) {
      params = params.set('attendanceTo', query.attendanceTo);
    }
    return this.api.get<IDashboardResponse>('dashboard', params);
  }
}
