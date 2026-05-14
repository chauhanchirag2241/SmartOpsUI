import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root'
})
export class TeacherService {
  private readonly api = inject(ApiService);

  getTeachers(
    pageIndex = 1,
    pageSize = 10,
    searchQuery = '',
    sortColumn: string | null = null,
    sortDirection: string | null = null,
    filter: any = null
  ): Observable<any> {
    let params = new HttpParams()
      .set('pageIndex', pageIndex.toString())
      .set('pageSize', pageSize.toString())
      .set('searchQuery', searchQuery);

    if (sortColumn) params = params.set('sortColumn', sortColumn);
    if (sortDirection) params = params.set('sortDirection', sortDirection);
    if (filter) params = params.set('filter', filter.toString());

    return this.api.get<any>('teachers', params);
  }

  getTeacherById(id: string): Observable<any> {
    return this.api.get<any>(`teachers/${id}`);
  }

  createTeacher(teacher: any): Observable<any> {
    return this.api.post<any>('teachers', teacher);
  }

  updateTeacher(id: string, teacher: any): Observable<any> {
    return this.api.put<any>(`teachers/${id}`, teacher);
  }

  deleteTeacher(id: string): Observable<any> {
    return this.api.delete<any>(`teachers/${id}`);
  }
}
