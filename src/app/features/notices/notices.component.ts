import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { MenuCodes } from '../../core/constants/menu-codes';
import { AcademicYearContextService } from '../../core/services/academic-year-context.service';
import { NoticeListItem, NoticesService } from '../../core/services/notices.service';
import { NotificationService } from '../../core/services/notification.service';
import { PermissionService } from '../../core/services/permission.service';
import { refreshUi } from '../../core/utils/ui-refresh.util';
import { applyModuleTablePermissions } from '../../core/utils/permission-ui.util';
import { canEditInScope } from '../leave/workflow-page.util';
import { ScopeReadonlyLockComponent } from '../../shared/components/scope-readonly-lock/scope-readonly-lock.component';
import { SmartDataTableComponent } from '../../shared/components/smart-data-table';
import type { DataTableAction, DataTableConfig, DataTableFilter } from '../../shared/components/smart-data-table';
import { AddNoticeComponent } from './add-notice.component';
import { NoticeResponsesComponent } from './notice-responses.component';
import { NoticeViewComponent } from './notice-view.component';

@Component({
  selector: 'app-notices',
  standalone: true,
  imports: [
    SmartDataTableComponent,
    ScopeReadonlyLockComponent,
    AddNoticeComponent,
    NoticeResponsesComponent,
    NoticeViewComponent,
  ],
  templateUrl: './notices.component.html',
  styleUrl: './notices.component.css',
})
export class NoticesComponent implements OnInit {
  private readonly noticesService = inject(NoticesService);
  private readonly notify = inject(NotificationService);
  private readonly ayContext = inject(AcademicYearContextService);
  private readonly permissionService = inject(PermissionService);
  private readonly cdr = inject(ChangeDetectorRef);

  tableConfig!: DataTableConfig;
  tableRows: Record<string, unknown>[] = [];
  currentFilter = 'All';
  showAddForm = false;
  showResponses = false;
  showView = false;
  responsesNoticeId = '';
  responsesNoticeTitle = '';
  viewNoticeId = '';
  viewNoticeActive = true;
  editNoticeId: string | null = null;
  formOpenKey = 0;

  private readonly baseTableConfig: DataTableConfig = {
    header: {
      title: 'Notices',
      subtitle: 'Create notices, forms, documents, and fee reminders for targeted audiences',
      showAddButton: true,
      addButtonText: 'New notice',
      addButtonIcon: 'campaign',
      addButtonClass: 'btn-primary',
    },
    columns: [
      { key: 'title', label: 'Title', sortable: true },
      {
        key: 'contentTypeLabel',
        label: 'Type',
        sortable: true,
        cellType: 'badge',
        badgeMap: {
          Announcement: { cssClass: 'b-blue', label: 'Notice' },
          Form: { cssClass: 'b-gray', label: 'Form' },
          FeeReminder: { cssClass: 'b-amber', label: 'Fee' },
          Document: { cssClass: 'b-green', label: 'Document' },
        },
      },
      { key: 'targetTypeLabel', label: 'Audience', sortable: true },
      {
        key: 'statusLabel',
        label: 'Status',
        sortable: true,
        cellType: 'badge',
        badgeMap: {
          Draft: { cssClass: 'b-blue', label: 'Draft' },
          Published: { cssClass: 'b-green', label: 'Published' },
          Closed: { cssClass: 'b-gray', label: 'Closed' },
        },
      },
      { key: 'responseCount', label: 'Responses', sortable: true },
    ],
    filters: [
      { label: 'All', icon: 'list', value: 'All', filterFn: (row) => row['isActive'] !== false },
      {
        label: 'Draft',
        icon: 'edit_note',
        value: 'Draft',
        filterFn: (row) => row['statusLabel'] === 'Draft' && row['isActive'] !== false,
      },
      {
        label: 'Published',
        icon: 'publish',
        value: 'Published',
        filterFn: (row) => row['statusLabel'] === 'Published' && row['isActive'] !== false,
      },
      {
        label: 'Inactive',
        icon: 'visibility_off',
        value: 'Inactive',
        filterFn: (row) => row['isActive'] === false,
      },
    ],
    actions: [
      { label: 'View', icon: 'visibility', iconColor: '#639922' },
      { label: 'View responses', icon: 'forum', iconColor: '#639922' },
      { label: 'Publish', icon: 'publish', iconColor: '#639922' },
      { label: 'Edit', icon: 'edit', iconColor: '#639922' },
      { label: 'Delete', icon: 'delete', iconColor: '#c0392b' },
    ],
    actionVisibleFn: (action, row) => {
      if (action.label === 'View') return true;
      if (row['isActive'] === false) return false;
      if (action.label === 'Publish') return row['statusLabel'] === 'Draft';
      if (action.label === 'Edit') return row['statusLabel'] === 'Draft';
      if (action.label === 'Delete') {
        return row['statusLabel'] === 'Draft' || row['statusLabel'] === 'Published';
      }
      if (action.label === 'View responses') return Number(row['responseCount'] ?? 0) > 0;
      return true;
    },
    searchPlaceholder: 'Search by title or audience…',
    searchKeys: ['title', 'targetTypeLabel', 'contentTypeLabel'],
    itemLabel: 'notices',
    defaultPageSize: 10,
    selectable: false,
    showExport: false,
  };

