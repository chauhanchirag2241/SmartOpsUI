import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import {
  CompleteMyActionRequest,
  MyActionsService,
  WorkflowItemType,
} from '../../core/services/my-actions.service';
import { NotificationService } from '../../core/services/notification.service';
import { refreshUi } from '../../core/utils/ui-refresh.util';
import { ActionButtonComponent } from '../../shared/components/action-button/action-button.component';

interface ActionDetail {
  id: string;
  itemType: number;
  itemTypeLabel: string;
  title: string;
  summary?: string;
  leaveRequest?: {
    studentName?: string;
    teacherName?: string;
    fromDate: string;
    toDate: string;
    reason?: string;
    statusLabel: string;
  };
  notice?: { title: string; body: string; requiresResponse: boolean };
}

@Component({
  selector: 'app-my-action-detail',
  standalone: true,
  host: { class: 'my-action-detail-page form-page-shell' },
  imports: [CommonModule, FormsModule, MatIconModule, ActionButtonComponent],
  templateUrl: './my-action-detail.component.html',
})
export class MyActionDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly actionsService = inject(MyActionsService);
  private readonly notify = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);

  detail: ActionDetail | null = null;
  loading = true;
  completing = false;
  remark = '';
  responseText = '';
  WorkflowItemType = WorkflowItemType;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.goBack();
      return;
    }
    this.actionsService.getById(id).subscribe({
      next: (d) => {
        this.detail = d as ActionDetail;
        this.loading = false;
        refreshUi(this.cdr);
      },
      error: (err) => {
        this.notify.error(err?.error ?? 'Failed to load action');
        this.loading = false;
        refreshUi(this.cdr);
        this.goBack();
      },
    });
  }

  goBack(): void {
    void this.router.navigate(['/my-actions']);
  }

  complete(actionCode: string): void {
    const id = this.detail?.id;
    if (!id) return;
    this.completing = true;
    const body: CompleteMyActionRequest = {
      actionCode,
      comment: this.remark || null,
      payload: this.responseText || null,
    };
    this.actionsService.complete(id, body).subscribe({
      next: () => {
        this.notify.success('Action completed');
        this.completing = false;
        this.goBack();
      },
      error: (err) => {
        this.notify.error(err?.error ?? 'Action failed');
        this.completing = false;
        refreshUi(this.cdr);
      },
    });
  }
}
