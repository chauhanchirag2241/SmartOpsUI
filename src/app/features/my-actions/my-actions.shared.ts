import { WorkflowItemType } from '../../core/services/my-actions.service';

export interface ActionTableRow extends Record<string, unknown> {
  id: string;
  itemType: WorkflowItemType;
  itemTypeLabel: string;
  title: string;
  summary: string;
  dueDate: string;
  createdOn: string;
}

export interface ActionLeaveRequest {
  studentName?: string;
  employeeName?: string;
  /** @deprecated use employeeName */
  teacherName?: string;
  fromDate: string;
  toDate: string;
  reason?: string;
  statusLabel: string;
  leaveTypeLabel?: string;
  dayCount?: number;
}

export interface NoticeFormQuestionView {
  id: string;
  label: string;
  type: string;
  required: boolean;
  options?: { id: string; label: string }[];
  hasAnswerKey?: boolean;
  correctOptionIds?: string[];
}

export interface NoticeContentView {
  questions?: NoticeFormQuestionView[];
  documentName?: string;
  documentUrl?: string;
  feeMessageTemplate?: string;
}

export interface ActionNoticeDetail {
  title: string;
  body: string;
  requiresResponse: boolean;
  responseDeadline?: string;
  contentType?: string;
  contentTypeLabel?: string;
  content?: NoticeContentView | null;
}

export interface ActionDetailView {
  id: string;
  itemType: WorkflowItemType;
  itemTypeLabel: string;
  title: string;
  summary?: string;
  dueDate?: string;
  statusLabel?: string;
  leaveRequest: ActionLeaveRequest | null;
  notice: ActionNoticeDetail | null;
}

export function resolveWorkflowItemType(value: unknown): WorkflowItemType | null {
  if (typeof value === 'number' && [1, 2, 3].includes(value)) {
    return value as WorkflowItemType;
  }

  if (typeof value === 'string') {
    const map: Record<string, WorkflowItemType> = {
      LeaveApproval: WorkflowItemType.LeaveApproval,
      NoticeResponse: WorkflowItemType.NoticeResponse,
      FormFill: WorkflowItemType.FormFill,
    };
    return map[value] ?? null;
  }

  return null;
}

function asString(value: unknown): string | undefined {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text || undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function mapLeaveRequest(raw: unknown): ActionLeaveRequest | null {
  if (!raw || typeof raw !== 'object') return null;

  const record = raw as Record<string, unknown>;
  const fromDate = asString(record['fromDate']);
  const toDate = asString(record['toDate']);
  if (!fromDate || !toDate) return null;

  return {
    studentName: asString(record['studentName']),
    employeeName: asString(record['employeeName'] ?? record['teacherName']),
    fromDate,
    toDate,
    reason: asString(record['reason']),
    statusLabel: asString(record['statusLabel']) ?? 'Pending',
    leaveTypeLabel: asString(record['leaveTypeLabel']),
    dayCount: asNumber(record['dayCount']),
  };
}

function asBool(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function mapQuestionOptions(raw: unknown): { id: string; label: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o) => {
      if (!o || typeof o !== 'object') return null;
      const r = o as Record<string, unknown>;
      const id = asString(r['id']) ?? asString(r['Id']);
      const label = asString(r['label']) ?? asString(r['Label']);
      if (!id || !label) return null;
      return { id, label };
    })
    .filter((o): o is { id: string; label: string } => o !== null);
}

function mapNoticeContent(raw: unknown): NoticeContentView | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const questionsRaw = record['questions'] ?? record['Questions'];
  const questions = Array.isArray(questionsRaw)
    ? questionsRaw
        .map((q) => {
          if (!q || typeof q !== 'object') return null;
          const item = q as Record<string, unknown>;
          const id = asString(item['id']) ?? asString(item['Id']);
          const label = asString(item['label']) ?? asString(item['Label']);
          if (!id || !label) return null;
          const options = mapQuestionOptions(item['options'] ?? item['Options']);

          const correctRaw = item['correctOptionIds'] ?? item['CorrectOptionIds'];
          const correctOptionIds = Array.isArray(correctRaw)
            ? correctRaw.map((x) => String(x)).filter((x) => x.trim())
            : undefined;
          const mapped: NoticeFormQuestionView = {
            id,
            label,
            type: (asString(item['type']) ?? asString(item['Type']) ?? 'text').toLowerCase(),
            required: asBool(item['required']) || asBool(item['Required']),
            options: options.length ? options : undefined,
            hasAnswerKey: asBool(item['hasAnswerKey']) || asBool(item['HasAnswerKey']),
            correctOptionIds,
          };
          return mapped;
        })
        .filter((q): q is NoticeFormQuestionView => q !== null)
    : undefined;

  return {
    questions,
    documentName: asString(record['documentName']),
    documentUrl: asString(record['documentUrl']),
    feeMessageTemplate: asString(record['feeMessageTemplate']),
  };
}

export function mapNoticeDetail(raw: unknown): ActionNoticeDetail | null {
  if (!raw || typeof raw !== 'object') return null;

  const record = raw as Record<string, unknown>;
  const title = asString(record['title']);
  const body = asString(record['body']);
  if (!title && !body) return null;

  return {
    title: title ?? 'Notice',
    body: body ?? '',
    requiresResponse: record['requiresResponse'] === true,
    responseDeadline: asString(record['responseDeadline']),
    contentType: asString(record['contentType']) ?? asString(record['contentTypeLabel']),
    contentTypeLabel: asString(record['contentTypeLabel']),
    content: mapNoticeContent(record['content'] ?? record['Content']),
  };
}

export function mapActionDetail(raw: unknown): ActionDetailView | null {
  if (!raw || typeof raw !== 'object') return null;

  const record = raw as Record<string, unknown>;
  const id = asString(record['id']);
  const itemType = resolveWorkflowItemType(record['itemType']);
  if (!id || itemType == null) return null;

  const leaveRaw = record['leaveRequest'] ?? record['LeaveRequest'];
  const noticeRaw = record['notice'] ?? record['Notice'];

  return {
    id,
    itemType,
    itemTypeLabel: asString(record['itemTypeLabel']) ?? WorkflowItemType[itemType],
    title: asString(record['title']) ?? 'Action',
    summary: asString(record['summary']),
    dueDate: asString(record['dueDate']),
    statusLabel: asString(record['statusLabel']),
    leaveRequest: mapLeaveRequest(leaveRaw),
    notice: mapNoticeDetail(noticeRaw),
  };
}

export function mapActionRows(data: unknown): ActionTableRow[] {
  if (!Array.isArray(data)) return [];

  return data
    .map((raw) => {
      if (!raw || typeof raw !== 'object') return null;
      const record = raw as Record<string, unknown>;
      const id = asString(record['id']);
      const itemType = resolveWorkflowItemType(record['itemType']);
      if (!id || itemType == null) return null;

      return {
        id,
        itemType,
        itemTypeLabel: asString(record['itemTypeLabel']) ?? WorkflowItemType[itemType],
        title: asString(record['title']) ?? '—',
        summary: asString(record['summary']) ?? '—',
        dueDate: asString(record['dueDate']) ?? '—',
        createdOn: asString(record['createdOn']) ?? '',
      } satisfies ActionTableRow;
    })
    .filter((row): row is ActionTableRow => row !== null);
}
