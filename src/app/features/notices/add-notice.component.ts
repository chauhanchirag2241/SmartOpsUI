import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AcademicYearContextService } from '../../core/services/academic-year-context.service';
import { ClassService } from '../../core/services/class.service';
import { CreateNoticeRequest, NoticeTargetType, NoticesService } from '../../core/services/notices.service';
import { NotificationService } from '../../core/services/notification.service';
import { ActionButtonComponent } from '../../shared/components/action-button/action-button.component';
import { ScopeReadonlyLockComponent } from '../../shared/components/scope-readonly-lock/scope-readonly-lock.component';
import { refreshUi } from '../../core/utils/ui-refresh.util';
import { isReadOnlyYear } from '../leave/workflow-page.util';

@Component({
  selector: 'app-add-notice',
  standalone: true,
  host: { class: 'add-notice-page form-page-shell' },
  imports: [CommonModule, FormsModule, MatIconModule, ActionButtonComponent, ScopeReadonlyLockComponent],
  templateUrl: './add-notice.component.html',
})
export class AddNoticeComponent implements OnInit {
  private readonly noticesService = inject(NoticesService);
  private readonly classService = inject(ClassService);
  private readonly notify = inject(NotificationService);
  private readonly ayContext = inject(AcademicYearContextService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Output() cancel = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  classes: { id: string; name: string }[] = [];
  saving = false;
  form: CreateNoticeRequest = this.emptyForm();
  NoticeTargetType = NoticeTargetType;

  get readOnly(): boolean {
    return isReadOnlyYear(this.ayContext);
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
  }

  saveDraft(): void {
    if (this.readOnly) return;
    if (!this.form.title?.trim()) {
      this.notify.error('Title is required');
      return;
    }
    this.saving = true;
    refreshUi(this.cdr);
    this.noticesService.create(this.form).subscribe({
      next: () => {
        this.notify.success('Notice saved');
        this.saving = false;
        refreshUi(this.cdr);
        this.saved.emit();
      },
      error: (err) => {
        this.notify.error(err?.error ?? 'Save failed');
        this.saving = false;
        refreshUi(this.cdr);
      },
    });
  }

  private emptyForm(): CreateNoticeRequest {
    return {
      title: '',
      body: '',
      requiresResponse: false,
      responseDeadline: null,
      targetType: NoticeTargetType.AllStaff,
      targetRefId: null,
    };
  }
}
