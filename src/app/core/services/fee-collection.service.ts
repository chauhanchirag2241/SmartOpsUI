import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface FeeCollectionHead {
  feeHeadId: string;
  feeHeadName: string;
  isMandatory: boolean;
  isEditable: boolean;
  dueAmount: number;
  paidAmount: number;
  balance: number;
  isExcluded: boolean;
}

export interface FeeCollectionMasterCard {
  feeMasterId: string;
  feeName: string;
  feeType: string;
  publishedOn?: string | null;
  defaultDueDate?: string | null;
  academicPeriodId?: string | null;
  periodLabel?: string | null;
  totalDue: number;
  totalPaid: number;
  totalPending: number;
  status: string;
  isPublished?: boolean;
  canCollect: boolean;
  studentAmountsLocked: boolean;
  heads: FeeCollectionHead[];
}

export interface FeeCollectionHistoryLine {
  feeHeadId: string;
  feeHeadName: string;
  dueAmount: number;
  paidAmount: number;
  /** Remaining on this fee head after this payment. */
  balanceAfter?: number;
  isMandatory: boolean;
  isEditable: boolean;
}

export interface FeeCollectionHistoryPayment {
  paymentId: string;
  paymentDate: string;
  totalAmount: number;
  paymentMethod?: string | null;
  academicPeriodId?: string | null;
  periodLabel?: string | null;
  collectedBy?: string | null;
  remarks?: string | null;
  lines: FeeCollectionHistoryLine[];
}

export interface FeeCollectionHistoryRow {
  feeMasterId: string;
  feeName: string;
  totalDue: number;
  totalPaid: number;
  totalPending: number;
  status: string;
  payments: FeeCollectionHistoryPayment[];
}

export interface FeeCollectionDetail {
  student: {
    studentId: string;
    studentName: string;
    fatherName?: string | null;
    mobile?: string | null;
    className?: string | null;
    section?: string | null;
    rollNumber?: string | null;
    admissionNo?: string | null;
    initials: string;
  };
  summaryTotal: number;
  summaryPaid: number;
  summaryPending: number;
  dueCards: FeeCollectionMasterCard[];
  history: FeeCollectionHistoryRow[];
}

export interface CollectFeePayload {
  feeMasterId: string;
  academicPeriodId?: string | null;
  paymentMethod: string;
  remarks?: string | null;
  lines: { feeHeadId: string; amount: number }[];
}

export interface FeeCollectionStudentSummary {
  studentId: string;
  totalDue: number;
  totalPaid: number;
  totalPending: number;
  status: string;
}

@Injectable({ providedIn: 'root' })
export class FeeCollectionService {
  private readonly api = inject(ApiService);

  getStudentDetail(studentId: string): Observable<FeeCollectionDetail> {
    return this.api.get<FeeCollectionDetail>(`fees/collection/students/${studentId}`);
  }

  getStudentSummaries(studentIds: string[]): Observable<FeeCollectionStudentSummary[]> {
    return this.api.post<FeeCollectionStudentSummary[]>(
      'fees/collection/students/summaries',
      studentIds,
    );
  }

  collect(studentId: string, payload: CollectFeePayload): Observable<{ paymentId: string; message: string }> {
    return this.api.post<{ paymentId: string; message: string }>(
      `fees/collection/students/${studentId}/collect`,
      payload,
    );
  }
}
