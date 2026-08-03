export interface LeaveListItem {
  id: string;
  requestType: string;
  requestTypeLabel: string;
  employeeId?: string | null;
  employeeName?: string | null;
  /** @deprecated use employeeName */
  teacherName?: string | null;
  studentId?: string | null;
  studentName?: string | null;
  className?: string | null;
  fromDate: string;
  toDate: string;
  dayCount: number;
  leaveTypeLabel?: string | null;
  leaveTypeId?: string | null;
  status: string;
  statusLabel: string;
  createdOn: string;
}

export function leaveStatusBadgeClass(status: string): string {
  const s = String(status ?? '').toLowerCase();
  if (s === 'approved' || s === '2') return 'b-green';
  if (s === 'rejected' || s === '3') return 'b-red';
  if (s === 'submitted' || s === '1') return 'b-amber';
  if (s === 'cancelled' || s === '4') return 'b-gray';
  return 'b-blue';
}

export function asLeaveArray(data: unknown): LeaveListItem[] {
  return Array.isArray(data) ? (data as LeaveListItem[]) : [];
}

export function leaveItemsToTableRows(items: LeaveListItem[]): Record<string, unknown>[] {
  return items.map((row) => ({
    id: row.id,
    employeeName: row.employeeName ?? row.teacherName ?? '—',
    fromDate: row.fromDate,
    toDate: row.toDate,
    dayCount: row.dayCount,
    leaveTypeLabel: row.leaveTypeLabel ?? '—',
    status: row.status,
    statusLabel: row.statusLabel,
    createdOn: row.createdOn,
  }));
}

export interface LeaveApprover {
  id: string;
  name: string;
}

export function asApproverArray(data: unknown): LeaveApprover[] {
  if (!Array.isArray(data)) return [];
  return data.map((raw) => {
    const r = raw as Record<string, unknown>;
    return {
      id: String(r['id'] ?? r['Id'] ?? ''),
      name: String(r['name'] ?? r['Name'] ?? '—'),
    };
  });
}

/** Labels for LeaveLedgerTxnType enum values. */
export function ledgerTxnTypeLabel(txnType: number | string | null | undefined): string {
  const n = typeof txnType === 'string' ? Number(txnType) : txnType;
  switch (n) {
    case 1:
      return 'Accrual';
    case 2:
      return 'Usage';
    case 3:
      return 'Reverse';
    case 4:
      return 'Manual adjust';
    case 5:
      return 'Carry forward';
    case 6:
      return 'Lapse';
    default:
      return txnType != null && String(txnType).trim() ? String(txnType) : '—';
  }
}

export function noticeStatusBadgeClass(statusLabel: string): string {
  const s = String(statusLabel ?? '').toLowerCase();
  if (s === 'published') return 'b-green';
  if (s === 'draft') return 'b-gray';
  if (s === 'closed' || s === 'archived') return 'b-red';
  return 'b-blue';
}
