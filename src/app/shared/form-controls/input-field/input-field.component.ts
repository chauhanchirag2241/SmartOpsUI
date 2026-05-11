import { Component, Input } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormFieldConfig } from '../../interfaces/form-field-config';

@Component({
  selector: 'app-input-field',
  imports: [MatFormFieldModule, MatInputModule, NgIf, ReactiveFormsModule],
  template: `
    <div class="custom-field" [formGroup]="group">
      <label>
        {{ config.label }} 
        <span *ngIf="config.validations?.length">*</span>
      </label>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full-width compact-field">
        <input matInput [type]="config.inputType || 'text'" [placeholder]="config.placeholder ?? ''" [formControlName]="config.controlName" />
        <mat-error *ngIf="group.get(config.controlName)?.invalid">{{ getError() }}</mat-error>
      </mat-form-field>
    </div>
  `,
  styles: [`
    .full-width { width: 100%; }
    .custom-field { display: flex; flex-direction: column; gap: 5px; }
    label { font-size: 11px; color: var(--muted, #6b7280); font-weight: 500; }
    label span { color: #E24B4A; margin-left: 2px; }
  `],
})
export class InputFieldComponent {
  @Input({ required: true }) config!: FormFieldConfig;
  @Input({ required: true }) group!: FormGroup;

  getError(): string {
    const control = this.group.get(this.config.controlName);
    const validation = this.config.validations?.find((item) => control?.hasError(item.name));
    return validation?.message ?? 'Invalid field';
  }
}
