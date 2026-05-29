import {
  Component, Input, OnInit, OnChanges,
  SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { AuditLogItem, AuditLogPagedResponse, FieldChange } from '../../../core/models/audit-history.model';
import { AcademicYearService } from '../../../core/services/academic-year.service';
import { AuditHistoryEntityType, AuditService } from '../../../core/services/audit.service';
import { formatAuditFieldValue } from '../../utils/audit-field-format.util';

export type { AuditHistoryEntityType };

@Component({
  selector: 'app-audit-history',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule, DatePipe],
  templateUrl: './audit-history.component.html',
  styleUrl: './audit-history.component.css',
})
export class AuditHistoryComponent implements OnInit, OnChanges {
  @Input() entityId!: string;
  @Input() entityType: AuditHistoryEntityType = 'student';

  logs: AuditLogItem[] = [];
  totalCount = 0;
  pageIndex = 1;
  pageSize = 20;
  loading = false;
  error = false;
  expandedRows = new Set<string>();
  private academicYearLookup: Record<string, string> = {};

  constructor(
    private auditService: AuditService,
    private academicYearService: AcademicYearService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadAcademicYearLookup();
    this.load();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['entityId'] && !changes['entityId'].firstChange) {
      this.pageIndex = 1;
      this.load();
    }
  }

  load(): void {
    if (!this.entityId) return;
    this.loading = true;
    this.error = false;
    this.cdr.markForCheck();

    this.auditService
      .getEntityHistory(this.entityType, this.entityId, this.pageIndex, this.pageSize)
      .subscribe({
      next: (res: AuditLogPagedResponse) => {
        this.logs = res.items ?? [];
        this.totalCount = res.totalCount ?? 0;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = true;
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount / this.pageSize));
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages) return;
    this.pageIndex = p;
    this.load();
  }

  toggleRow(id: string): void {
    if (this.expandedRows.has(id)) {
      this.expandedRows.delete(id);
    } else {
      this.expandedRows.add(id);
    }
    this.cdr.markForCheck();
  }

  isExpanded(id: string): boolean {
    return this.expandedRows.has(id);
  }

  actionClass(action: string): string {
    switch (action?.toLowerCase()) {
      case 'created': return 'action-created';
      case 'updated': return 'action-updated';
      case 'deleted': return 'action-deleted';
      default: return 'action-updated';
    }
  }

  actionIcon(action: string): string {
    switch (action?.toLowerCase()) {
      case 'created': return 'add_circle';
      case 'updated': return 'edit';
      case 'deleted': return 'delete';
      default: return 'edit';
    }
  }

  formatFieldName(field: string): string {
    if (this.normalizeFieldName(field) === 'academicyearid') {
      return 'Academic Year';
    }

    // Convert PascalCase to readable: "FirstName" → "First Name"
    return field.replace(/([A-Z])/g, ' $1').trim();
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  formatValue(field: string, val: string | null): string {
    const lookup = this.normalizeFieldName(field) === 'academicyearid' ? this.academicYearLookup : {};
    return formatAuditFieldValue(this.entityType, field, val, lookup);
  }

  relativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  trackLog(_: number, log: AuditLogItem): string {
    return log.id;
  }

  trackChange(_: number, change: FieldChange): string {
    return change.field;
  }

  private loadAcademicYearLookup(): void {
    this.academicYearService.getAcademicYears(1, 1000, '', null, null, 'All').subscribe({
      next: (res: any) => {
        const rows = (res?.items ?? []) as Record<string, unknown>[];
        this.academicYearLookup = rows.reduce<Record<string, string>>((acc, row) => {
          const id = String(row['id'] ?? '').toLowerCase();
          const title = String(row['title'] ?? '').trim();
          if (id && title) {
            acc[id] = title;
          }
          return acc;
        }, {});
        this.cdr.markForCheck();
      },
      error: () => {
        this.academicYearLookup = {};
      },
    });
  }

  private normalizeFieldName(field: string): string {
    return field.replace(/\s/g, '').toLowerCase();
  }
}
