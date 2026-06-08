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
import { ActionDetailView, mapActionDetail } from './my-actions.shared';

@Component({
  selector: 'app-my-action-detail',
  standalone: true,
  host: { class: 'my-action-detail-page form-page-shell' },
  imports: [CommonModule, FormsModule, MatIconModule, ActionButtonComponent],
  templateUrl: './my-action-detail.component.html',
  styleUrls: ['../leave/workflow-page.shared.css', './my-action-detail.component.css'],
})
export class MyActionDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly actionsService = inject(MyActionsService);
  private readonly notify = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);

  detail: ActionDetailView | null = null;
  loading = true;
  completing = false;
  remark = '';
  responseText = '';
  formAnswers: Record<string, string | number> = {};
  formOptionAnswers: Record<string, string[]> = {};
  readonly WorkflowItemType = WorkflowItemType;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.goBack();
      return;
    }

    this.actionsService.getById(id).subscribe({
      next: (raw) => {
        this.detail = mapActionDetail(raw);
        if (!this.detail) {
          this.notify.error('Could not read action details');
          this.goBack();
          return;
        }
        this.formAnswers = {};
        this.formOptionAnswers = {};
        for (const q of this.formQuestions) {
          this.formAnswers[q.id] = '';
          this.formOptionAnswers[q.id] = [];
        }
        this.loading = false;
        refreshUi(this.cdr);
      },
      error: (err) => {
        this.notify.error(typeof err?.error === 'string' ? err.error : 'Failed to load action');
        this.loading = false;
        refreshUi(this.cdr);
        this.goBack();
      },
    });
  }

  get isLeaveApproval(): boolean {
    return this.detail?.itemType === WorkflowItemType.LeaveApproval;
  }

  get isNoticeResponse(): boolean {
    return this.detail?.itemType === WorkflowItemType.NoticeResponse;
  }

  get isFormFill(): boolean {
    return this.detail?.itemType === WorkflowItemType.FormFill;
  }

  get isNoticeAction(): boolean {
    return this.isNoticeResponse || this.isFormFill;
  }

  get noticeRequiresResponse(): boolean {
    return this.detail?.notice?.requiresResponse ?? true;
  }

  get formQuestions() {
    return this.detail?.notice?.content?.questions ?? [];
  }

  questionOptions(q: { options?: { id: string; label: string }[] }): { id: string; label: string }[] {
    return q.options ?? [];
  }

  isSelectedOption(questionId: string, optionId: string): boolean {
    return (this.formOptionAnswers[questionId] ?? []).includes(optionId);
  }

  isSingleSelected(questionId: string, optionId: string): boolean {
    return (this.formOptionAnswers[questionId] ?? [])[0] === optionId;
  }

  toggleOptionAnswer(questionId: string, optionId: string, checked: boolean): void {
    const list = new Set(this.formOptionAnswers[questionId] ?? []);
    if (checked) list.add(optionId);
    else list.delete(optionId);
    this.formOptionAnswers[questionId] = [...list];
    refreshUi(this.cdr);
  }

  setSingleOptionAnswer(questionId: string, optionId: string): void {
    this.formOptionAnswers[questionId] = optionId ? [optionId] : [];
    refreshUi(this.cdr);
  }

  goBack(): void {
    void this.router.navigate(['/my-actions']);
  }

  complete(actionCode: string): void {
    const id = this.detail?.id;
    if (!id) return;

    if (actionCode === 'SubmitForm') {
      const missing = this.formQuestions.filter((q) => q.required && this.isAnswerEmpty(q));
      if (missing.length) {
        this.notify.error('Please answer all required questions');
        return;
      }
    }

    this.completing = true;
    const payload =
      actionCode === 'SubmitForm'
        ? JSON.stringify(
            this.formQuestions.map((q) => {
              const optionIds = this.formOptionAnswers[q.id] ?? [];
              const options = q.options ?? [];
              const selectedLabels = optionIds
                .map((id) => options.find((o) => o.id === id)?.label)
                .filter((x): x is string => !!x);

              return {
                questionId: q.id,
                label: q.label,
                type: q.type,
                answerText: this.formatAnswerText(q.id),
                selectedOptionIds: optionIds,
                selectedOptionLabels: selectedLabels,
                isCorrect:
                  (q.type === 'mcq_single' || q.type === 'mcq_multi') && q.hasAnswerKey
                    ? this.isCorrectMcq(q.correctOptionIds ?? [], optionIds)
                    : null,
              };
            }),
          )
        : this.responseText || null;

    const body: CompleteMyActionRequest = {
      actionCode,
      comment: this.remark || null,
      payload,
    };

    this.actionsService.complete(id, body).subscribe({
      next: () => {
        if (actionCode === 'SubmitForm') {
          const scored = this.formQuestions.filter((q) => (q.type === 'mcq_single' || q.type === 'mcq_multi') && q.hasAnswerKey);
          if (scored.length) {
            const correct = scored.filter((q) =>
              this.isCorrectMcq(q.correctOptionIds ?? [], this.formOptionAnswers[q.id] ?? []),
            ).length;
            this.notify.success(`Submitted. Score: ${correct}/${scored.length}`);
          } else {
            this.notify.success('Form submitted');
          }
        } else {
        this.notify.success('Action completed');
        }
        this.completing = false;
        this.goBack();
      },
      error: (err) => {
        this.notify.error(typeof err?.error === 'string' ? err.error : 'Action failed');
        this.completing = false;
        refreshUi(this.cdr);
      },
    });
  }

  private isAnswerEmpty(q: { id: string; type: string }): boolean {
    if (q.type === 'mcq_single' || q.type === 'mcq_multi' || q.type === 'poll') {
      return !(this.formOptionAnswers[q.id]?.length ?? 0);
    }
    const raw = this.formAnswers[q.id];
    if (raw == null) return true;
    return String(raw).trim() === '';
  }

  private formatAnswerText(questionId: string): string {
    const raw = this.formAnswers[questionId];
    if (raw == null) return '';
    return String(raw);
  }

  private isCorrectMcq(correctIds: string[], selectedIds: string[]): boolean {
    const a = new Set((correctIds ?? []).filter(Boolean));
    const b = new Set((selectedIds ?? []).filter(Boolean));
    if (a.size !== b.size) return false;
    for (const id of a) {
      if (!b.has(id)) return false;
    }
    return true;
  }
}
