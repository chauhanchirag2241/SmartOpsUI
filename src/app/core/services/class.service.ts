import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpParams } from '@angular/common/http';
import { ApiService } from './api.service';
import { ClassFilter } from '../../shared/enums/table-filters.enum';

/** Maps frontend filter label → ClassFilter int */
function resolveFilter(label: string): ClassFilter {
  switch (label) {
    case 'Active': return ClassFilter.Active;
    case 'Inactive': return ClassFilter.Inactive;
    default: return ClassFilter.All;
  }
}

@Injectable({ providedIn: 'root' })
export class ClassService {
  private readonly api = inject(ApiService);

  getClassGroups(
    pageIndex = 1,
    pageSize = 10,
    searchTerm = '',
    sortColumn: string | null = null,
    sortDirection: string | null = null,
    filter: string = 'All'
  ): Observable<any> {
    let params = new HttpParams()
      .set('pageIndex', pageIndex.toString())
      .set('pageSize', pageSize.toString())
      .set('filter', resolveFilter(filter).toString());

    if (searchTerm) {
      params = params.set('searchTerm', searchTerm);
    }
    if (sortColumn) {
      params = params.set('sortColumn', sortColumn);
    }
    if (sortDirection) {
      params = params.set('sortDirection', sortDirection);
    }

    return this.api.get('classGroups', params);
  }

  getClassGroupById(id: string): Observable<any> {
    return this.api.get(`classGroups/${id}`);
  }

  getClasses(
    pageIndex = 1,
    pageSize = 10,
    searchTerm = '',
    sortColumn: string | null = null,
    sortDirection: string | null = null,
    filter: string = 'All',
    classGroupId?: string | null
  ): Observable<any> {
    let params = new HttpParams()
      .set('pageIndex', pageIndex.toString())
      .set('pageSize', pageSize.toString())
      .set('filter', resolveFilter(filter).toString());

    if (searchTerm) {
      params = params.set('searchTerm', searchTerm);
    }
    if (sortColumn) {
      params = params.set('sortColumn', sortColumn);
    }
    if (sortDirection) {
      params = params.set('sortDirection', sortDirection);
    }
    if (classGroupId) {
      params = params.set('classGroupId', classGroupId);
    }

    return this.api.get('classes', params);
  }

  /** Section-scoped by default (Class 1 - A). Pass scope `'group'` for Class 1 only. */
  getClassDropdown(academicYearId?: string, scope?: 'group' | 'section'): Observable<any[]> {
    let params = new HttpParams();
    if (academicYearId) {
      params = params.set('academicYearId', academicYearId);
    }
    if (scope === 'group') {
      params = params.set('scope', 'group');
    }
    return this.api.get<any[]>('class/dropdown', params.keys().length ? params : undefined);
  }

  createClass(classData: any): Observable<any> {
    const payload = {
      classGroupId: classData.classGroupId,
      section: String(classData.section ?? '').trim(),
      academicYearId: classData.academicYearId || classData.academicYear,
      capacity: Number(classData.studentCapacity) || 0,
      roomNumber: classData.roomNumber,
      shiftId: classData.shiftId || classData.shift || null,
    };

    return this.api.post('classes', payload);
  }

  getClassById(id: string): Observable<any> {
    return this.api.get(`classes/${id}`);
  }

  updateClass(id: string, classData: any): Observable<any> {
    const payload = {
      id,
      classGroupId: classData.classGroupId,
      section: String(classData.section ?? '').trim(),
      capacity: Number(classData.studentCapacity) || 0,
      roomNumber: classData.roomNumber,
      shiftId: classData.shiftId || classData.shift || null,
    };
    return this.api.put(`classes/${id}`, payload);
  }

  deleteClass(id: string): Observable<any> {
    return this.api.delete(`classes/${id}`);
  }

  recoverClass(id: string): Observable<any> {
    return this.api.put(`classes/${id}/recover`, {});
  }

  getClassGroupSubjects(classGroupId: string): Observable<any[]> {
    return this.api.get<any[]>(`classGroups/${classGroupId}/subjects`);
  }

  addClassGroupSubject(classGroupId: string, subjectId: string): Observable<any> {
    return this.api.post(`classGroups/${classGroupId}/subjects`, { subjectId });
  }

  removeClassGroupSubject(id: string): Observable<any> {
    return this.api.delete(`classGroups/subjects/${id}`);
  }
}
