import { Component, Input, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ControlValueAccessor,
  FormArray,
  FormBuilder,
  FormGroup,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Subscription } from 'rxjs';

export interface DynamicFieldEntry {
  label: string;
  value: string;
}

@Component({
  selector: 'app-dynamic-array-field',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './dynamic-array-field.component.html',
  styleUrl: './dynamic-array-field.component.css',
  host: { class: 'dynamic-array-host' },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: DynamicArrayFieldComponent,
      multi: true,
    },
  ],
})
export class DynamicArrayFieldComponent implements ControlValueAccessor, OnDestroy {
  @Input() label = 'Additional fields';
  @Input() disabled = false;

  readonly arrayForm: FormArray<FormGroup>;
  private sub?: Subscription;
  private onChange: (value: DynamicFieldEntry[]) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private fb: FormBuilder) {
    this.arrayForm = this.fb.array<FormGroup>([]);
    this.sub = this.arrayForm.valueChanges.subscribe(() => this.emitValue());
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  writeValue(value: DynamicFieldEntry[] | null): void {
    this.arrayForm.clear({ emitEvent: false });
    const rows = value?.length ? value : [{ label: '', value: '' }];
    for (const row of rows) {
      this.arrayForm.push(this.createRow(row.label, row.value), { emitEvent: false });
    }
  }

  registerOnChange(fn: (value: DynamicFieldEntry[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    if (isDisabled) {
      this.arrayForm.disable({ emitEvent: false });
    } else {
      this.arrayForm.enable({ emitEvent: false });
    }
  }

  addRow(): void {
    if (this.disabled) return;
    this.arrayForm.push(this.createRow());
    this.onTouched();
    this.emitValue();
  }

  removeRow(index: number): void {
    if (this.disabled || this.arrayForm.length <= 1) return;
    this.arrayForm.removeAt(index);
    this.onTouched();
    this.emitValue();
  }

  onFieldBlur(): void {
    this.onTouched();
    this.emitValue();
  }

  private createRow(label = '', value = ''): FormGroup {
    return this.fb.group({ label: [label], value: [value] });
  }

  private emitValue(): void {
    const entries: DynamicFieldEntry[] = this.arrayForm.controls.map((group) => ({
      label: String(group.get('label')?.value ?? '').trim(),
      value: String(group.get('value')?.value ?? '').trim(),
    }));
    this.onChange(entries.filter((e) => e.label || e.value));
  }
}
