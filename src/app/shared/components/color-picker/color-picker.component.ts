import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output,
  forwardRef,
} from '@angular/core';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';

const DEFAULT_PRESETS = [
  '#639922',
  '#3B6D11',
  '#C0392B',
  '#3355A8',
  '#D97706',
  '#7C3AED',
  '#0F766E',
  '#475569',
];

let nextId = 0;

/**
 * Themed color control for portal forms (hex + swatch + presets).
 * Works with ngModel / formControlName.
 */
@Component({
  selector: 'app-color-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './color-picker.component.html',
  styleUrl: './color-picker.component.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ColorPickerComponent),
      multi: true,
    },
  ],
})
export class ColorPickerComponent implements ControlValueAccessor {
  @Input() label = 'Color';
  @Input() showLabel = true;
  @Input() disabled = false;
  @Input() presets: string[] = DEFAULT_PRESETS;
  @Input() inputId = `app-color-${++nextId}`;

  @Output() colorChange = new EventEmitter<string>();

  value = '#639922';
  private cvaDisabled = false;
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  get isDisabled(): boolean {
    return this.disabled || this.cvaDisabled;
  }

  get displayHex(): string {
    return this.normalize(this.value) || '#639922';
  }

  writeValue(obj: string | null): void {
    this.value = this.normalize(obj) || '#639922';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.cvaDisabled = isDisabled;
  }

  onNativeChange(raw: string): void {
    this.apply(raw);
  }

  onHexInput(raw: string): void {
    const trimmed = String(raw ?? '').trim();
    this.value = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    if (/^#[0-9A-Fa-f]{6}$/.test(this.value)) {
      this.apply(this.value);
    }
  }

  onHexBlur(): void {
    this.onTouched();
    this.apply(this.value);
  }

  selectPreset(color: string): void {
    if (this.isDisabled) return;
    this.apply(color);
    this.onTouched();
  }

  private apply(raw: string): void {
    const next = this.normalize(raw) || '#639922';
    this.value = next;
    this.onChange(next);
    this.colorChange.emit(next);
  }

  private normalize(raw: string | null | undefined): string {
    if (!raw) return '';
    let v = String(raw).trim();
    if (!v) return '';
    if (!v.startsWith('#')) v = `#${v}`;
    if (/^#[0-9A-Fa-f]{3}$/.test(v)) {
      v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
    }
    if (!/^#[0-9A-Fa-f]{6}$/.test(v)) return '';
    return v.toUpperCase();
  }
}
