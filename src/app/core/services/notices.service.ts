import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export enum NoticeTargetType {
  AllStaff = 1,
  ClassParents = 2,
  SingleUser = 3,
}

export interface CreateNoticeRequest {
  title: string;
  body: string;
  requiresResponse: boolean;
  responseDeadline?: string | null;
  targetType: NoticeTargetType;
  targetRefId?: string | null;
}

@Injectable({ providedIn: 'root' })
export class NoticesService {
  private readonly api = inject(ApiService);

  getList(): Observable<unknown[]> {
    return this.api.get('notices');
  }

  getById(id: string): Observable<unknown> {
    return this.api.get(`notices/${id}`);
  }

  create(body: CreateNoticeRequest): Observable<unknown> {
    return this.api.post('notices', body);
  }

  update(id: string, body: CreateNoticeRequest): Observable<unknown> {
    return this.api.put(`notices/${id}`, body);
  }

  publish(id: string): Observable<unknown> {
    return this.api.post(`notices/${id}/publish`, {});
  }

  getResponses(id: string): Observable<unknown[]> {
    return this.api.get(`notices/${id}/responses`);
  }

  respond(id: string, responseBody: string): Observable<unknown> {
    return this.api.post(`notices/${id}/respond`, { responseBody });
  }
}
