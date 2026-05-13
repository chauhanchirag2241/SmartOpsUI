import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpParams } from '@angular/common/http';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class ClassService {
  private readonly api = inject(ApiService);

  getClasses(
    pageIndex = 1,
    pageSize = 10,
    searchTerm = '',
    sortColumn: string | null = null,
    sortDirection: string | null = null,
    status: string = 'All'
  ): Observable<any> {
    let params = new HttpParams()
      .set('pageIndex', pageIndex.toString())
      .set('pageSize', pageSize.toString())
      .set('status', status);

    if (searchTerm) {
      params = params.set('searchTerm', searchTerm);
    }
    if (sortColumn) {
      params = params.set('sortColumn', sortColumn);
    }
    if (sortDirection) {
      params = params.set('sortDirection', sortDirection);
    }

    return this.api.get('classes', params);
  }

  createClass(classData: any): Observable<any> {
    const payload = {
      className: classData.className,
      section: classData.section,
      streamGroup: classData.streamGroup,
      academicYear: classData.academicYear,
      capacity: Number(classData.studentCapacity) || 0,
      classTeacher: classData.classTeacher,
      roomNumber: classData.roomNumber,
      description: classData.description,
      status: classData.status || 'Active',
    };

    return this.api.post('classes', payload);
  }

  getClassById(id: string): Observable<any> {
    return this.api.get(`classes/${id}`);
  }

  updateClass(id: string, classData: any): Observable<any> {
    const payload = {
      id,
      className: classData.className,
      section: classData.section,
      streamGroup: classData.streamGroup,
      academicYear: classData.academicYear,
      capacity: Number(classData.studentCapacity) || 0,
      classTeacher: classData.classTeacher,
      roomNumber: classData.roomNumber,
      description: classData.description,
      status: classData.status || 'Active',
    };
    return this.api.put(`classes/${id}`, payload);
  }

  deleteClass(id: string): Observable<any> {
    return this.api.delete(`classes/${id}`);
  }
}
