export interface FieldChange {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface AuditLogItem {
  id: string;
  action: 'Created' | 'Updated' | 'Deleted' | string;
  changedBy: string;
  changedByName: string;
  changedOn: string;
  changes: FieldChange[];
}

export interface AuditLogPagedResponse {
  items: AuditLogItem[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
}
