import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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
  private apiUrl = '/api/subjects'; // Update with your actual API endpoint

  constructor(private http: HttpClient) {}

  createSubject(data: SubjectDTO): Observable<SubjectDTO> {
    return this.http.post<SubjectDTO>(`${this.apiUrl}`, data);
  }

  updateSubject(id: string, data: SubjectDTO): Observable<SubjectDTO> {
    return this.http.put<SubjectDTO>(`${this.apiUrl}/${id}`, data);
  }

  getSubject(id: string): Observable<SubjectDTO> {
    return this.http.get<SubjectDTO>(`${this.apiUrl}/${id}`);
  }

  getSubjects(): Observable<SubjectDTO[]> {
    return this.http.get<SubjectDTO[]>(`${this.apiUrl}`);
  }

  deleteSubject(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
