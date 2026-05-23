import { HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class SalaryStructureService {
  private readonly api = inject(ApiService);

  getVersions(academicYearId?: string, status?: string): Observable<any[]> {
    let params = new HttpParams();
    if (academicYearId) params = params.set('academicYearId', academicYearId);
    if (status && status !== 'all') params = params.set('status', status);
    return this.api.get<any[]>('salary/structure/versions', params);
  }

  getVersionDetail(versionId: string): Observable<any> {
    return this.api.get<any>(`salary/structure/versions/${versionId}`);
  }

  createVersion(body: unknown): Observable<any> {
    return this.api.post<any>('salary/structure/versions', body);
  }

  publishVersion(versionId: string): Observable<any> {
    return this.api.post<any>(`salary/structure/versions/${versionId}/publish`, {});
  }

  activateVersion(versionId: string): Observable<any> {
    return this.api.post<any>(`salary/structure/versions/${versionId}/activate`, {});
  }

  createNewVersionFrom(sourceVersionId: string): Observable<any> {
    return this.api.post<any>(`salary/structure/versions/${sourceVersionId}/new-version`, {});
  }

  deleteVersion(versionId: string): Observable<void> {
    return this.api.delete<void>(`salary/structure/versions/${versionId}`);
  }

  createComponent(versionId: string, body: unknown): Observable<any> {
    return this.api.post<any>(`salary/structure/versions/${versionId}/components`, body);
  }

  updateComponent(componentId: string, body: unknown): Observable<any> {
    return this.api.put<any>(`salary/structure/components/${componentId}`, body);
  }

  deleteComponent(componentId: string): Observable<void> {
    return this.api.delete<void>(`salary/structure/components/${componentId}`);
  }
}
