import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MenuCodes } from '../../core/constants/menu-codes';
import { AcademicYearContextService } from '../../core/services/academic-year-context.service';
import { NoticesService } from '../../core/services/notices.service';
import { NotificationService } from '../../core/services/notification.service';
import { PermissionService } from '../../core/services/permission.service';
import { noticeStatusBadgeClass } from '../leave/leave.shared';
import { refreshUi } from '../../core/utils/ui-refresh.util';
import { canAddInScope, canEditInScope } from '../leave/workflow-page.util';
import { ListPageHeaderComponent } from '../../shared/components/list-page-header/list-page-header.component';
import { ScopeReadonlyLockComponent } from '../../shared/components/scope-readonly-lock/scope-readonly-lock.component';
import { AddNoticeComponent } from './add-notice.component';

interface NoticeRow {
  id: string;
  title: string;
  statusLabel: string;
  targetTypeLabel: string;
  requiresResponse: boolean;
  responseCount: number;
  publishedOn?: string;
}

@Component({
  selector: 'app-notices',
  standalone: true,
  imports: [CommonModule, MatIconModule, ListPageHeaderComponent, ScopeReadonlyLockComponent, AddNoticeComponent],
  templateUrl: './notices.component.html',
  styleUrl: '../leave/workflow-page.shared.css',
})
export class NoticesComponent implements OnInit {
  private readonly noticesService = inject(NoticesService);
  private readonly notify = inject(NotificationService);
  private readonly ayContext = inject(AcademicYearContextService);
  private readonly permissionService = inject(PermissionService);
  private readonly cdr = inject(ChangeDetectorRef);

  items: NoticeRow[] = [];
  loading = false;
  showAddForm = false;

  get canWrite(): boolean {
    return canAddInScope(this.ayContext, this.permissionService, MenuCodes.Notices);
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    refreshUi(this.cdr);
    this.noticesService.getList().subscribe({
      next: (data) => {
        this.items = (Array.isArray(data) ? data : []) as NoticeRow[];
        this.loading = false;
        refreshUi(this.cdr);
      },
      error: (err) => {
        this.notify.error(err?.error ?? 'Failed to load notices');
        this.loading = false;
        refreshUi(this.cdr);
      },
    });
  }

  openCreate(): void {
    if (!this.canWrite) return;
    this.showAddForm = true;
    refreshUi(this.cdr);
  }

  closeAddForm(): void {
    this.showAddForm = false;
    refreshUi(this.cdr);
  }

  onNoticeSaved(): void {
    this.showAddForm = false;
    this.load();
  }

  publish(id: string): void {
    if (!canEditInScope(this.ayContext, this.permissionService, MenuCodes.Notices)) return;
    this.noticesService.publish(id).subscribe({
      next: () => {
        this.notify.success('Notice published');
        this.load();
      },
      error: (err) => {
        this.notify.error(err?.error ?? 'Publish failed');
        refreshUi(this.cdr);
      },
    });
  }

  statusBadge(label: string): string {
    return noticeStatusBadgeClass(label);
  }
}
