import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface CalendarEventTypeDto {
  id: string;
  name: string;
  code: string;
  color: string;
  isNonWorkingDefault: boolean;
  displayOrder: number;
  isActive: boolean;
}

export interface CreateCalendarEventTypeDto {
  name: string;
  code: string;
  color: string;
  isNonWorkingDefault: boolean;
  displayOrder: number;
}

export interface CalendarWeekendSettingDto {
  id: string;
  branchId: string;
  sundayOff: boolean;
  saturdayOff: boolean;
  mondayOff: boolean;
  tuesdayOff: boolean;
  wednesdayOff: boolean;
  thursdayOff: boolean;
  fridayOff: boolean;
}

export interface UpsertCalendarWeekendSettingDto {
  sundayOff: boolean;
  saturdayOff: boolean;
  mondayOff: boolean;
  tuesdayOff: boolean;
  wednesdayOff: boolean;
  thursdayOff: boolean;
  fridayOff: boolean;
}

export interface CalendarEventDto {
  id: string;
  branchId: string;
  academicYearId: string;
  eventTypeId: string;
  eventTypeName: string;
  eventTypeCode: string;
  title: string;
  description?: string | null;
  startDate: string;
  endDate: string;
  appliesToStudents: boolean;
  appliesToTeachers: boolean;
  appliesToStaff: boolean;
  isNonWorkingDay: boolean;
  color: string;
  classIds?: string[];
}

export interface CreateCalendarEventDto {
  academicYearId: string;
  eventTypeId: string;
  title: string;
  description?: string | null;
  startDate: string;
  endDate: string;
  appliesToStudents: boolean;
  appliesToTeachers: boolean;
  appliesToStaff: boolean;
  isNonWorkingDay: boolean;
  color?: string | null;
  classIds?: string[];
}

@Injectable({ providedIn: 'root' })
export class AcademicCalendarService {
  private readonly api = inject(ApiService);
  private readonly base = 'AcademicCalendar';

  getEventTypes(): Observable<CalendarEventTypeDto[]> {
    return this.api.get<CalendarEventTypeDto[]>(`${this.base}/event-types`);
  }

  createEventType(data: CreateCalendarEventTypeDto): Observable<{ message: string; id: string }> {
    return this.api.post<{ message: string; id: string }>(`${this.base}/event-types`, data);
  }

  updateEventType(id: string, data: CreateCalendarEventTypeDto): Observable<void> {
    return this.api.put<void>(`${this.base}/event-types/${id}`, data);
  }

  deleteEventType(id: string): Observable<void> {
    return this.api.delete<void>(`${this.base}/event-types/${id}`);
  }

  getWeekendSettings(): Observable<CalendarWeekendSettingDto> {
    return this.api.get<CalendarWeekendSettingDto>(`${this.base}/weekend-settings`);
  }

  upsertWeekendSettings(data: UpsertCalendarWeekendSettingDto): Observable<CalendarWeekendSettingDto> {
    return this.api.put<CalendarWeekendSettingDto>(`${this.base}/weekend-settings`, data);
  }

  getEvents(from: string, to: string, academicYearId?: string | null): Observable<CalendarEventDto[]> {
    let params = new HttpParams().set('from', from).set('to', to);
    if (academicYearId) {
      params = params.set('academicYearId', academicYearId);
    }
    return this.api.get<CalendarEventDto[]>(`${this.base}/events`, params);
  }

  getEvent(id: string): Observable<CalendarEventDto> {
    return this.api.get<CalendarEventDto>(`${this.base}/events/${id}`);
  }

  createEvent(data: CreateCalendarEventDto): Observable<{ message: string; id: string }> {
    return this.api.post<{ message: string; id: string }>(`${this.base}/events`, data);
  }

  updateEvent(id: string, data: CreateCalendarEventDto): Observable<void> {
    return this.api.put<void>(`${this.base}/events/${id}`, data);
  }

  deleteEvent(id: string): Observable<void> {
    return this.api.delete<void>(`${this.base}/events/${id}`);
  }
}
