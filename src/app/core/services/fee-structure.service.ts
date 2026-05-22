import { HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class FeeStructureService {
  private readonly api = inject(ApiService);

  getFeeTypes(): Observable<any[]> {
    return this.api.get<any[]>('fees/structure/types');
  }

  getStats(): Observable<any> {
    return this.api.get<any>('fees/structure/stats');
  }

  getSettings(): Observable<any> {
    return this.api.get<any>('fees/structure/settings');
  }

  upsertSettings(body: unknown): Observable<any> {
    return this.api.put<any>('fees/structure/settings', body);
  }

  createFeeType(body: unknown): Observable<any> {
    return this.api.post<any>('fees/structure/types', body);
  }

  updateFeeType(id: string, body: unknown): Observable<any> {
    return this.api.put<any>(`fees/structure/types/${id}`, body);
  }

  deleteFeeType(id: string): Observable<void> {
    return this.api.delete<void>(`fees/structure/types/${id}`);
  }

  setActive(id: string, isActive: boolean): Observable<any> {
    return this.api.patch<any>(`fees/structure/types/${id}/active`, { isActive });
  }
}
