import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import type { NoticeDetail, NoticeFormQuestion, NoticeResponseItem } from '../../core/services/notices.service';
import { NoticesService } from '../../core/services/notices.service';
import { NotificationService } from '../../core/services/notification.service';
import { ActionButtonComponent } from '../../shared/components/action-button/action-button.component';
import { refreshUi } from '../../core/utils/ui-refresh.util';

interface ResponseRow {
  id: string;
  respondent: string;
  respondedOn: string;
  responseText: string;
  isFormResponse: boolean;
}

@Component({
  selector: 'app-notice-responses',
  standalone: true,
  host: { class: 'notice-responses-page form-page-shell' },
  imports: [CommonModule, MatIconModule, ActionButtonComponent],
  templateUrl: './notice-responses.component.html',
  styleUrl: './notice-responses.component.css',
})
export class NoticeResponsesComponent implements OnInit {
  private readonly noticesService = inject(NoticesService);
  private readonly notify = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) noticeId!: string;
  @Input({ required: true }) noticeTitle!: string;
  @Output() close = new EventEmitter<void>();

  loading = true;
  rows: ResponseRow[] = [];
  noticeDetail: NoticeDetail | null = null;
  pollStats: Array<{
    questionId: string;
    questionLabel: string;
    total: number;
    options: Array<{ id: string; label: string; count: number; percent: number }>;
  }> = [];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.noticeDetail = null;
    this.pollStats = [];
    refreshUi(this.cdr);

    this.noticesService.getById(this.noticeId).subscribe({
      next: (detail) => {
        this.noticeDetail = detail;
        this.noticesService.getResponses(this.noticeId).subscribe({
          next: (data) => {
            const list = Array.isArray(data) ? data : [];
            this.rows = list.map((item) => this.toRow(item));
            this.pollStats = this.buildPollStats(detail, list);
            this.loading = false;
            refreshUi(this.cdr);
          },
          error: (err) => {
            this.notify.error(typeof err?.error === 'string' ? err.error : 'Failed to load responses');
            this.loading = false;
            refreshUi(this.cdr);
          },
        });
      },
      error: () => {
        // still allow plain response list load
        this.noticesService.getResponses(this.noticeId).subscribe({
          next: (data) => {
            const list = Array.isArray(data) ? data : [];
            this.rows = list.map((item) => this.toRow(item));
            this.loading = false;
            refreshUi(this.cdr);
          },
          error: (err) => {
            this.notify.error(typeof err?.error === 'string' ? err.error : 'Failed to load responses');
            this.loading = false;
            refreshUi(this.cdr);
          },
        });
      },
    });
  }

  private toRow(item: NoticeResponseItem): ResponseRow {
    const parsed = this.formatResponseBody(item.responseBody);
    return {
      id: item.id,
      respondent: item.respondentName?.trim() || item.respondentUserId || 'Unknown',
      respondedOn: this.formatDate(item.respondedOn),
      responseText: parsed.text,
      isFormResponse: parsed.isForm,
    };
  }

  private formatResponseBody(body: string): { text: string; isForm: boolean } {
    const raw = body?.trim() ?? '';
    if (!raw.startsWith('[') && !raw.startsWith('{')) {
      return { text: raw, isForm: false };
    }

    try {
      const data = JSON.parse(raw) as unknown;
      if (!Array.isArray(data)) {
        return { text: raw, isForm: false };
      }

      const lines = data
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null;
          const record = entry as Record<string, unknown>;
          const label = String(record['label'] ?? record['questionId'] ?? 'Answer').trim();
          const optionLabels = record['selectedOptionLabels'];
          const answerText = String(record['answerText'] ?? record['answer'] ?? '').trim();
          const selected =
            Array.isArray(optionLabels) && optionLabels.length
              ? optionLabels.map((x) => String(x)).join(', ')
              : '';
          const answer = selected || answerText;
          return `${label}: ${answer || '—'}`;
        })
        .filter((line): line is string => !!line);

      return { text: lines.join('\n'), isForm: true };
    } catch {
      return { text: raw, isForm: false };
    }
  }

  private formatDate(value: string): string {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }

  private buildPollStats(detail: NoticeDetail, responses: NoticeResponseItem[]) {
    const questions = (detail.content?.questions ?? []) as NoticeFormQuestion[];
    const pollQuestions = questions.filter((q) => q.type === 'poll' && (q.options?.length ?? 0) > 0);
    if (!pollQuestions.length) return [];

    const selectionsByQuestion: Record<string, string[]> = {};
    for (const q of pollQuestions) {
      selectionsByQuestion[q.id] = [];
    }

    for (const r of responses) {
      const raw = (r.responseBody ?? '').trim();
      if (!raw.startsWith('[')) continue;
      try {
        const arr = JSON.parse(raw) as unknown;
        if (!Array.isArray(arr)) continue;
        for (const entry of arr) {
          if (!entry || typeof entry !== 'object') continue;
          const rec = entry as Record<string, unknown>;
          const qid = String(rec['questionId'] ?? '').trim();
          if (!qid || !selectionsByQuestion[qid]) continue;
          const ids = rec['selectedOptionIds'];
          if (Array.isArray(ids) && ids.length) {
            selectionsByQuestion[qid].push(String(ids[0]));
          }
        }
      } catch {
        // ignore
      }
    }

    return pollQuestions.map((q) => {
      const picks = selectionsByQuestion[q.id] ?? [];
      const total = picks.length;
      const counts = new Map<string, number>();
      for (const id of picks) counts.set(id, (counts.get(id) ?? 0) + 1);
      const options = (q.options ?? []).map((o) => {
        const count = counts.get(o.id) ?? 0;
        const percent = total ? Math.round((count / total) * 1000) / 10 : 0;
        return { id: o.id, label: o.label, count, percent };
      });

      return { questionId: q.id, questionLabel: q.label, total, options };
    });
  }
}
