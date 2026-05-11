import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { NgFor, NgSwitch, NgSwitchCase } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { DatepickerFieldComponent } from '../datepicker-field/datepicker-field.component';
import { InputFieldComponent } from '../input-field/input-field.component';
import { SelectFieldComponent } from '../select-field/select-field.component';
import { FormFieldConfig } from '../../interfaces/form-field-config';

@Component({
  selector: 'app-dynamic-form',
  imports: [
    DatepickerFieldComponent,
    InputFieldComponent,
    MatButtonModule,
    NgFor,
    NgSwitch,
    NgSwitchCase,
    ReactiveFormsModule,
    SelectFieldComponent,
  ],
  templateUrl: './dynamic-form.component.html',
})
export class DynamicFormComponent implements OnInit {
  @Input() fields: FormFieldConfig[] = [];
  @Input() submitLabel = 'Submit';
  @Output() readonly formSubmit = new EventEmitter<Record<string, unknown>>();

  form!: FormGroup;
  private readonly fb = inject(FormBuilder);

  ngOnInit(): void {
    const group: Record<string, unknown[]> = {};
    this.fields.forEach((field) => {
      const validators = field.validations?.map((item) => item.validator) ?? [];
      group[field.controlName] = [{ value: field.defaultValue ?? '', disabled: field.disabled ?? false }, validators];
    });
    this.form = this.fb.group(group);
  }

  onSubmit(): void {
    if (this.form.valid) {
      this.formSubmit.emit(this.form.getRawValue() as Record<string, unknown>);
      return;
    }

    this.form.markAllAsTouched();
  }
}
