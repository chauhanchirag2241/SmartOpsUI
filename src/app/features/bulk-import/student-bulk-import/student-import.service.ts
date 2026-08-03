import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import type {
  StudentImportCommitResult,
  StudentImportValidateResult,
} from '../shared/bulk-import.models';

@Injectable({ providedIn: 'root' })
export class StudentImportService {
  private readonly api = inject(ApiService);

  downloadTemplate(): Observable<Blob> {
    return this.api.getBlob('students/import/template');
  }

  validate(file: File, academicYearId: string): Observable<StudentImportValidateResult> {
    const body = new FormData();
    body.append('file', file, file.name);
    const params = new HttpParams().set('academicYearId', academicYearId);
    return this.api.postFormData<StudentImportValidateResult>('students/import/validate', body, params);
  }

  commit(file: File, academicYearId: string): Observable<StudentImportCommitResult> {
    const body = new FormData();
    body.append('file', file, file.name);
    const params = new HttpParams().set('academicYearId', academicYearId);
    return this.api.postFormData<StudentImportCommitResult>('students/import/commit', body, params);
  }
}
