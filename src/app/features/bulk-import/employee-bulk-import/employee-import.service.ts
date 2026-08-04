import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import type {
  EmployeeImportCommitResult,
  EmployeeImportValidateResult,
} from '../shared/bulk-import.models';

@Injectable({ providedIn: 'root' })
export class EmployeeImportService {
  private readonly api = inject(ApiService);

  downloadTemplate(): Observable<Blob> {
    return this.api.getBlob('employees/import/template');
  }

  validate(file: File): Observable<EmployeeImportValidateResult> {
    const body = new FormData();
    body.append('file', file, file.name);
    return this.api.postFormData<EmployeeImportValidateResult>('employees/import/validate', body);
  }

  commit(file: File): Observable<EmployeeImportCommitResult> {
    const body = new FormData();
    body.append('file', file, file.name);
    return this.api.postFormData<EmployeeImportCommitResult>('employees/import/commit', body);
  }
}
