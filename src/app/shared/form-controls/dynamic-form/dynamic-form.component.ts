import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';

import { DynamicFieldComponent } from '../dynamic-field/dynamic-field.component';
import { FormFieldConfig } from '../../interfaces/form-field-config';

@Component({
  selector: 'app-dynamic-form',
  standalone: true,
  imports: [DynamicFieldComponent, MatButtonModule, ReactiveFormsModule],
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
