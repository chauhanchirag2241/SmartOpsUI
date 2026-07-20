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
import {
  AdmissionInquiryDto,
  FrontOfficeService,
} from '../../../../core/services/front-office.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ActionButtonComponent } from '../../../../shared/components/action-button/action-button.component';
import { PageChromeDirective } from '../../../../shared/directives/page-chrome.directive';
import { SELECT_PLACEHOLDER } from '../../../../shared/constants/form.constants';
import { StreamGroup, enumToOptions } from '../../../../shared/enums/field-options.enum';
import { DynamicFieldComponent } from '../../../../shared/form-controls/dynamic-field/dynamic-field.component';
import { FormFieldConfig } from '../../../../shared/interfaces/form-field-config';
import { streamGroupFromApiInt, streamGroupToApiInt } from '../../../../shared/utils/stream-group.util';
import { getUserFacingApiError } from '../../../../shared/utils/api-error.util';
import { parseInquiryStatus } from '../../../../shared/utils/front-office-enum.util';

const CLASS_OPTIONS = [
  'Nursery',
  'LKG',
  'UKG',
  'Class 1',
  'Class 2',
  'Class 3',
  'Class 4',
  'Class 5',
  'Class 6',
  'Class 7',
  'Class 8',
  'Class 9',
  'Class 10',
  'Class 11',
  'Class 12',
].map((label) => ({ label, value: label }));