  ngOnInit(): void {
    this.tableConfig = applyModuleTablePermissions(
      this.baseTableConfig,
      this.permissionService,
      MenuCodes.Notices,
      this.ayContext.isReadOnlyScope(),
    );
    this.load();
  }

  load(): void {
    this.noticesService.getList().subscribe({
      next: (data) => {
        this.tableRows = (Array.isArray(data) ? data : []).map((n) => this.toRow(n as NoticeListItem));
        refreshUi(this.cdr);
      },
      error: (err) => {
        this.notify.error(typeof err?.error === 'string' ? err.error : 'Failed to load notices');
        refreshUi(this.cdr);
      },
    });
  }

  openCreate(): void {
    this.editNoticeId = null;
    this.formOpenKey++;
    this.showAddForm = true;
    refreshUi(this.cdr);
  }

  closeAddForm(): void {
    this.showAddForm = false;
    this.editNoticeId = null;
    refreshUi(this.cdr);
  }

  onNoticeSaved(): void {
    this.showAddForm = false;
    this.editNoticeId = null;
    this.load();
  }

  onFilterChanged(filter: DataTableFilter | null): void {
    this.currentFilter = filter?.value ?? 'All';
  }

  onAction(event: { action: DataTableAction; row: Record<string, unknown> }): void {
    const id = String(event.row['id'] ?? '');
    if (!id) return;

    if (event.action.label === 'View') {
      this.viewNoticeId = id;
      this.viewNoticeActive = event.row['isActive'] !== false;
      this.showView = true;
      refreshUi(this.cdr);
      return;
    }

    if (event.action.label === 'View responses') {
      this.responsesNoticeId = id;
      this.responsesNoticeTitle = String(event.row['title'] ?? 'Notice');
      this.showResponses = true;
      refreshUi(this.cdr);
      return;
    }

    if (!canEditInScope(this.ayContext, this.permissionService, MenuCodes.Notices)) return;

    if (event.action.label === 'Edit') {
      this.editNoticeId = id;
      this.formOpenKey++;
      this.showAddForm = true;
      refreshUi(this.cdr);
      return;
    }

    if (event.action.label === 'Delete') {
      if (!confirm('Delete this notice? Recipients will no longer see it.')) return;
      this.noticesService.delete(id).subscribe({
        next: () => {
          this.notify.success('Notice deleted');
          this.load();
        },
        error: (err) => {
          this.notify.error(typeof err?.error === 'string' ? err.error : 'Delete failed');
        },
      });
      return;
    }

    if (event.action.label !== 'Publish') return;
    if (event.row['statusLabel'] !== 'Draft') {
      this.notify.error('Only draft notices can be published');
      return;
    }

    this.noticesService.publish(id).subscribe({
      next: () => {
        this.notify.success('Notice published');
        this.load();
      },
      error: (err) => {
        this.notify.error(typeof err?.error === 'string' ? err.error : 'Publish failed');
        refreshUi(this.cdr);
      },
    });
  }

  closeResponses(): void {
    this.showResponses = false;
    this.responsesNoticeId = '';
    this.responsesNoticeTitle = '';
    refreshUi(this.cdr);
  }

  closeView(): void {
    this.showView = false;
    this.viewNoticeId = '';
    this.viewNoticeActive = true;
    refreshUi(this.cdr);
  }

  private toRow(n: NoticeListItem): Record<string, unknown> {
    const item = n as NoticeListItem & { Id?: string };
    return {
      id: item.id ?? item.Id ?? '',
      title: n.title,
      contentTypeLabel: n.contentTypeLabel ?? 'Announcement',
      targetTypeLabel: n.targetTypeLabel,
      statusLabel: n.statusLabel,
      responseCount: n.responseCount ?? 0,
      publishedOn: n.publishedOn ?? '',
      isActive: n.isActive ?? true,
    };
  }
}
