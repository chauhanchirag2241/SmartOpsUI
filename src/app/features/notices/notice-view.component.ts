import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ClassService } from '../../core/services/class.service';
import {
  NoticeContentType,
  NoticeDetail,
  NoticeFormQuestion,
  NoticeTargetType,
  NoticesService,
} from '../../core/services/notices.service';
import { NotificationService } from '../../core/services/notification.service';
import { ActionButtonComponent } from '../../shared/components/action-button/action-button.component';
import { refreshUi } from '../../core/utils/ui-refresh.util';

@Component({
  selector: 'app-notice-view',
  standalone: true,
  host: { class: 'notice-view-page form-page-shell' },
  imports: [CommonModule, MatIconModule, ActionButtonComponent],
  templateUrl: './notice-view.component.html',
  styleUrl: './notice-view.component.css',
})
export class NoticeViewComponent implements OnInit {
  private readonly noticesService = inject(NoticesService);
  private readonly classService = inject(ClassService);
  private readonly notify = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) noticeId!: string;
  @Input() isActive = true;
  @Output() close = new EventEmitter<void>();

  loading = true;
  detail: NoticeDetail | null = null;
  classNames: string[] = [];
  recipientNames: string[] = [];

  readonly NoticeContentType = NoticeContentType;
  readonly NoticeTargetType = NoticeTargetType;

  ngOnInit(): void {
    this.load();
  }

  get isFormType(): boolean {
    return this.detail?.contentType === NoticeContentType.Form;
  }

  get isDocumentType(): boolean {
    return this.detail?.contentType === NoticeContentType.Document;
  }

  get isFeeType(): boolean {
    return this.detail?.contentType === NoticeContentType.FeeReminder;
  }

  get questions(): NoticeFormQuestion[] {
    return this.detail?.content?.questions ?? [];
  }

  get contentTypeDisplay(): string {
    const label = this.detail?.contentTypeLabel ?? '';
    const map: Record<string, string> = {
      Announcement: 'Notice',
      Form: 'Form',
      FeeReminder: 'Fee reminder',
      Document: 'Document',
    };
    return map[label] ?? (label || '—');
  }

  get audienceDisplay(): string {
    if (!this.detail) return '—';
    const base = this.detail.targetTypeLabel ?? '—';
    if (this.classNames.length) {
      return `${base} — ${this.classNames.join(', ')}`;
    }
    if (this.recipientNames.length) {
      return `${base} — ${this.recipientNames.join(', ')}`;
    }
    return base;
  }

  questionTypeLabel(type: string): string {
    const map: Record<string, string> = {
      text: 'Text',
      yesno: 'Yes / No',
      number: 'Number',
      mcq_single: 'MCQ (single)',
      mcq_multi: 'MCQ (multi)',
      poll: 'Poll',
    };
    return map[type] ?? type;
  }

  correctOptionLabels(q: NoticeFormQuestion): string {
    const ids = new Set(q.correctOptionIds ?? []);
    return (q.options ?? [])
      .filter((o) => ids.has(o.id))
      .map((o) => o.label)
      .join(', ');
  }

  private load(): void {
    this.loading = true;
    refreshUi(this.cdr);

    this.noticesService.getById(this.noticeId).subscribe({
      next: (detail) => {
        this.detail = detail;
        this.resolveAudienceNames(detail);
        this.loading = false;
        refreshUi(this.cdr);
      },
      error: () => {
        this.loading = false;
        this.notify.error('Failed to load notice');
        refreshUi(this.cdr);
        this.close.emit();
      },
    });
  }

  private resolveAudienceNames(detail: NoticeDetail): void {
    const ids = detail.content?.targetRecipientIds ?? [];
    if (!ids.length && detail.targetRefId) {
      ids.push(detail.targetRefId);
    }

    if (detail.targetType === NoticeTargetType.ClassParents) {
      this.classService.getClassDropdown().subscribe({
        next: (list) => {
          const map = new Map(
            (list ?? []).map((c: { id: string; name?: string; className?: string }) => [
              c.id,
              c.name ?? c.className ?? c.id,
            ]),
          );
          this.classNames = ids.map((id) => map.get(id) ?? id).filter(Boolean);
          refreshUi(this.cdr);
        },
      });
      return;
    }

    if (
      detail.targetType === NoticeTargetType.SingleTeacher ||
      detail.targetType === NoticeTargetType.SingleParent ||
      detail.targetType === NoticeTargetType.SingleUser
    ) {
      this.noticesService.getAudiencePreview(detail.targetType).subscribe({
        next: (preview) => {
          const map = new Map((preview?.options ?? []).map((o) => [o.id, o.name]));
          this.recipientNames = ids.map((id) => map.get(id) ?? id).filter(Boolean);
          refreshUi(this.cdr);
        },
      });
    }
  }
}