@Component({
  selector: 'app-add-admission-inquiry',
  standalone: true,
  host: { class: 'form-page-shell' },
  imports: [ReactiveFormsModule, MatIconModule, DynamicFieldComponent, ActionButtonComponent, PageChromeDirective],
  template: `
    <div class="topbar">
      <app-action-button type="back" style="order: 2; margin-left: auto" (action)="cancel.emit()" />
      <span [appPageChrome]="pageTitle"></span>
    </div>
    <form [formGroup]="form" (ngSubmit)="save()">
      <div class="card">
        <div class="card-title"><mat-icon>person</mat-icon> Parent</div>
        <div class="grid2">
          <app-dynamic-field [config]="configs['parentName']" [group]="form" />
          <app-dynamic-field [config]="configs['phone']" [group]="form" />
          <app-dynamic-field [config]="configs['phoneWhatsappSame']" [group]="form" />
          @if (!form.get('phoneWhatsappSame')?.value) {
            <app-dynamic-field [config]="configs['whatsapp']" [group]="form" />
          }
          <app-dynamic-field [config]="configs['email']" [group]="form" />
          <app-dynamic-field [config]="configs['address']" [group]="form" [full]="true" />
        </div>
      </div>
      <div class="card">
        <div class="card-title"><mat-icon>school</mat-icon> Student</div>
        <div class="grid2">
          <app-dynamic-field [config]="configs['studentName']" [group]="form" />
          <app-dynamic-field [config]="configs['classLabel']" [group]="form" />
          <app-dynamic-field [config]="configs['streamGroup']" [group]="form" />
        </div>
      </div>
      <div class="card">
        <div class="card-title"><mat-icon>track_changes</mat-icon> Tracking</div>
        <div class="grid2">
          <app-dynamic-field [config]="configs['inquiryDate']" [group]="form" />
          <app-dynamic-field [config]="configs['nextFollowUpDate']" [group]="form" />
          <app-dynamic-field [config]="configs['assignedToEmployeeId']" [group]="form" />
          <app-dynamic-field [config]="configs['reference']" [group]="form" />
          <app-dynamic-field [config]="configs['status']" [group]="form" />
          <app-dynamic-field [config]="configs['autoFollowUp']" [group]="form" />
          <app-dynamic-field [config]="configs['description']" [group]="form" [full]="true" />
        </div>
      </div>
      @if (mode !== 'view') {
        <div class="footer-actions">
          <app-action-button type="cancel" (action)="cancel.emit()" />
          <app-action-button
            type="save"
            [disabled]="isSaving"
            [label]="isSaving ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Add inquiry'"
            (action)="save()"
          />
        </div>
      }
    </form>
  `,
})
export class AddAdmissionInquiryComponent implements OnInit {
  @Input() mode: 'add' | 'edit' | 'view' = 'add';
  @Input() inquiryId?: string;
  @Output() cancel = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly api = inject(FrontOfficeService);
  private readonly notify = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);

  form!: FormGroup;
  isSaving = false;

  readonly configs: Record<string, FormFieldConfig> = {
    parentName: {
      type: 'input',
      controlName: 'parentName',
      label: 'Parent name',
      placeholder: 'Parent / guardian name',
      validations: [
        { name: 'required', validator: Validators.required, message: 'Parent name is required' },
      ],
    },
    phone: {
      type: 'input',
      controlName: 'phone',
      label: 'Phone',
      inputType: 'tel',
      placeholder: 'Contact number',
    },
    phoneWhatsappSame: {
      type: 'checkbox',
      controlName: 'phoneWhatsappSame',
      label: 'Phone & WhatsApp same',
    },
    whatsapp: {
      type: 'input',
      controlName: 'whatsapp',
      label: 'WhatsApp number',
      inputType: 'tel',
      placeholder: 'WhatsApp number',
    },
    email: {
      type: 'input',
      controlName: 'email',
      label: 'Email',
      inputType: 'email',
      placeholder: 'Email address',
    },
    address: {
      type: 'textarea',
      controlName: 'address',
      label: 'Address',
      placeholder: 'Home address',
    },
    studentName: {
      type: 'input',
      controlName: 'studentName',
      label: 'Student name',
      placeholder: 'Prospective student',
      validations: [
        { name: 'required', validator: Validators.required, message: 'Student name is required' },
      ],
    },
    classLabel: {
      type: 'select',
      controlName: 'classLabel',
      label: 'Class',
      placeholder: SELECT_PLACEHOLDER,
      options: CLASS_OPTIONS,
    },
    streamGroup: {
      type: 'select',
      controlName: 'streamGroup',
      label: 'Stream / group',
      placeholder: SELECT_PLACEHOLDER,
      options: enumToOptions(StreamGroup),
    },
    inquiryDate: {
      type: 'datepicker',
      controlName: 'inquiryDate',
      label: 'Inquiry date',
      validations: [
        { name: 'required', validator: Validators.required, message: 'Inquiry date is required' },
      ],
    },
    nextFollowUpDate: {
      type: 'datepicker',
      controlName: 'nextFollowUpDate',
      label: 'Next follow-up date',
    },
    assignedToEmployeeId: {
      type: 'autocomplete',
      controlName: 'assignedToEmployeeId',
      label: 'Assigned to',
      placeholder: 'Search employee…',
      options: [],
    },
    reference: {
      type: 'input',
      controlName: 'reference',
      label: 'Reference',
      placeholder: 'How they heard about us',
    },
    status: {
      type: 'badges',
      controlName: 'status',
      label: 'Status',
      options: [
        { label: 'New', value: 0 },
        { label: 'Follow-up', value: 1 },
        { label: 'Visit Scheduled', value: 2 },
        { label: 'Admission Form', value: 3 },
        { label: 'Enrolled', value: 4 },
        { label: 'Not Interested', value: 5 },
      ],
    },
    description: {
      type: 'textarea',
      controlName: 'description',
      label: 'Description',
      placeholder: 'Notes about the inquiry',
    },
    autoFollowUp: {
      type: 'checkbox',
      controlName: 'autoFollowUp',
      label: 'Auto follow-up',
    },
  };

  get pageTitle(): string {
    if (this.mode === 'edit') return 'Edit admission inquiry';
    if (this.mode === 'view') return 'View admission inquiry';
    return 'Add admission inquiry';
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      parentName: ['', Validators.required],
      phone: [''],
      phoneWhatsappSame: [true],
      whatsapp: [''],
      email: [''],
      address: [''],
      studentName: ['', Validators.required],
      classLabel: [null],
      streamGroup: [null],
      inquiryDate: [new Date(), Validators.required],
      nextFollowUpDate: [null],
      assignedToEmployeeId: [null],
      reference: [''],
      status: [0],
      description: [''],
      autoFollowUp: [false],
    });

    this.form.get('phoneWhatsappSame')?.valueChanges.subscribe((same) => {
      if (same) {
        this.form.patchValue({ whatsapp: '' }, { emitEvent: false });
      }
      this.cdr.markForCheck();
    });

    this.api.getEmployees().subscribe({
      next: (list) => {
        this.configs['assignedToEmployeeId'].options = list.map((e) => ({
          label: e.name,
          value: e.id,
        }));
        this.cdr.markForCheck();
      },
      error: (err) => this.notify.error(getUserFacingApiError(err, 'Failed to load employees')),
    });

    if (this.mode === 'view') this.form.disable();
    if (this.inquiryId && this.mode !== 'add') {
      this.api.getAdmissionInquiry(this.inquiryId).subscribe({
        next: (row) => {
          const phone = row.phone ?? '';
          const whatsapp = row.whatsapp ?? '';
          const same = !whatsapp || whatsapp === phone;
          this.form.patchValue({
            parentName: row.parentName,
            phone,
            phoneWhatsappSame: same,
            whatsapp: same ? '' : whatsapp,
            email: row.email ?? '',
            address: row.address ?? '',
            studentName: row.studentName,
            classLabel: row.classLabel ?? null,
            streamGroup: streamGroupFromApiInt(
              typeof (row as { streamGroup?: number | null }).streamGroup === 'number'
                ? (row as { streamGroup?: number | null }).streamGroup
                : Number((row as { streamGroup?: string | number | null }).streamGroup) || null,
            ),
            inquiryDate: row.inquiryDate ? new Date(row.inquiryDate) : null,
            nextFollowUpDate: row.nextFollowUpDate ? new Date(row.nextFollowUpDate) : null,
            assignedToEmployeeId: row.assignedToEmployeeId ?? null,
            reference: row.reference ?? '',
            status: parseInquiryStatus(row.status),
            description: row.description ?? '',
            autoFollowUp: row.autoFollowUp,
          });
          this.cdr.markForCheck();
        },
        error: (err) => this.notify.error(getUserFacingApiError(err, 'Failed to load inquiry')),
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
    const phone = String(raw.phone ?? '').trim() || null;
    const same = !!raw.phoneWhatsappSame;
    const body = {
      parentName: String(raw.parentName ?? '').trim(),
      phone,
      whatsapp: same ? phone : String(raw.whatsapp ?? '').trim() || null,
      email: raw.email || null,
      address: raw.address || null,
      studentName: String(raw.studentName ?? '').trim(),
      classLabel: raw.classLabel || null,
      streamGroup: streamGroupToApiInt(raw.streamGroup),
      inquiryDate: this.toDateOnly(raw.inquiryDate),
      nextFollowUpDate: this.toDateOnly(raw.nextFollowUpDate),
      assignedToEmployeeId: raw.assignedToEmployeeId ? String(raw.assignedToEmployeeId) : null,
      reference: raw.reference || null,
      status: parseInquiryStatus(raw.status),
      description: raw.description || null,
      autoFollowUp: !!raw.autoFollowUp,
    };

    const payload = body as Partial<AdmissionInquiryDto>;
    const req =
      this.mode === 'edit' && this.inquiryId
        ? this.api.updateAdmissionInquiry(this.inquiryId, payload)
        : this.api.createAdmissionInquiry(payload);

    req.pipe(finalize(() => (this.isSaving = false))).subscribe({
      next: () => {
        this.notify.success(this.mode === 'edit' ? 'Inquiry updated' : 'Inquiry added');
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
