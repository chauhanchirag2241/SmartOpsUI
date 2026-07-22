import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { finalize } from 'rxjs';
import { FrontOfficeService, PhoneLogDto } from '../../../../core/services/front-office.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ActionButtonComponent } from '../../../../shared/components/action-button/action-button.component';
import { PageChromeDirective } from '../../../../shared/directives/page-chrome.directive';
import { DynamicFieldComponent } from '../../../../shared/form-controls/dynamic-field/dynamic-field.component';
import { FormFieldConfig } from '../../../../shared/interfaces/form-field-config';
import { getUserFacingApiError } from '../../../../shared/utils/api-error.util';
import { parseCallType } from '../../../../shared/utils/front-office-enum.util';

@Component({
  selector: 'app-add-phone-log',
  standalone: true,
  host: { class: 'form-page-shell' },
  imports: [ReactiveFormsModule, MatIconModule, DynamicFieldComponent, ActionButtonComponent, PageChromeDirective],
  template: `
    <span [appPageChrome]="pageTitle" [pageChromeShowBack]="true" (pageChromeBack)="cancel.emit()"></span>
    <form [formGroup]="form" (ngSubmit)="save()">
      <div class="card">
        <div class="card-title"><mat-icon>phone</mat-icon> Call details</div>
        <div class="grid2">
          <app-dynamic-field [config]="configs['callerName']" [group]="form" />
          <app-dynamic-field [config]="configs['phone']" [group]="form" />
          <app-dynamic-field [config]="configs['callType']" [group]="form" />
          <app-dynamic-field [config]="configs['callDate']" [group]="form" />
          <app-dynamic-field [config]="configs['duration']" [group]="form" />
          <app-dynamic-field [config]="configs['nextFollowUpDate']" [group]="form" />
          <app-dynamic-field [config]="configs['description']" [group]="form" [full]="true" />
          <app-dynamic-field [config]="configs['note']" [group]="form" [full]="true" />
        </div>
      </div>
      @if (mode !== 'view') {
        <div class="footer-actions">
          <app-action-button type="cancel" (action)="cancel.emit()" />
          <app-action-button
            type="save"
            [disabled]="isSaving"
            [label]="isSaving ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Add phone log'"
            (action)="save()"
          />
        </div>
      }
    </form>
  `,
})
export class AddPhoneLogComponent implements OnInit {
  @Input() mode: 'add' | 'edit' | 'view' = 'add';
  @Input() logId?: string;
  @Output() cancel = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly api = inject(FrontOfficeService);
  private readonly notify = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);

  form!: FormGroup;
  isSaving = false;

  readonly configs: Record<string, FormFieldConfig> = {
    callerName: {
      type: 'input',
      controlName: 'callerName',
      label: 'Caller name',
      placeholder: 'Name of caller',
      validations: [
        { name: 'required', validator: Validators.required, message: 'Caller name is required' },
      ],
    },
    phone: {
      type: 'input',
      controlName: 'phone',
      label: 'Mobile number',
      inputType: 'tel',
      placeholder: 'Phone number',
      validations: [
        { name: 'required', validator: Validators.required, message: 'Mobile number is required' },
      ],
    },
    callType: {
      type: 'badges',
      controlName: 'callType',
      label: 'Call type',
      options: [
        { label: 'Incoming', value: 0 },
        { label: 'Outgoing', value: 1 },
      ],
      validations: [{ name: 'required', validator: Validators.required, message: 'Call type is required' }],
    },
    callDate: {
      type: 'datepicker',
      controlName: 'callDate',
      label: 'Call date',
      validations: [{ name: 'required', validator: Validators.required, message: 'Call date is required' }],
    },
    duration: {
      type: 'input',
      controlName: 'duration',
      label: 'Duration',
      placeholder: 'e.g. 5 min',
    },
    description: {
      type: 'textarea',
      controlName: 'description',
      label: 'Description',
      placeholder: 'Call summary',
      validations: [
        { name: 'required', validator: Validators.required, message: 'Description is required' },
      ],
    },
    nextFollowUpDate: {
      type: 'datepicker',
      controlName: 'nextFollowUpDate',
      label: 'Next follow-up date',
    },
    note: {
      type: 'textarea',
      controlName: 'note',
      label: 'Note',
      placeholder: 'Optional notes',
    },
  };

  get pageTitle(): string {
    if (this.mode === 'edit') return 'Edit phone log';
    if (this.mode === 'view') return 'View phone log';
    return 'Add phone log';
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      callerName: ['', Validators.required],
      phone: ['', Validators.required],
      callType: [0, Validators.required],
      callDate: [new Date(), Validators.required],
      duration: [''],
      description: ['', Validators.required],
      nextFollowUpDate: [null],
      note: [''],
    });

    if (this.mode === 'view') this.form.disable();
    if (this.logId && this.mode !== 'add') {
      this.api.getPhoneLog(this.logId).subscribe({
        next: (row) => {
          this.form.patchValue({
            callerName: row.callerName,
            phone: row.phone ?? '',
            callType: parseCallType(row.callType),
            callDate: row.callDate ? new Date(row.callDate) : null,
            duration: row.duration ?? '',
            description: row.description,
            nextFollowUpDate: row.nextFollowUpDate ? new Date(row.nextFollowUpDate) : null,
            note: row.note ?? '',
          });
          this.cdr.markForCheck();
        },
        error: (err) => this.notify.error(getUserFacingApiError(err, 'Failed to load phone log')),
      });
    }
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSaving = true;
    const raw = this.form.getRawValue();
    const body = {
      callerName: String(raw.callerName ?? '').trim(),
      phone: String(raw.phone ?? '').trim(),
      callType: parseCallType(raw.callType),
      callDate: this.toDateOnly(raw.callDate),
      duration: raw.duration || null,
      description: String(raw.description ?? '').trim(),
      nextFollowUpDate: this.toDateOnly(raw.nextFollowUpDate),
      note: raw.note || null,
    };

    const payload = body as Partial<PhoneLogDto>;
    const req =
      this.mode === 'edit' && this.logId
        ? this.api.updatePhoneLog(this.logId, payload)
        : this.api.createPhoneLog(payload);

    req.pipe(finalize(() => (this.isSaving = false))).subscribe({
      next: () => {
        this.notify.success(this.mode === 'edit' ? 'Phone log updated' : 'Phone log added');
        this.saved.emit();
      },
      error: (err) => this.notify.error(getUserFacingApiError(err, 'Save failed')),
    });
  }

  private toDateOnly(value: unknown): string | null {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
