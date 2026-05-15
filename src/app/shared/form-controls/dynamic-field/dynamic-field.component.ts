import { Component, HostBinding, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { DigitsOnlyDirective } from '../../directives/digits-only.directive';
import type { FormFieldConfig, SelectOption } from '../../interfaces/form-field-config';

@Component({
  selector: 'app-dynamic-field',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatCheckboxModule,
    DigitsOnlyDirective,
  ],
  templateUrl: './dynamic-field.component.html',
  styleUrl: './dynamic-field.component.css',
})
export class DynamicFieldComponent {
  @Input({ required: true }) config!: FormFieldConfig;
  @Input({ required: true }) group!: FormGroup;
  @Input() full = false;

  @HostBinding('class.field') readonly fieldClass = true;

  @HostBinding('class.full')
  get fullClass(): boolean {
    return this.full;
  }

  get controlId(): string {
    return `df-${this.config.controlName}`;
  }

  getError(): string {
    const control = this.group.get(this.config.controlName);
    const validation = this.config.validations?.find((item) => control?.hasError(item.name));
    return validation?.message ?? 'Invalid field';
  }

  getPlaceholder(): string {
    return this.group.get(this.config.controlName)?.disabled ? '' : (this.config.placeholder ?? '');
  }

  optionTrack(index: number, option: SelectOption): string {
    return `${index}-${String(option.value)}`;
  }

  onMultiCheckboxChange(controlName: string, value: unknown, checked: boolean): void {
    const control = this.group.get(controlName);
    if (!control) return;

    const currentArray = (control.value ?? []) as unknown[];
    let newArray: unknown[];

    if (checked) {
      newArray = [...currentArray, value];
    } else {
      newArray = currentArray.filter((item) => item !== value);
    }

    control.setValue(newArray);
    control.markAsTouched();
  }
}
