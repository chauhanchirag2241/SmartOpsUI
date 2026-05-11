import { Component, Input } from '@angular/core';
import { NgFor } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { FormFieldConfig } from '../../interfaces/form-field-config';

@Component({
  selector: 'app-select-field',
  imports: [MatFormFieldModule, MatSelectModule, NgFor, ReactiveFormsModule],
  template: `
    <mat-form-field appearance="outline" class="full-width" [formGroup]="group">
      <mat-label>{{ config.label }}</mat-label>
      <mat-select [formControlName]="config.controlName" [placeholder]="config.placeholder ?? ''">
        <mat-option *ngFor="let option of config.options ?? []" [value]="option.value">
          {{ option.label }}
        </mat-option>
      </mat-select>
    </mat-form-field>
  `,
  styles: ['.full-width { width: 100%; }'],
})
export class SelectFieldComponent {
  @Input({ required: true }) config!: FormFieldConfig;
  @Input({ required: true }) group!: FormGroup;
}
