import { HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class ClassFeeAmountService {
  private readonly api = inject(ApiService);

  getClassSummaries(academicYearId: string, feeStructureVersionId?: string): Observable<any[]> {
    let params = new HttpParams().set('academicYearId', academicYearId);
    if (feeStructureVersionId) params = params.set('feeStructureVersionId', feeStructureVersionId);
    return this.api.get<any[]>('fees/class-amounts/classes', params);
  }

  getClassAmounts(classId: string, academicYearId: string, feeStructureVersionId?: string): Observable<any> {
    let params = new HttpParams().set('academicYearId', academicYearId);
    if (feeStructureVersionId) params = params.set('feeStructureVersionId', feeStructureVersionId);
    return this.api.get<any>(`fees/class-amounts/${classId}`, params);
  }

  saveClassAmounts(classId: string, body: unknown): Observable<any> {
    return this.api.put<any>(`fees/class-amounts/${classId}`, body);
  }
}
