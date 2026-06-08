import { HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface SchoolSettingDto {
  key: string;
  value: string;
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly api = inject(ApiService);

  getLeaveSettings(schoolId: string): Observable<SchoolSettingDto[]> {
    const params = new HttpParams().set('prefix', 'leave.');
    return this.api.get<SchoolSettingDto[]>(`schools/${schoolId}/settings`, params);
  }

  saveLeaveSettings(schoolId: string, settings: SchoolSettingDto[]): Observable<void> {
    return this.api.put<void>(`schools/${schoolId}/settings`, { settings });
  }
}
