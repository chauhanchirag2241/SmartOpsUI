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
    <mat-form-field appearance="outline" class="full-width" [formGroup]="group">
      <mat-label>{{ config.label }}</mat-label>
      <input matInput [placeholder]="config.placeholder ?? ''" [formControlName]="config.controlName" />
      <mat-error *ngIf="group.get(config.controlName)?.invalid">{{ getError() }}</mat-error>
    </mat-form-field>
  `,
  styles: ['.full-width { width: 100%; }'],
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
