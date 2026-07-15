import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface FrontOfficeLookupItem {
  id: string;
  name: string;
}

export interface FrontOfficeListQuery {
  search?: string;
  activeFilter?: string;
  from?: string;
  to?: string;
}

export interface ComplaintTypeDto {
  id: string;
  name: string;
  description?: string | null;
  displayOrder: number;
  isActive?: boolean;
  streamGroup?: string | number | null;
}

export interface VisitorPurposeDto {
  id: string;
  name: string;
  description?: string | null;
  displayOrder: number;
  isActive?: boolean;
  streamGroup?: string | number | null;
}

export interface VisitorDto {
  id: string;
  name: string;
  phone?: string | null;
  idCardType?: string | null;
  idCardNumber?: string | null;
  purposeId: string;
  purposeName?: string;
  meetingWith?: string | null;
  inTime: string;
  outTime?: string | null;
  note?: string | null;
  documentPath?: string | null;
  isActive?: boolean;
  streamGroup?: string | number | null;
}

export interface PhoneLogDto {
  id: string;
  callerName: string;
  phone?: string | null;
  callType: number;
  callTypeLabel?: string;
  callDate: string;
  duration?: string | null;
  description: string;
  nextFollowUpDate?: string | null;
  note?: string | null;
  isActive?: boolean;
  streamGroup?: string | number | null;
}

export interface ComplaintDto {
  id: string;
  complaintTypeId: string;
  complaintTypeName?: string;
  complaintDate: string;
  isAnonymous: boolean;
  complainantName?: string | null;
  phone?: string | null;
  description: string;
  assignedToEmployeeId: string;
  assignedToEmployeeName?: string;
  status: number;
  statusLabel?: string;
  actionTaken?: string | null;
  note?: string | null;
  documentPath?: string | null;
  isActive?: boolean;
  streamGroup?: string | number | null;
}

export interface AdmissionInquiryDto {
  id: string;
  parentName: string;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
  studentName: string;
  classLabel?: string | null;
  inquiryDate: string;
  nextFollowUpDate?: string | null;
  assignedToEmployeeId?: string | null;
  assignedToEmployeeName?: string | null;
  reference?: string | null;
  status: number;
  statusLabel?: string;
  description?: string | null;
  autoFollowUp: boolean;
  isActive?: boolean;
  streamGroup?: string | number | null;
}

@Injectable({ providedIn: 'root' })
export class FrontOfficeService {
  private readonly api = inject(ApiService);
  private readonly base = 'front-office';

  getEmployees(): Observable<FrontOfficeLookupItem[]> {
    return this.api.get<FrontOfficeLookupItem[]>(`${this.base}/lookups/employees`);
  }

  private toListParams(query?: string | FrontOfficeListQuery): HttpParams {
    let params = new HttpParams();
    if (typeof query === 'string') {
      if (query) params = params.set('search', query);
      return params;
    }
    if (!query) return params;
    if (query.search) params = params.set('search', query.search);
    if (query.activeFilter) params = params.set('activeFilter', query.activeFilter);
    if (query.from) params = params.set('from', query.from);
    if (query.to) params = params.set('to', query.to);
    return params;
  }

  // —— Setup masters ——
  getComplaintTypes(query?: string | FrontOfficeListQuery): Observable<ComplaintTypeDto[]> {
    return this.api.get<ComplaintTypeDto[]>(`${this.base}/complaint-types`, this.toListParams(query));
  }

  getComplaintType(id: string): Observable<ComplaintTypeDto> {
    return this.api.get<ComplaintTypeDto>(`${this.base}/complaint-types/${id}`);
  }

  createComplaintType(body: Partial<ComplaintTypeDto>): Observable<ComplaintTypeDto> {
    return this.api.post<ComplaintTypeDto>(`${this.base}/complaint-types`, body);
  }

  updateComplaintType(id: string, body: Partial<ComplaintTypeDto>): Observable<ComplaintTypeDto> {
    return this.api.put<ComplaintTypeDto>(`${this.base}/complaint-types/${id}`, body);
  }

  deleteComplaintType(id: string): Observable<void> {
    return this.api.delete<void>(`${this.base}/complaint-types/${id}`);
  }

  getVisitorPurposes(query?: string | FrontOfficeListQuery): Observable<VisitorPurposeDto[]> {
    return this.api.get<VisitorPurposeDto[]>(
      `${this.base}/visitor-purposes`,
      this.toListParams(query),
    );
  }

  getVisitorPurpose(id: string): Observable<VisitorPurposeDto> {
    return this.api.get<VisitorPurposeDto>(`${this.base}/visitor-purposes/${id}`);
  }

  createVisitorPurpose(body: Partial<VisitorPurposeDto>): Observable<VisitorPurposeDto> {
    return this.api.post<VisitorPurposeDto>(`${this.base}/visitor-purposes`, body);
  }

