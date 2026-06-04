import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MyActionsService } from '../../core/services/my-actions.service';
import { NotificationService } from '../../core/services/notification.service';
import { refreshUi } from '../../core/utils/ui-refresh.util';
import { ListPageHeaderComponent } from '../../shared/components/list-page-header/list-page-header.component';
import { PageToolbarComponent } from '../../shared/components/page-toolbar/page-toolbar.component';

interface ActionRow {
  id: string;
  itemType: number;
  itemTypeLabel: string;
  title: string;
  summary?: string;
  dueDate?: string;
  createdOn: string;
}

interface ActionStats {
  totalPending: number;
  leaveApprovals: number;
  noticeResponses: number;
  formFills: number;
}

@Component({
  selector: 'app-my-actions',
  standalone: true,
  imports: [CommonModule, MatIconModule, ListPageHeaderComponent, PageToolbarComponent],
  templateUrl: './my-actions.component.html',
  styleUrl: '../leave/workflow-page.shared.css',
})
export class MyActionsComponent implements OnInit {
  private readonly actionsService = inject(MyActionsService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  items: ActionRow[] = [];
  stats: ActionStats = { totalPending: 0, leaveApprovals: 0, noticeResponses: 0, formFills: 0 };
  typeFilter: '' | '1' | '2' = '';
  loading = false;

  ngOnInit(): void {
    this.loadStats();
    this.load();
  }

  loadStats(): void {
    this.actionsService.getStats().subscribe({
      next: (s) => {
        const raw = s as ActionStats;
        this.stats = {
          totalPending: raw.totalPending ?? 0,
          leaveApprovals: raw.leaveApprovals ?? 0,
          noticeResponses: raw.noticeResponses ?? 0,
          formFills: raw.formFills ?? 0,
        };
        refreshUi(this.cdr);
      },
    });
  }

  load(): void {
    this.loading = true;
    refreshUi(this.cdr);
    const itemType = this.typeFilter ? Number(this.typeFilter) : undefined;
    this.actionsService.getList(itemType).subscribe({
      next: (data) => {
        this.items = (Array.isArray(data) ? data : []) as ActionRow[];
        this.loading = false;
        refreshUi(this.cdr);
      },
      error: (err) => {
        this.notify.error(err?.error ?? 'Failed to load actions');
        this.loading = false;
        refreshUi(this.cdr);
      },
    });
  }

  openAction(id: string): void {
    void this.router.navigate(['/my-actions', id]);
  }
}
