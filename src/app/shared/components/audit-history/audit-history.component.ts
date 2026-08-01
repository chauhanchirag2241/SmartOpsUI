import {
  Component, Input, OnInit, OnChanges,
  SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef, inject
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuditLogItem, AuditLogPagedResponse, FieldChange } from '../../../core/models/audit-history.model';
import { AcademicYearService } from '../../../core/services/academic-year.service';
import { ClassService } from '../../../core/services/class.service';
import { ShiftService } from '../../../core/services/shift.service';
import { SubjectService } from '../../../core/services/subject.service';
import { AuditHistoryEntityType, AuditService } from '../../../core/services/audit.service';
import { formatAuditFieldValue } from '../../utils/audit-field-format.util';

export type { AuditHistoryEntityType };

const GUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Friendly labels for common FK / technical field names in history. */
const FIELD_LABELS: Record<string, string> = {
  academicyearid: 'Academic Year',
  classgroupid: 'Class Group',
  shiftid: 'Shift',
  subjectid: 'Subject',
  classid: 'Class / Section',
  studentid: 'Student',
  employeeid: 'Employee',
  userid: 'User',
  periodtemplateid: 'Period Template',
};

/** Never show these fields in history (branch is fixed / not user-editable here). */
const HIDDEN_HISTORY_FIELDS = new Set(['branchid', 'branch']);


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

  /** GUID (lowercase) → display name for branches, classes, shifts, subjects, years, etc. */
  private idLookup: Record<string, string> = {};

  private readonly auditService = inject(AuditService);
  private readonly academicYearService = inject(AcademicYearService);
  private readonly classService = inject(ClassService);
  private readonly shiftService = inject(ShiftService);
  private readonly subjectService = inject(SubjectService);
  private readonly cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.loadLookups();
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
    const key = this.normalizeFieldName(field);
    if (FIELD_LABELS[key]) {
      return FIELD_LABELS[key];
    }

    // PascalCase / camelCase → words, then drop trailing " Id"
    return field
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .trim()
      .replace(/\s+[Ii][Dd]$/, '')
      .replace(/\s+/g, ' ');
  }

  /** Changes shown in the table (Branch and other hidden fields excluded). */
  visibleChanges(changes: FieldChange[]): FieldChange[] {
    return (changes ?? []).filter((c) => !this.isHiddenHistoryField(c.field));
  }

  isHiddenHistoryField(field: string): boolean {
    return HIDDEN_HISTORY_FIELDS.has(this.normalizeFieldName(field));
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  formatValue(field: string, val: string | null): string {
    return formatAuditFieldValue(this.entityType, field, val, this.idLookup);
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

  private loadLookups(): void {
    forkJoin({
      years: this.academicYearService.getAcademicYears(1, 1000, '', null, null, 'All').pipe(
        catchError(() => of({ items: [] })),
      ),
      classGroups: this.classService.getClassGroups(1, 1000, '', null, null, 'All').pipe(
        catchError(() => of({ items: [] })),
      ),
      classes: this.classService.getClassDropdown(undefined, 'section').pipe(
        catchError(() => of([])),
      ),
      classGroupsDropdown: this.classService.getClassDropdown(undefined, 'group').pipe(
        catchError(() => of([])),
      ),
      shifts: this.shiftService.getShiftDropdown().pipe(
        catchError(() => of([])),
      ),
      subjects: this.subjectService.getSubjectDropdown().pipe(
        catchError(() => of([])),
      ),
    }).subscribe({
      next: (res) => {
        const map: Record<string, string> = {};

        const put = (id: unknown, name: unknown) => {
          const key = String(id ?? '').trim().toLowerCase();
          const label = String(name ?? '').trim();
          if (key && label && GUID_RE.test(key)) {
            map[key] = label;
          }
        };

        for (const row of (res.years as any)?.items ?? []) {
          put(row.id, row.title);
        }
        for (const row of (res.classGroups as any)?.items ?? []) {
          put(row.id, row.className);
        }
        for (const row of res.classGroupsDropdown ?? []) {
          put(row.id, row.name ?? row.className);
        }
        for (const row of res.classes ?? []) {
          put(row.id, row.name ?? row.className);
        }
        for (const row of res.shifts ?? []) {
          put(row.id, row.name);
        }
        for (const row of res.subjects ?? []) {
          put(row.id, row.name ?? row.subjectName);
        }

        this.idLookup = map;
        this.cdr.markForCheck();
      },
      error: () => {
        this.idLookup = {};
      },
    });
  }

  private normalizeFieldName(field: string): string {
    return field.replace(/\s/g, '').toLowerCase();
  }
}
