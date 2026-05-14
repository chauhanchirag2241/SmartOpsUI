import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpParams } from '@angular/common/http';
import { ApiService } from './api.service';

export interface SubjectDTO {
  id?: string;
  subjectName: string;
  subjectCode: string;
  subjectType: 'Theory' | 'Practical' | 'Both';
  subjectCategory: 'Core' | 'Elective' | 'Co-curricular';
  medium: string;
  assignedClasses: string[];
  periodsPerWeek: number;
  periodDuration: string;
  teachingDays: string[];
  maxTheory: number;
  maxPractical: number;
  passingMarks: number;
  gradeSystem: string;
  syllabusTextbook?: string;
  curriculum?: string;
  description?: string;
}

@Injectable({
  providedIn: 'root',
})
export class SubjectService {
  private readonly api = inject(ApiService);

  createSubject(data: SubjectDTO): Observable<SubjectDTO> {
    return this.api.post<SubjectDTO>('subjects', data);
  }

  updateSubject(id: string, data: SubjectDTO): Observable<SubjectDTO> {
    return this.api.put<SubjectDTO>(`subjects/${id}`, data);
  }

  getSubject(id: string): Observable<SubjectDTO> {
    return this.api.get<SubjectDTO>(`subjects/${id}`);
  }

  getSubjects(
    pageIndex = 1,
    pageSize = 10,
    searchTerm = '',
    sortColumn: string | null = null,
    sortDirection: string | null = null,
    filter = 'All'
  ): Observable<any> {
    let params = new HttpParams()
      .set('pageIndex', pageIndex.toString())
      .set('pageSize', pageSize.toString())
      .set('filter', filter);

    if (searchTerm) {
      params = params.set('searchTerm', searchTerm);
    }
    if (sortColumn) {
      params = params.set('sortColumn', sortColumn);
    }
    if (sortDirection) {
      params = params.set('sortDirection', sortDirection);
    }

    return this.api.get<any>('subjects', params);
  }

  getSubjectDropdown(): Observable<any[]> {
    return this.api.get<any[]>('subject/dropdown');
  }

  deleteSubject(id: string): Observable<void> {
    return this.api.delete<void>(`subjects/${id}`);
  }
}
