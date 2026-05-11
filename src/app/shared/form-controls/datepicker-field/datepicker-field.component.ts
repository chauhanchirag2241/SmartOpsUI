import { Component, Input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormFieldConfig } from '../../interfaces/form-field-config';

@Component({
  selector: 'app-datepicker-field',
  imports: [MatDatepickerModule, MatFormFieldModule, MatInputModule, MatNativeDateModule, ReactiveFormsModule],
  template: `
    <mat-form-field appearance="outline" class="full-width" [formGroup]="group">
      <mat-label>{{ config.label }}</mat-label>
      <input matInput [matDatepicker]="picker" [formControlName]="config.controlName" [placeholder]="config.placeholder ?? ''" />
      <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
      <mat-datepicker #picker></mat-datepicker>
    </mat-form-field>
  `,
  styles: ['.full-width { width: 100%; }'],
})
export class DatepickerFieldComponent {
  @Input({ required: true }) config!: FormFieldConfig;
  @Input({ required: true }) group!: FormGroup;
}
