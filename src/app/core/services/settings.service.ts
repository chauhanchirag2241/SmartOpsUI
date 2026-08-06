import { HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';
import { ApiService } from './api.service';

export interface SchoolSettingDto {
  key: string;
  value: string;
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly api = inject(ApiService);

  getLeaveSettings(schoolId: string): Observable<SchoolSettingDto[]> {
    return this.getSettingsByPrefix(schoolId, 'leave.');
  }

  getAttendanceSettings(schoolId: string): Observable<SchoolSettingDto[]> {
    return this.getSettingsByPrefix(schoolId, 'attendance.');
  }

  /** Leave + attendance settings for the school settings page. */
  getPortalSettings(schoolId: string): Observable<SchoolSettingDto[]> {
    return forkJoin([
      this.getLeaveSettings(schoolId),
      this.getAttendanceSettings(schoolId),
    ]).pipe(map(([leave, attendance]) => [...leave, ...attendance]));
  }

  saveLeaveSettings(schoolId: string, settings: SchoolSettingDto[]): Observable<void> {
    return this.api.put<void>(`schools/${schoolId}/settings`, { settings });
  }

  private getSettingsByPrefix(schoolId: string, prefix: string): Observable<SchoolSettingDto[]> {
    const params = new HttpParams().set('prefix', prefix);
    return this.api.get<SchoolSettingDto[]>(`schools/${schoolId}/settings`, params);
  }
}
