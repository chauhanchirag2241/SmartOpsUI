import { HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class FeeStructureService {
  private readonly api = inject(ApiService);

  getVersions(status?: string): Observable<any[]> {
    let params = new HttpParams();
    if (status && status !== 'all') params = params.set('status', status);
    return this.api.get<any[]>('fees/structure/versions', params);
  }

  getVersionDetail(versionId: string): Observable<any> {
    return this.api.get<any>(`fees/structure/versions/${versionId}`);
  }

  createVersion(body: unknown): Observable<any> {
    return this.api.post<any>('fees/structure/versions', body);
  }

  publishVersion(versionId: string): Observable<any> {
    return this.api.post<any>(`fees/structure/versions/${versionId}/publish`, {});
  }

  activateVersion(versionId: string): Observable<any> {
    return this.api.post<any>(`fees/structure/versions/${versionId}/activate`, {});
  }

  createNewVersionFrom(sourceVersionId: string): Observable<any> {
    return this.api.post<any>(`fees/structure/versions/${sourceVersionId}/new-version`, {});
  }

  deleteVersion(versionId: string): Observable<void> {
    return this.api.delete<void>(`fees/structure/versions/${versionId}`);
  }

  createFeeHead(versionId: string, body: unknown): Observable<any> {
    return this.api.post<any>(`fees/structure/versions/${versionId}/heads`, body);
  }

  updateFeeHead(typeId: string, body: unknown): Observable<any> {
    return this.api.put<any>(`fees/structure/heads/${typeId}`, body);
  }

  deleteFeeHead(typeId: string): Observable<void> {
    return this.api.delete<void>(`fees/structure/heads/${typeId}`);
  }
}
