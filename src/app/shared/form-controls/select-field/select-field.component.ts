import { Component, Input } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { FormFieldConfig } from '../../interfaces/form-field-config';

@Component({
  selector: 'app-select-field',
  imports: [MatFormFieldModule, MatSelectModule, NgFor, NgIf, ReactiveFormsModule],
  template: `
    <div class="custom-field" [formGroup]="group">
      <label>
        {{ config.label }} 
        <span *ngIf="config.validations?.length">*</span>
      </label>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full-width compact-field">
        <mat-select [formControlName]="config.controlName" [placeholder]="config.placeholder ?? ''">
          <mat-option *ngFor="let option of config.options ?? []" [value]="option.value">
            {{ option.label }}
          </mat-option>
        </mat-select>
        <mat-error *ngIf="group.get(config.controlName)?.invalid">Invalid field</mat-error>
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
export class SelectFieldComponent {
  @Input({ required: true }) config!: FormFieldConfig;
  @Input({ required: true }) group!: FormGroup;
}
