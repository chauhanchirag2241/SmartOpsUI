import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpParams } from '@angular/common/http';
import { ApiService } from './api.service';
import type { FeeApplicableTo, FeeType } from '../../shared/enums/field-options.enum';

export interface FeeMasterDto {
  id?: string;
  feeName: string;
  feeType: FeeType | string;
  publishedOn?: string | null;
  defaultDueDate?: string | null;
  applicableTo: FeeApplicableTo | string;
  description?: string | null;
  isActive?: boolean;
  classGroupIds?: string[];
}

export interface FeeMasterBasicUpdateDto {
  feeName: string;
  publishedOn?: string | null;
  defaultDueDate?: string | null;
  description?: string | null;
  classGroupIds?: string[];
}

export interface FeeHeadPeriodAmountDto {
  classGroupId: string;
  academicPeriodId: string;
  amount: number;
  classGroupName?: string;
  academicPeriodName?: string;
  id?: string;
}

export interface FeeHeadDto {
  id?: string;
  feeMasterId?: string;
  feeHeadName: string;
  isMandatory: boolean;
  isEditable: boolean;
  amount?: number | null;
  applicableMonths?: number[] | string | null;
  periodAmounts?: FeeHeadPeriodAmountDto[];
  isActive?: boolean;
}

export interface CreateFeeHeadPayload {
  feeHeadName: string;
  isMandatory: boolean;
  isEditable: boolean;
  amount?: number | null;
  applicableMonths?: number[] | null;
  periodAmounts?: { classGroupId: string; academicPeriodId: string; amount: number }[] | null;
}

@Injectable({ providedIn: 'root' })
export class FeeMasterService {
  private readonly api = inject(ApiService);

  getFees(
    pageIndex = 1,
    pageSize = 10,
    searchTerm = '',
    sortColumn: string | null = null,
    sortDirection: string | null = null,
    filter = 'All',
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

    return this.api.get<any>('fees/master', params);
  }

  getFee(id: string): Observable<FeeMasterDto> {
    return this.api.get<FeeMasterDto>(`fees/master/${id}`);
  }

  createFee(data: FeeMasterDto): Observable<{ message: string; feeId: string }> {
    return this.api.post<{ message: string; feeId: string }>('fees/master', data);
  }

  updateFee(id: string, data: FeeMasterDto): Observable<void> {
    return this.api.put<void>(`fees/master/${id}`, data);
  }

  updateFeeBasic(id: string, data: FeeMasterBasicUpdateDto): Observable<void> {
    return this.api.put<void>(`fees/master/${id}/basic`, data);
  }

  deleteFee(id: string): Observable<void> {
    return this.api.delete<void>(`fees/master/${id}`);
  }

  getFeeHeads(
    feeMasterId: string,
    pageIndex = 1,
    pageSize = 10,
    searchTerm = '',
    sortColumn: string | null = null,
    sortDirection: string | null = null,
    filter = 'All',
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

    return this.api.get<any>(`fees/master/${feeMasterId}/heads`, params);
  }

  getFeeHead(id: string): Observable<FeeHeadDto> {
    return this.api.get<FeeHeadDto>(`fees/master/heads/${id}`);
  }

  createFeeHead(
    feeMasterId: string,
    data: CreateFeeHeadPayload,
  ): Observable<{ message: string; feeHeadId: string }> {
    return this.api.post<{ message: string; feeHeadId: string }>(
      `fees/master/${feeMasterId}/heads`,
      data,
    );
  }

  updateFeeHead(id: string, data: CreateFeeHeadPayload): Observable<void> {
    return this.api.put<void>(`fees/master/heads/${id}`, data);
  }

  deleteFeeHead(id: string): Observable<void> {
    return this.api.delete<void>(`fees/master/heads/${id}`);
  }

  getFeeStudents(
    feeMasterId: string,
    pageIndex = 1,
    pageSize = 10,
    searchTerm = '',
    classIds: string[] | null = null,
    sortColumn: string | null = null,
    sortDirection: string | null = null,
  ): Observable<any> {
    let params = new HttpParams()
      .set('pageIndex', pageIndex.toString())
      .set('pageSize', pageSize.toString());

    if (searchTerm) {
      params = params.set('searchTerm', searchTerm);
    }
    if (classIds?.length) {
      for (const id of classIds) {
        params = params.append('classIds', id);
      }
    }
    if (sortColumn) {
      params = params.set('sortColumn', sortColumn);
    }
    if (sortDirection) {
      params = params.set('sortDirection', sortDirection);
    }

    return this.api.get<any>(`fees/master/${feeMasterId}/students`, params);
  }

  getFeeStudent(feeMasterId: string, studentId: string): Observable<FeeStudentDetailDto> {
    return this.api.get<FeeStudentDetailDto>(`fees/master/${feeMasterId}/students/${studentId}`);
  }

  addFeeStudent(
    feeMasterId: string,
    data: { studentId: string; amounts: { feeHeadId: string; amount?: number | null }[] },
  ): Observable<{ message: string; studentId: string }> {
    return this.api.post<{ message: string; studentId: string }>(
      `fees/master/${feeMasterId}/students`,
      data,
    );
  }

  updateFeeStudent(
    feeMasterId: string,
    studentId: string,
    data: {
      amounts: { feeHeadId: string; amount?: number | null; isExcluded?: boolean | null }[];
    },
  ): Observable<void> {
    return this.api.put<void>(`fees/master/${feeMasterId}/students/${studentId}`, data);
  }

  removeFeeStudent(feeMasterId: string, studentId: string): Observable<void> {
    return this.api.delete<void>(`fees/master/${feeMasterId}/students/${studentId}`);
  }
}

export interface FeeStudentHeadAmountDto {
  feeHeadId: string;
  feeHeadName: string;
  isMandatory: boolean;
  isEditable: boolean;
  defaultAmount?: number | null;
  amount?: number | null;
  isExcluded: boolean;
  hasOverride: boolean;
}

export interface FeeStudentDetailDto {
  studentId: string;
  studentName: string;
  heads: FeeStudentHeadAmountDto[];
}
