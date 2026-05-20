import { HomeworkPriority, HomeworkSubmissionStatus } from '../../core/services/homework.service';

export interface HomeworkListItem {
  id: string;
  title: string;
  description?: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  assignDate: string;
  dueDate: string;
  priority: HomeworkPriority;
  priorityLabel: string;
  marks?: number | null;
  submissionType: number;
  submissionTypeLabel: string;
  status: string;
  submitted: number;
  pending: number;
  late: number;
  total: number;
}

export interface StudentRow {
  studentId: string;
  studentName: string;
  rollNo: string;
  status: HomeworkSubmissionStatus;
  submittedOn: string;
  marks: number | null;
  remark: string;
}

/** API returns enum as string (JsonStringEnumConverter). */
export function normalizeHomeworkStatus(value: unknown): HomeworkSubmissionStatus {
  if (typeof value === 'number') {
    if (value === HomeworkSubmissionStatus.Submitted) return HomeworkSubmissionStatus.Submitted;
    if (value === HomeworkSubmissionStatus.Late) return HomeworkSubmissionStatus.Late;
    return HomeworkSubmissionStatus.Pending;
  }
  const label = String(value ?? '').toLowerCase();
  if (label === 'submitted' || label === '1') return HomeworkSubmissionStatus.Submitted;
  if (label === 'late' || label === '2') return HomeworkSubmissionStatus.Late;
  return HomeworkSubmissionStatus.Pending;
}

export function homeworkStatusBadgeClass(status: string): string {
  switch (status) {
    case 'overdue':
      return 'b-red';
    case 'today':
      return 'b-amber';
    case 'done':
      return 'b-green';
    default:
      return 'b-green';
  }
}

export function homeworkSubjectBadgeClass(name: string): string {
  const n = (name || '').toLowerCase();
  if (n.includes('math')) return 'b-blue';
  if (n.includes('science')) return 'b-purple';
  if (n.includes('english')) return 'b-green';
  if (n.includes('hindi')) return 'b-amber';
  return 'b-gray';
}

export function homeworkPriorityDotClass(priority: HomeworkPriority): string {
  if (priority === HomeworkPriority.High) return 'pd-high';
  if (priority === HomeworkPriority.Low) return 'pd-low';
  return 'pd-med';
}

/** Normalize API payload to an array (direct array or wrapped in items/data/value). */
export function asHomeworkArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj['items'])) return obj['items'] as T[];
    if (Array.isArray(obj['data'])) return obj['data'] as T[];
    if (Array.isArray(obj['value'])) return obj['value'] as T[];
  }
  return [];
}