  updateVisitorPurpose(id: string, body: Partial<VisitorPurposeDto>): Observable<VisitorPurposeDto> {
    return this.api.put<VisitorPurposeDto>(`${this.base}/visitor-purposes/${id}`, body);
  }

  deleteVisitorPurpose(id: string): Observable<void> {
    return this.api.delete<void>(`${this.base}/visitor-purposes/${id}`);
  }

  // —— Visitors ——
  getVisitors(query?: string | FrontOfficeListQuery): Observable<VisitorDto[]> {
    return this.api.get<VisitorDto[]>(`${this.base}/visitors`, this.toListParams(query));
  }

  getVisitor(id: string): Observable<VisitorDto> {
    return this.api.get<VisitorDto>(`${this.base}/visitors/${id}`);
  }

  createVisitor(body: Partial<VisitorDto>): Observable<VisitorDto> {
    return this.api.post<VisitorDto>(`${this.base}/visitors`, body);
  }

  updateVisitor(id: string, body: Partial<VisitorDto>): Observable<VisitorDto> {
    return this.api.put<VisitorDto>(`${this.base}/visitors/${id}`, body);
  }

  checkoutVisitor(id: string): Observable<VisitorDto> {
    return this.api.post<VisitorDto>(`${this.base}/visitors/${id}/checkout`, {});
  }

  deleteVisitor(id: string): Observable<void> {
    return this.api.delete<void>(`${this.base}/visitors/${id}`);
  }

  // —— Phone logs ——
  getPhoneLogs(query?: string | FrontOfficeListQuery): Observable<PhoneLogDto[]> {
    return this.api.get<PhoneLogDto[]>(`${this.base}/phone-logs`, this.toListParams(query));
  }

  getPhoneLog(id: string): Observable<PhoneLogDto> {
    return this.api.get<PhoneLogDto>(`${this.base}/phone-logs/${id}`);
  }

  createPhoneLog(body: Partial<PhoneLogDto>): Observable<PhoneLogDto> {
    return this.api.post<PhoneLogDto>(`${this.base}/phone-logs`, body);
  }

  updatePhoneLog(id: string, body: Partial<PhoneLogDto>): Observable<PhoneLogDto> {
    return this.api.put<PhoneLogDto>(`${this.base}/phone-logs/${id}`, body);
  }

  deletePhoneLog(id: string): Observable<void> {
    return this.api.delete<void>(`${this.base}/phone-logs/${id}`);
  }

  // —— Complaints ——
  getComplaints(query?: string | FrontOfficeListQuery): Observable<ComplaintDto[]> {
    return this.api.get<ComplaintDto[]>(`${this.base}/complaints`, this.toListParams(query));
  }

  getComplaint(id: string): Observable<ComplaintDto> {
    return this.api.get<ComplaintDto>(`${this.base}/complaints/${id}`);
  }

  createComplaint(body: Partial<ComplaintDto>): Observable<ComplaintDto> {
    return this.api.post<ComplaintDto>(`${this.base}/complaints`, body);
  }

  updateComplaint(id: string, body: Partial<ComplaintDto>): Observable<ComplaintDto> {
    return this.api.put<ComplaintDto>(`${this.base}/complaints/${id}`, body);
  }

  deleteComplaint(id: string): Observable<void> {
    return this.api.delete<void>(`${this.base}/complaints/${id}`);
  }

  // —— Admission inquiries ——
  getAdmissionInquiries(query?: string | FrontOfficeListQuery): Observable<AdmissionInquiryDto[]> {
    return this.api.get<AdmissionInquiryDto[]>(
      `${this.base}/admission-inquiries`,
      this.toListParams(query),
    );
  }

  getAdmissionInquiry(id: string): Observable<AdmissionInquiryDto> {
    return this.api.get<AdmissionInquiryDto>(`${this.base}/admission-inquiries/${id}`);
  }

  createAdmissionInquiry(body: Partial<AdmissionInquiryDto>): Observable<AdmissionInquiryDto> {
    return this.api.post<AdmissionInquiryDto>(`${this.base}/admission-inquiries`, body);
  }

  updateAdmissionInquiry(
    id: string,
    body: Partial<AdmissionInquiryDto>,
  ): Observable<AdmissionInquiryDto> {
    return this.api.put<AdmissionInquiryDto>(`${this.base}/admission-inquiries/${id}`, body);
  }

  convertAdmissionInquiry(id: string): Observable<AdmissionInquiryDto> {
    return this.api.post<AdmissionInquiryDto>(`${this.base}/admission-inquiries/${id}/convert`, {});
  }

  deleteAdmissionInquiry(id: string): Observable<void> {
    return this.api.delete<void>(`${this.base}/admission-inquiries/${id}`);
  }
}
