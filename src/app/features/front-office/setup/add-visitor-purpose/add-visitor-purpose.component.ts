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
import { PageChromeDirective } from '../../../../shared/directives/page-chrome.directive';
import { DynamicFieldComponent } from '../../../../shared/form-controls/dynamic-field/dynamic-field.component';
import { FormFieldConfig } from '../../../../shared/interfaces/form-field-config';
import { getUserFacingApiError } from '../../../../shared/utils/api-error.util';

@Component({
  selector: 'app-add-visitor-purpose',
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
        <div class="card-title"><mat-icon>door_front</mat-icon> Visitor purpose</div>
        <div class="grid2">
          <app-dynamic-field [config]="configs['name']" [group]="form" />
          <app-dynamic-field [config]="configs['description']" [group]="form" [full]="true" />
        </div>
      </div>
      @if (mode !== 'view') {
        <div class="footer-actions">
          <app-action-button type="cancel" (action)="cancel.emit()" />
          <app-action-button
            type="save"
            [disabled]="isSaving"
            [label]="isSaving ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Add purpose'"
            (action)="save()"
          />
        </div>
      }
    </form>
  `,
})
export class AddVisitorPurposeComponent implements OnInit {
  @Input() mode: 'add' | 'edit' | 'view' = 'add';
  @Input() purposeId?: string;
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
      label: 'Purpose name',
      placeholder: 'e.g. Meeting with Teacher',
      maxLength: 200,
      validations: [{ name: 'required', validator: Validators.required, message: 'Name is required' }],
    },
    description: {
      type: 'textarea',
      controlName: 'description',
      label: 'Description',
      placeholder: 'Optional description',
      maxLength: 500,
    },
  };

  get pageTitle(): string {
    if (this.mode === 'edit') return 'Edit visitor purpose';
    if (this.mode === 'view') return 'Visitor purpose';
    return 'Add visitor purpose';
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(200)]],
      description: ['', Validators.maxLength(500)],
    });
    if (this.mode === 'view') this.form.disable();
    if (this.purposeId && this.mode !== 'add') {
      this.api.getVisitorPurpose(this.purposeId).subscribe({
        next: (row) => {
          this.form.patchValue({ name: row.name, description: row.description ?? '' });
          this.cdr.markForCheck();
        },
        error: (err) => this.notify.error(getUserFacingApiError(err, 'Failed to load purpose')),
      });
    }
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSaving = true;
    const body = this.form.getRawValue();
    const req =
      this.mode === 'edit' && this.purposeId
        ? this.api.updateVisitorPurpose(this.purposeId, body)
        : this.api.createVisitorPurpose(body);
    req.pipe(finalize(() => (this.isSaving = false))).subscribe({
      next: () => {
        this.notify.success(this.mode === 'edit' ? 'Purpose updated' : 'Purpose added');
        this.saved.emit();
      },
      error: (err) => this.notify.error(getUserFacingApiError(err, 'Save failed')),
    });
  }
}
