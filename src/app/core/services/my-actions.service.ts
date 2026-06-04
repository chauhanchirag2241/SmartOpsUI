import { HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export enum WorkflowItemType {
  LeaveApproval = 1,
  NoticeResponse = 2,
  FormFill = 3,
}

export interface CompleteMyActionRequest {
  actionCode: string;
  comment?: string | null;
  payload?: string | null;
}

@Injectable({ providedIn: 'root' })
export class MyActionsService {
  private readonly api = inject(ApiService);

  getList(itemType?: number, search?: string): Observable<unknown[]> {
    let params = new HttpParams();
    if (itemType != null) params = params.set('itemType', String(itemType));
    if (search) params = params.set('search', search);
    return this.api.get('my-actions', params);
  }

  getStats(): Observable<unknown> {
    return this.api.get('my-actions/stats');
  }

  getById(id: string): Observable<unknown> {
    return this.api.get(`my-actions/${id}`);
  }

  complete(id: string, body: CompleteMyActionRequest): Observable<unknown> {
    return this.api.post(`my-actions/${id}/complete`, body);
  }
}
