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
import { FrontOfficeService } from '../../../../core/services/front-office.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ActionButtonComponent } from '../../../../shared/components/action-button/action-button.component';
import { SELECT_PLACEHOLDER } from '../../../../shared/constants/form.constants';
import { DynamicFieldComponent } from '../../../../shared/form-controls/dynamic-field/dynamic-field.component';
import { FormFieldConfig } from '../../../../shared/interfaces/form-field-config';
import { getUserFacingApiError } from '../../../../shared/utils/api-error.util';

@Component({
  selector: 'app-add-visitor',
  standalone: true,
  host: { class: 'form-page-shell' },
  imports: [ReactiveFormsModule, MatIconModule, DynamicFieldComponent, ActionButtonComponent],
  template: `
    <div class="topbar">
      <app-action-button type="back" style="order: 2; margin-left: auto" (action)="cancel.emit()" />
      <div class="page-title">{{ pageTitle }}</div>
    </div>
    <form [formGroup]="form" (ngSubmit)="save()">
      <div class="card">
        <div class="card-title"><mat-icon>badge</mat-icon> Visitor details</div>
        <div class="grid2">
          <app-dynamic-field [config]="configs['name']" [group]="form" />
          <app-dynamic-field [config]="configs['phone']" [group]="form" />
          <app-dynamic-field [config]="configs['idCardType']" [group]="form" />
          <app-dynamic-field [config]="configs['idCardNumber']" [group]="form" />
          <app-dynamic-field [config]="configs['purposeId']" [group]="form" />
          <app-dynamic-field [config]="configs['meetingWith']" [group]="form" />
          <app-dynamic-field [config]="configs['inTime']" [group]="form" />
          <app-dynamic-field [config]="configs['outTime']" [group]="form" />
          <app-dynamic-field [config]="configs['note']" [group]="form" [full]="true" />
        </div>
      </div>
      @if (mode !== 'view') {
        <div class="footer-actions">
          <app-action-button type="cancel" (action)="cancel.emit()" />
          <app-action-button
            type="save"
            [disabled]="isSaving"
            [label]="isSaving ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Add visitor'"
            (action)="save()"
          />
        </div>
      }
    </form>
  `,
})
export class AddVisitorComponent implements OnInit {
  @Input() mode: 'add' | 'edit' | 'view' = 'add';
  @Input() visitorId?: string;
  @Output() cancel = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly api = inject(FrontOfficeService);
  private readonly notify = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);

  form!: FormGroup;
  isSaving = false;

  readonly configs: Record<string, FormFieldConfig> = {
    name: {
      type: 'input',
      controlName: 'name',
      label: 'Visitor name',
      placeholder: 'Full name',
      validations: [{ name: 'required', validator: Validators.required, message: 'Name is required' }],
    },
    phone: {
      type: 'input',
      controlName: 'phone',
      label: 'Phone',
      inputType: 'tel',
      placeholder: 'Mobile number',
    },
    idCardType: {
      type: 'select',
      controlName: 'idCardType',
      label: 'ID card type',
      placeholder: SELECT_PLACEHOLDER,
      options: [
        { label: 'Aadhaar', value: 'Aadhaar' },
        { label: 'PAN', value: 'PAN' },
        { label: 'Voter ID', value: 'Voter ID' },
        { label: 'Driving License', value: 'Driving License' },
        { label: 'Passport', value: 'Passport' },
      ],
    },
    idCardNumber: {
      type: 'input',
      controlName: 'idCardNumber',
      label: 'ID card number',
      placeholder: 'Document number',
    },
    purposeId: {
      type: 'select',
      controlName: 'purposeId',
      label: 'Purpose',
      placeholder: SELECT_PLACEHOLDER,
      options: [],
      validations: [{ name: 'required', validator: Validators.required, message: 'Purpose is required' }],
    },
    meetingWith: {
      type: 'input',
      controlName: 'meetingWith',
      label: 'Meeting with',
      placeholder: 'Person or office',
    },
    inTime: {
      type: 'datetime',
      controlName: 'inTime',
      label: 'In time',
      placeholder: 'Select date and time',
      validations: [{ name: 'required', validator: Validators.required, message: 'In time is required' }],
    },
    outTime: {
      type: 'datetime',
      controlName: 'outTime',
      label: 'Out time',
      placeholder: 'Select date and time',
    },
    note: {
      type: 'textarea',
      controlName: 'note',
      label: 'Note',
      placeholder: 'Optional notes',
    },
  };

  get pageTitle(): string {
    if (this.mode === 'edit') return 'Edit visitor';
    if (this.mode === 'view') return 'View visitor';
    return 'Add visitor';
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', Validators.required],
      phone: [''],
      idCardType: [null],
      idCardNumber: [''],
      purposeId: [null, Validators.required],
      meetingWith: [''],
      inTime: [new Date(), Validators.required],
      outTime: [null],
      note: [''],
    });

    this.api.getVisitorPurposes({ activeFilter: 'Active' }).subscribe({
      next: (list) => {
        this.configs['purposeId'].options = list.map((p) => ({
          label: p.name,
          value: p.id,
        }));
        this.cdr.markForCheck();
      },
      error: (err) => this.notify.error(getUserFacingApiError(err, 'Failed to load purposes')),
    });

    if (this.mode === 'view') this.form.disable();
    if (this.visitorId && this.mode !== 'add') {
      this.api.getVisitor(this.visitorId).subscribe({
        next: (row) => {
          this.form.patchValue({
            name: row.name,
            phone: row.phone ?? '',
            idCardType: row.idCardType ?? null,
            idCardNumber: row.idCardNumber ?? '',
            purposeId: row.purposeId,
            meetingWith: row.meetingWith ?? '',
            inTime: row.inTime ? new Date(row.inTime) : null,
            outTime: row.outTime ? new Date(row.outTime) : null,
            note: row.note ?? '',
          });
          this.cdr.markForCheck();
        },
        error: (err) => this.notify.error(getUserFacingApiError(err, 'Failed to load visitor')),
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
    const body: Record<string, unknown> = {
      name: String(raw.name ?? '').trim(),
      phone: raw.phone || null,
      idCardType: raw.idCardType || null,
      idCardNumber: raw.idCardNumber || null,
      purposeId: raw.purposeId,
      meetingWith: raw.meetingWith || null,
      inTime: this.toIso(raw.inTime),
      outTime: raw.outTime ? this.toIso(raw.outTime) : null,
      note: raw.note || null,
    };

    const req =
      this.mode === 'edit' && this.visitorId
        ? this.api.updateVisitor(this.visitorId, body)
        : this.api.createVisitor(body);

    req.pipe(finalize(() => (this.isSaving = false))).subscribe({
      next: () => {
        this.notify.success(this.mode === 'edit' ? 'Visitor updated' : 'Visitor added');
        this.saved.emit();
      },
      error: (err) => this.notify.error(getUserFacingApiError(err, 'Save failed')),
    });
  }

  private toIso(value: unknown): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
}
