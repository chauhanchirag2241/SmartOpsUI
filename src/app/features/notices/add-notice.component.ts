import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AcademicYearContextService } from '../../core/services/academic-year-context.service';
import { ClassService } from '../../core/services/class.service';
import {
  CreateNoticeRequest,
  NoticeAudienceOption,
  NoticeContentType,
  NoticeTargetType,
  NoticeFormQuestion,
  NoticeQuestionOption,
  NoticesService,
  NoticeDetail,
} from '../../core/services/notices.service';
import { NotificationService } from '../../core/services/notification.service';
import { ActionButtonComponent } from '../../shared/components/action-button/action-button.component';
import { MultiSelectChipsComponent } from '../../shared/components/multi-select-chips/multi-select-chips.component';
import { ScopeReadonlyLockComponent } from '../../shared/components/scope-readonly-lock/scope-readonly-lock.component';
import { MappingOption } from '../../shared/mapping/mapping.types';
import { refreshUi } from '../../core/utils/ui-refresh.util';
import { isReadOnlyYear } from '../leave/workflow-page.util';

@Component({
  selector: 'app-add-notice',
  standalone: true,
  host: { class: 'add-notice-page form-page-shell' },
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    ActionButtonComponent,
    MultiSelectChipsComponent,
    ScopeReadonlyLockComponent,
  ],
  templateUrl: './add-notice.component.html',
  styleUrl: './add-notice.component.css',
})
export class AddNoticeComponent implements OnInit {
  private readonly noticesService = inject(NoticesService);
  private readonly classService = inject(ClassService);
  private readonly notify = inject(NotificationService);
  private readonly ayContext = inject(AcademicYearContextService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() set editId(value: string | null) {
    const next = value?.trim() || null;
    this._editId = next;
    if (next) {
      this.loadNotice(next);
    }
  }
  get editId(): string | null {
    return this._editId;
  }
  private _editId: string | null = null;

  @Output() cancel = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  get isEditing(): boolean {
    return !!this._editId;
  }

  classes: { id: string; name: string }[] = [];
  audienceOptions: NoticeAudienceOption[] = [];
  audienceCount = 0;
  loadingAudience = false;
  loadingNotice = false;
  saving = false;
  form: CreateNoticeRequest = this.emptyForm();

  readonly NoticeTargetType = NoticeTargetType;
  readonly NoticeContentType = NoticeContentType;

  readonly contentTypeOptions = [
    { value: NoticeContentType.Announcement, label: 'Notice / announcement', icon: 'campaign' },
    { value: NoticeContentType.Form, label: 'Form (Q&A)', icon: 'quiz' },
    { value: NoticeContentType.Document, label: 'Document', icon: 'description' },
    { value: NoticeContentType.FeeReminder, label: 'Fee reminder', icon: 'payments' },
  ];

  readonly targetTypeOptions = [
    { value: NoticeTargetType.AllStaff, label: 'All employees / staff' },
    { value: NoticeTargetType.SingleTeacher, label: 'Particular employee(s)' },
    { value: NoticeTargetType.ClassParents, label: 'Class-wise parents' },
    { value: NoticeTargetType.SingleParent, label: 'Particular parent(s)' },
    { value: NoticeTargetType.SingleUser, label: 'Particular user(s)' },
    { value: NoticeTargetType.PendingFeeParents, label: 'Parents with pending fees' },
  ];

  get recipientChipOptions(): MappingOption[] {
    return this.audienceOptions.map((o) => ({
      id: o.id,
      name: o.subtitle ? `${o.name} — ${o.subtitle}` : o.name,
    }));
  }

  get classChipOptions(): MappingOption[] {
    return this.classes.map((c) => ({ id: c.id, name: c.name }));
  }

  get selectedRecipientIds(): string[] {
    if (this.needsClassPicker) return [];
    return this.form.content?.targetRecipientIds ?? [];
  }

  set selectedRecipientIds(ids: string[]) {
    this.form.content = { ...this.form.content, targetRecipientIds: ids };
    this.form.targetRefId = ids[0] ?? null;
    this.audienceCount = ids.length;
    refreshUi(this.cdr);
  }

  get selectedClassIds(): string[] {
    if (!this.needsClassPicker) return [];
    return this.form.content?.targetRecipientIds ?? [];
  }

  set selectedClassIds(ids: string[]) {
    this.form.content = { ...this.form.content, targetRecipientIds: ids };
    this.form.targetRefId = ids[0] ?? null;
    refreshUi(this.cdr);
    this.refreshAudiencePreview();
  }

  get readOnly(): boolean {
    return isReadOnlyYear(this.ayContext);
  }

  get needsRecipientPicker(): boolean {
    return [
      NoticeTargetType.SingleTeacher,
      NoticeTargetType.SingleParent,
      NoticeTargetType.SingleUser,
    ].includes(this.form.targetType);
  }

  get needsClassPicker(): boolean {
    return this.form.targetType === NoticeTargetType.ClassParents;
  }

  get isFormType(): boolean {
    return this.form.contentType === NoticeContentType.Form;
  }

  get isDocumentType(): boolean {
    return this.form.contentType === NoticeContentType.Document;
  }

  get isFeeType(): boolean {
    return this.form.contentType === NoticeContentType.FeeReminder;
  }

  ngOnInit(): void {
    this.classService.getClassDropdown().subscribe({
      next: (list) => {
        this.classes = (list ?? []).map((c: { id: string; name?: string; className?: string }) => ({
          id: c.id,
          name: c.name ?? c.className ?? c.id,
        }));
        refreshUi(this.cdr);
      },
    });
    if (!this._editId) {
      this.refreshAudiencePreview();
    }
  }

  private loadNotice(id: string): void {
    this.loadingNotice = true;
    refreshUi(this.cdr);

    this.noticesService.getById(id).subscribe({
      next: (detail: NoticeDetail) => {
        this.form = this.mapDetailToForm(detail);
        this.loadingNotice = false;
        refreshUi(this.cdr);
        this.refreshAudiencePreview();
      },
      error: () => {
        this.loadingNotice = false;
        this.notify.error('Failed to load notice');
        refreshUi(this.cdr);
        this.cancel.emit();
      },
    });
  }

  private mapDetailToForm(detail: NoticeDetail): CreateNoticeRequest {
    const recipientIds = detail.content?.targetRecipientIds?.length
      ? [...detail.content.targetRecipientIds]
      : detail.targetRefId
        ? [detail.targetRefId]
        : [];

    return {
      title: detail.title,
      body: detail.body ?? '',
      requiresResponse: detail.requiresResponse,
      responseDeadline: detail.responseDeadline ?? null,
      targetType: detail.targetType,
      targetRefId: recipientIds[0] ?? detail.targetRefId ?? null,
      contentType: detail.contentType,
      content: {
        questions: detail.content?.questions ?? [],
        documentName: detail.content?.documentName ?? '',
        documentUrl: detail.content?.documentUrl ?? '',
        feeMessageTemplate: detail.content?.feeMessageTemplate ?? '',
        targetRecipientIds: recipientIds,
      },
    };
  }

  onContentTypeChange(): void {
    if (this.isFeeType) {
      this.form.targetType = NoticeTargetType.PendingFeeParents;
      this.form.targetRefId = null;
      this.form.requiresResponse = false;
      if (!this.form.content?.feeMessageTemplate) {
        this.form.content = {
          ...this.form.content,
          feeMessageTemplate:
            'Dear {{parentName}}, pending fee of ₹{{pendingAmount}} for {{students}}. Please pay at earliest.',
        };
      }
    } else if (this.isFormType) {
      this.form.requiresResponse = true;
      if (!this.form.content?.questions?.length) {
        this.addQuestion();
      }
    } else if (this.isDocumentType) {
      this.form.content = { ...this.form.content, documentName: '', documentUrl: '' };
    }
    this.refreshAudiencePreview();
  }

  onTargetTypeChange(): void {
    this.form.targetRefId = null;
    this.form.content = { ...this.form.content, targetRecipientIds: [] };
    this.refreshAudiencePreview();
  }

  refreshAudiencePreview(): void {
    this.loadingAudience = true;
    refreshUi(this.cdr);

    const classIds = this.needsClassPicker ? this.selectedClassIds : undefined;
    const refId = this.needsRecipientPicker ? null : this.needsClassPicker ? null : this.form.targetRefId;
    this.noticesService
      .getAudiencePreview(this.form.targetType, refId ?? null, classIds)
      .subscribe({
      next: (preview) => {
        this.audienceOptions = preview?.options ?? [];
        this.audienceCount = this.needsRecipientPicker
          ? this.selectedRecipientIds.length
          : (preview?.estimatedRecipients ?? 0);
        this.loadingAudience = false;
        refreshUi(this.cdr);
      },
      error: () => {
        this.audienceOptions = [];
        this.audienceCount = 0;
        this.loadingAudience = false;
        refreshUi(this.cdr);
      },
    });
  }

  addQuestion(): void {
    const questions = [...(this.form.content?.questions ?? [])];
    const q: NoticeFormQuestion = {
      id: crypto.randomUUID().replace(/-/g, ''),
      label: '',
      type: 'text',
      required: true,
      options: [],
      hasAnswerKey: false,
      correctOptionIds: [],
    };
    questions.push(q);
    this.form.content = { ...this.form.content, questions };
    refreshUi(this.cdr);
  }

  onQuestionTypeChange(index: number): void {
    const questions = [...(this.form.content?.questions ?? [])];
    const q = questions[index];
    if (!q) return;

    const needsOptions = q.type === 'mcq_single' || q.type === 'mcq_multi' || q.type === 'poll';
    if (needsOptions) {
      const options = (q.options ?? []).length ? [...(q.options ?? [])] : [this.newOption('Option 1'), this.newOption('Option 2')];
      questions[index] = {
        ...q,
        options,
        hasAnswerKey: q.type === 'poll' ? false : (q.hasAnswerKey ?? false),
        correctOptionIds: q.type === 'poll' ? [] : (q.correctOptionIds ?? []),
      };
    } else {
      questions[index] = { ...q, options: [], hasAnswerKey: false, correctOptionIds: [] };
    }

    this.form.content = { ...this.form.content, questions };
    refreshUi(this.cdr);
  }

  addOption(qIndex: number): void {
    const questions = [...(this.form.content?.questions ?? [])];
    const q = questions[qIndex];
    if (!q) return;
    const options = [...(q.options ?? [])];
    options.push(this.newOption(`Option ${options.length + 1}`));
    questions[qIndex] = { ...q, options };
    this.form.content = { ...this.form.content, questions };
    refreshUi(this.cdr);
  }

  removeOption(qIndex: number, optId: string): void {
    const questions = [...(this.form.content?.questions ?? [])];
    const q = questions[qIndex];
    if (!q) return;
    const options = (q.options ?? []).filter((o) => o.id !== optId);
    const correct = (q.correctOptionIds ?? []).filter((id) => id !== optId);
    questions[qIndex] = { ...q, options, correctOptionIds: correct };
    this.form.content = { ...this.form.content, questions };
    refreshUi(this.cdr);
  }

  toggleCorrect(qIndex: number, optId: string): void {
    const questions = [...(this.form.content?.questions ?? [])];
    const q = questions[qIndex];
    if (!q) return;
    const correct = new Set(q.correctOptionIds ?? []);
    const isMulti = q.type === 'mcq_multi';
    if (!isMulti) {
      correct.clear();
      correct.add(optId);
    } else {
      if (correct.has(optId)) correct.delete(optId);
      else correct.add(optId);
    }
    questions[qIndex] = { ...q, correctOptionIds: [...correct] };
    this.form.content = { ...this.form.content, questions };
    refreshUi(this.cdr);
  }

  private newOption(label: string): NoticeQuestionOption {
    return { id: crypto.randomUUID().replace(/-/g, ''), label };
  }

  removeQuestion(index: number): void {
    const questions = [...(this.form.content?.questions ?? [])];
    questions.splice(index, 1);
    this.form.content = { ...this.form.content, questions };
    refreshUi(this.cdr);
  }

  saveDraft(): void {
    if (this.readOnly) return;

    const err = this.validate();
    if (err) {
      this.notify.error(err);
      return;
    }

    this.saving = true;
    refreshUi(this.cdr);

    const payload = this.buildPayload();
    const request$ = this.editId
      ? this.noticesService.update(this.editId, payload)
      : this.noticesService.create(payload);

    request$.subscribe({
      next: () => {
        this.notify.success(this.editId ? 'Notice updated' : 'Notice saved as draft');
        this.saving = false;
        refreshUi(this.cdr);
        this.saved.emit();
      },
      error: (err) => {
        this.notify.error(typeof err?.error === 'string' ? err.error : 'Save failed');
        this.saving = false;
        refreshUi(this.cdr);
      },
    });
  }

  private validate(): string | null {
    if (!this.form.title?.trim()) return 'Title is required';

    if (this.isFormType) {
      const questions = this.form.content?.questions ?? [];
      if (!questions.length) return 'Add at least one form question';
      if (questions.some((q) => !q.label?.trim())) return 'Every question needs a label';
      for (const q of questions) {
        const needsOptions = q.type === 'mcq_single' || q.type === 'mcq_multi' || q.type === 'poll';
        if (needsOptions) {
          const opts = q.options ?? [];
          if (opts.length < 2) return 'MCQ / Poll needs at least 2 options';
          if (opts.some((o) => !o.label?.trim())) return 'Every option needs a label';
          if ((q.type === 'mcq_single' || q.type === 'mcq_multi') && q.hasAnswerKey) {
            const correct = q.correctOptionIds ?? [];
            if (!correct.length) return 'Select correct answer option(s) for MCQ';
          }
        }
      }
    } else if (!this.isDocumentType && !this.form.body?.trim()) {
      return 'Body is required';
    }

    if (this.isDocumentType) {
      if (!this.form.content?.documentName?.trim()) return 'Document name is required';
      if (!this.form.content?.documentUrl?.trim()) return 'Document link is required';
    }

    if (this.isFeeType && !this.form.content?.feeMessageTemplate?.trim()) {
      return 'Fee message template is required';
    }

    if (this.needsClassPicker && !this.selectedClassIds.length) return 'Select at least one class';
    if (this.needsRecipientPicker && !this.selectedRecipientIds.length) return 'Select at least one recipient';

    return null;
  }

  private buildPayload(): CreateNoticeRequest {
    const recipientIds = this.needsClassPicker ? this.selectedClassIds : this.selectedRecipientIds;
    return {
      title: this.form.title.trim(),
      body: this.form.body?.trim() ?? '',
      requiresResponse: this.isFormType ? true : this.form.requiresResponse,
      responseDeadline: this.form.requiresResponse || this.isFormType ? this.form.responseDeadline : null,
      targetType: this.form.targetType,
      targetRefId: recipientIds[0] ?? this.form.targetRefId ?? null,
      contentType: this.form.contentType,
      content: {
        ...this.form.content,
        targetRecipientIds: recipientIds,
      },
    };
  }

  private emptyForm(): CreateNoticeRequest {
    return {
      title: '',
      body: '',
      requiresResponse: true,
      responseDeadline: null,
      targetType: NoticeTargetType.AllStaff,
      targetRefId: null,
      contentType: NoticeContentType.Announcement,
      content: {
        questions: [],
        documentName: '',
        documentUrl: '',
        feeMessageTemplate: '',
        targetRecipientIds: [],
      },
    };
  }
}
