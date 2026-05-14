import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpParams } from '@angular/common/http';
import { ApiService } from './api.service';
import { ClassFilter } from '../../shared/enums/table-filters.enum';
import { Section, StreamGroup, Shift, Medium } from '../../shared/enums/field-options.enum';

/**
 * Maps a frontend string enum value to the backend 1-based integer.
 * E.g. Section.A → 1, Shift.Morning → 1
 */
function enumToInt<T extends Record<string, string>>(enumObj: T, value: string | null | undefined): number {
  if (!value) return 1;
  const idx = Object.values(enumObj).indexOf(value);
  return idx >= 0 ? idx + 1 : 1;
}

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

  getClasses(
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

    return this.api.get('classes', params);
  }

  getClassDropdown(): Observable<any[]> {
    return this.api.get<any[]>('class/dropdown');
  }

  createClass(classData: any): Observable<any> {
    const payload = {
      className: classData.className,
      section: enumToInt(Section, classData.section),
      streamGroup: enumToInt(StreamGroup, classData.streamGroup),
      academicYearId: classData.academicYear,
      capacity: Number(classData.studentCapacity) || 0,
      classTeacher: classData.classTeacher,
      roomNumber: classData.roomNumber,
      shift: enumToInt(Shift, classData.shift),
      medium: enumToInt(Medium, classData.medium),
      description: classData.description,
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
      section: enumToInt(Section, classData.section),
      streamGroup: enumToInt(StreamGroup, classData.streamGroup),
      academicYearId: classData.academicYear,
      capacity: Number(classData.studentCapacity) || 0,
      classTeacher: classData.classTeacher,
      roomNumber: classData.roomNumber,
      shift: enumToInt(Shift, classData.shift),
      medium: enumToInt(Medium, classData.medium),
      description: classData.description,
    };
    return this.api.put(`classes/${id}`, payload);
  }

  deleteClass(id: string): Observable<any> {
    return this.api.delete(`classes/${id}`);
  }
}
