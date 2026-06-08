import { HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';

function parseEnumValue(
  enumObj: Record<string, string | number>,
  value: unknown,
  fallback: number,
): number {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const byName = enumObj[trimmed];
    if (typeof byName === 'number') return byName;
    const num = Number(trimmed);
    if (!Number.isNaN(num)) return num;
  }
  return fallback;
}

function normalizeContent(raw: unknown): NoticeContentPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  const questions = Array.isArray(c['questions'])
    ? (c['questions'] as NoticeFormQuestion[])
    : [];
  const targetRecipientIds = Array.isArray(c['targetRecipientIds'])
    ? (c['targetRecipientIds'] as string[])
    : [];
  return {
    questions,
    documentName: (c['documentName'] as string | null | undefined) ?? '',
    documentUrl: (c['documentUrl'] as string | null | undefined) ?? '',
    feeMessageTemplate: (c['feeMessageTemplate'] as string | null | undefined) ?? '',
    targetRecipientIds,
  };
}

export function normalizeNoticeDetail(raw: unknown): NoticeDetail {
  const r = (raw ?? {}) as Record<string, unknown>;
  const targetRefId = (r['targetRefId'] ?? r['TargetRefId']) as string | null | undefined;
  const content = normalizeContent(r['content'] ?? r['Content']);
  const recipientIds = content?.targetRecipientIds?.length
    ? content.targetRecipientIds
    : targetRefId
      ? [targetRefId]
      : [];

  return {
    id: String(r['id'] ?? r['Id'] ?? ''),
    title: String(r['title'] ?? r['Title'] ?? ''),
    body: String(r['body'] ?? r['Body'] ?? ''),
    statusLabel: String(r['statusLabel'] ?? r['StatusLabel'] ?? ''),
    requiresResponse: Boolean(r['requiresResponse'] ?? r['RequiresResponse']),
    responseDeadline: (r['responseDeadline'] ?? r['ResponseDeadline']) as string | null | undefined,
    targetType: parseEnumValue(
      NoticeTargetType,
      r['targetType'] ?? r['TargetType'],
      NoticeTargetType.AllStaff,
    ) as NoticeTargetType,
    targetTypeLabel: (r['targetTypeLabel'] ?? r['TargetTypeLabel']) as string | undefined,
    targetRefId: targetRefId ?? null,
    contentType: parseEnumValue(
      NoticeContentType,
      r['contentType'] ?? r['ContentType'],
      NoticeContentType.Announcement,
    ) as NoticeContentType,
    contentTypeLabel: (r['contentTypeLabel'] ?? r['ContentTypeLabel']) as string | undefined,
    content: content
      ? { ...content, targetRecipientIds: recipientIds }
      : { targetRecipientIds: recipientIds },
  };
}

export enum NoticeContentType {
  Announcement = 1,
  Form = 2,
  FeeReminder = 3,
  Document = 4,
}

export enum NoticeTargetType {
  AllStaff = 1,
  ClassParents = 2,
  SingleUser = 3,
  SingleParent = 4,
  PendingFeeParents = 5,
  SingleTeacher = 6,
}

export interface NoticeFormQuestion {
  id: string;
  label: string;
  type: 'text' | 'yesno' | 'number' | 'mcq_single' | 'mcq_multi' | 'poll';
  required: boolean;
  options?: NoticeQuestionOption[];
  hasAnswerKey?: boolean;
  correctOptionIds?: string[];
}

export interface NoticeQuestionOption {
  id: string;
  label: string;
}

export interface NoticeContentPayload {
  questions?: NoticeFormQuestion[];
  documentName?: string | null;
  documentUrl?: string | null;
  feeMessageTemplate?: string | null;
  targetRecipientIds?: string[];
}

export interface NoticeResponseItem {
  id: string;
  respondentUserId: string;
  respondentName?: string | null;
  responseBody: string;
  respondedOn: string;
}

export interface CreateNoticeRequest {
  title: string;
  body: string;
  requiresResponse: boolean;
  responseDeadline?: string | null;
  targetType: NoticeTargetType;
  targetRefId?: string | null;
  contentType: NoticeContentType;
  content?: NoticeContentPayload | null;
}

export interface NoticeAudienceOption {
  id: string;
  name: string;
  subtitle?: string | null;
}

export interface NoticeAudiencePreview {
  estimatedRecipients: number;
  options: NoticeAudienceOption[];
}

export interface NoticeListItem {
  id: string;
  title: string;
  statusLabel: string;
  targetTypeLabel: string;
  contentTypeLabel: string;
  requiresResponse: boolean;
  responseCount: number;
  publishedOn?: string;
  isActive?: boolean;
}

export interface NoticeDetail {
  id: string;
  title: string;
  body: string;
  statusLabel: string;
  requiresResponse: boolean;
  responseDeadline?: string | null;
  targetType: NoticeTargetType;
  targetTypeLabel?: string;
  targetRefId?: string | null;
  contentType: NoticeContentType;
  contentTypeLabel?: string;
  content?: NoticeContentPayload | null;
}

@Injectable({ providedIn: 'root' })
export class NoticesService {
  private readonly api = inject(ApiService);

  getList(): Observable<NoticeListItem[]> {
    return this.api.get('notices');
  }

  getById(id: string): Observable<NoticeDetail> {
    return this.api.get<unknown>(`notices/${id}`).pipe(map((raw) => normalizeNoticeDetail(raw)));
  }

  create(body: CreateNoticeRequest): Observable<unknown> {
    return this.api.post('notices', body);
  }

  update(id: string, body: CreateNoticeRequest): Observable<unknown> {
    return this.api.put(`notices/${id}`, body);
  }

  publish(id: string): Observable<unknown> {
    return this.api.post(`notices/${id}/publish`, {});
  }

  getResponses(id: string): Observable<NoticeResponseItem[]> {
    return this.api.get(`notices/${id}/responses`);
  }

  respond(id: string, responseBody: string): Observable<unknown> {
    return this.api.post(`notices/${id}/respond`, { responseBody });
  }

  delete(id: string): Observable<void> {
    return this.api.delete(`notices/${id}`);
  }

  getAudiencePreview(
    targetType: NoticeTargetType,
    targetRefId?: string | null,
    targetRefIds?: string[],
  ): Observable<NoticeAudiencePreview> {
    let params = new HttpParams().set('targetType', String(targetType));
    if (targetRefIds?.length) {
      for (const id of targetRefIds) {
        params = params.append('targetRefIds', id);
      }
    } else if (targetRefId) {
      params = params.set('targetRefId', targetRefId);
    }
    return this.api.get('notices/audience-preview', params);
  }
}
