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
import { ComplaintDto, FrontOfficeService } from '../../../../core/services/front-office.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ActionButtonComponent } from '../../../../shared/components/action-button/action-button.component';
import { PageChromeDirective } from '../../../../shared/directives/page-chrome.directive';
import { SELECT_PLACEHOLDER } from '../../../../shared/constants/form.constants';
import { DynamicFieldComponent } from '../../../../shared/form-controls/dynamic-field/dynamic-field.component';
import { FormFieldConfig } from '../../../../shared/interfaces/form-field-config';
import { getUserFacingApiError } from '../../../../shared/utils/api-error.util';
import { parseComplaintStatus } from '../../../../shared/utils/front-office-enum.util';

@Component({
  selector: 'app-add-complaint',
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
        <div class="card-title"><mat-icon>report_problem</mat-icon> Complaint details</div>
        <div class="grid2">
          <app-dynamic-field [config]="configs['complaintTypeId']" [group]="form" />
          <app-dynamic-field [config]="configs['complaintDate']" [group]="form" />
          <app-dynamic-field [config]="configs['isAnonymous']" [group]="form" />
          @if (!form.get('isAnonymous')?.value) {
            <app-dynamic-field [config]="configs['complainantName']" [group]="form" />
          }
          <app-dynamic-field [config]="configs['phone']" [group]="form" />
          <app-dynamic-field [config]="configs['assignedToEmployeeId']" [group]="form" />
          <app-dynamic-field [config]="configs['status']" [group]="form" />
          <app-dynamic-field [config]="configs['actionTaken']" [group]="form" />
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
            [label]="isSaving ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Add complaint'"
            (action)="save()"
          />
        </div>
      }
    </form>
  `,
})
export class AddComplaintComponent implements OnInit {
  @Input() mode: 'add' | 'edit' | 'view' = 'add';
  @Input() complaintId?: string;
  @Output() cancel = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly api = inject(FrontOfficeService);
  private readonly notify = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);

  form!: FormGroup;
  isSaving = false;

  readonly configs: Record<string, FormFieldConfig> = {
    complaintTypeId: {
      type: 'select',
      controlName: 'complaintTypeId',
      label: 'Complaint type',
      placeholder: SELECT_PLACEHOLDER,
      options: [],
      validations: [
        { name: 'required', validator: Validators.required, message: 'Complaint type is required' },
      ],
    },
    complaintDate: {
      type: 'datepicker',
      controlName: 'complaintDate',
      label: 'Complaint date',
      validations: [
        { name: 'required', validator: Validators.required, message: 'Complaint date is required' },
      ],
    },
    isAnonymous: {
      type: 'checkbox',
      controlName: 'isAnonymous',
      label: 'Anonymous complaint',
    },
    complainantName: {
      type: 'input',
      controlName: 'complainantName',
      label: 'Complainant name',
      placeholder: 'Name (if not anonymous)',
    },
    phone: {
      type: 'input',
      controlName: 'phone',
      label: 'Phone',
      inputType: 'tel',
      placeholder: 'Contact number',
    },
    description: {
      type: 'textarea',
      controlName: 'description',
      label: 'Description',
      placeholder: 'Describe the complaint',
      validations: [
        { name: 'required', validator: Validators.required, message: 'Description is required' },
      ],
    },
    assignedToEmployeeId: {
      type: 'autocomplete',
      controlName: 'assignedToEmployeeId',
      label: 'Assigned to',
      placeholder: 'Search employee…',
      options: [],
      validations: [
        { name: 'required', validator: Validators.required, message: 'Assignee is required' },
      ],
    },
    status: {
      type: 'badges',
      controlName: 'status',
      label: 'Status',
      options: [
        { label: 'Pending', value: 0 },
        { label: 'In Progress', value: 1 },
        { label: 'Resolved', value: 2 },
        { label: 'Closed', value: 3 },
      ],
    },
    actionTaken: {
      type: 'textarea',
      controlName: 'actionTaken',
      label: 'Action taken',
      placeholder: 'Steps taken so far',
    },
    note: {
      type: 'textarea',
      controlName: 'note',
      label: 'Note',
      placeholder: 'Optional notes',
    },
  };

  get pageTitle(): string {
    if (this.mode === 'edit') return 'Edit complaint';
    if (this.mode === 'view') return 'View complaint';
    return 'Add complaint';
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      complaintTypeId: [null, Validators.required],
      complaintDate: [new Date(), Validators.required],
      isAnonymous: [false],
      complainantName: [''],
      phone: [''],
      description: ['', Validators.required],
      assignedToEmployeeId: [null, Validators.required],
      status: [0],
      actionTaken: [''],
      note: [''],
    });

    this.api.getComplaintTypes({ activeFilter: 'Active' }).subscribe({
      next: (list) => {
        this.configs['complaintTypeId'].options = list.map((t) => ({
          label: t.name,
          value: t.id,
        }));
        this.cdr.markForCheck();
      },
      error: (err) => this.notify.error(getUserFacingApiError(err, 'Failed to load complaint types')),
    });

    this.form.get('isAnonymous')?.valueChanges.subscribe((anon) => {
      if (anon) {
        this.form.patchValue({ complainantName: '' }, { emitEvent: false });
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
    if (this.complaintId && this.mode !== 'add') {
      this.api.getComplaint(this.complaintId).subscribe({
        next: (row) => {
          this.form.patchValue({
            complaintTypeId: row.complaintTypeId,
            complaintDate: row.complaintDate ? new Date(row.complaintDate) : null,
            isAnonymous: row.isAnonymous,
            complainantName: row.complainantName ?? '',
            phone: row.phone ?? '',
            description: row.description,
            assignedToEmployeeId: row.assignedToEmployeeId,
            status: parseComplaintStatus(row.status),
            actionTaken: row.actionTaken ?? '',
            note: row.note ?? '',
          });
          this.cdr.markForCheck();
        },
        error: (err) => this.notify.error(getUserFacingApiError(err, 'Failed to load complaint')),
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
      complaintTypeId: raw.complaintTypeId,
      complaintDate: this.toDateOnly(raw.complaintDate),
      isAnonymous: !!raw.isAnonymous,
      complainantName: raw.isAnonymous ? null : raw.complainantName || null,
      phone: raw.phone || null,
      description: String(raw.description ?? '').trim(),
      assignedToEmployeeId: raw.assignedToEmployeeId,
      status: parseComplaintStatus(raw.status),
      actionTaken: raw.actionTaken || null,
      note: raw.note || null,
    };

    const payload = body as Partial<ComplaintDto>;
    const req =
      this.mode === 'edit' && this.complaintId
        ? this.api.updateComplaint(this.complaintId, payload)
        : this.api.createComplaint(payload);

    req.pipe(finalize(() => (this.isSaving = false))).subscribe({
      next: () => {
        this.notify.success(this.mode === 'edit' ? 'Complaint updated' : 'Complaint added');
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
