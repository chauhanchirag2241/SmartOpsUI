import { Directive, HostListener, Input } from '@angular/core';

@Directive({
  selector: 'input[appDigitsOnly]',
  standalone: true,
})
export class DigitsOnlyDirective {
  @Input() appDigitsOnly = true;
  @Input() maxDigits = 10;

  @HostListener('beforeinput', ['$event'])
  onBeforeInput(event: InputEvent): void {
    if (!this.appDigitsOnly || !event.data) {
      return;
    }

    if (!/^\d+$/.test(event.data) || this.wouldExceedMax(event.target as HTMLInputElement, event.data)) {
      event.preventDefault();
    }
  }

  @HostListener('paste', ['$event'])
  onPaste(event: ClipboardEvent): void {
    if (!this.appDigitsOnly) {
      return;
    }

    event.preventDefault();
    const input = event.target as HTMLInputElement;
    const pasted = event.clipboardData?.getData('text') ?? '';
    const digits = pasted.replace(/\D/g, '');
    this.insertDigits(input, digits);
  }

  @HostListener('input', ['$event'])
  onInput(event: Event): void {
    if (!this.appDigitsOnly) {
      return;
    }

    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/\D/g, '').slice(0, this.maxDigits);
    if (input.value !== sanitized) {
      input.value = sanitized;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  private wouldExceedMax(input: HTMLInputElement, nextText: string): boolean {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const nextValue = `${input.value.slice(0, start)}${nextText}${input.value.slice(end)}`;
    return nextValue.replace(/\D/g, '').length > this.maxDigits;
  }

  private insertDigits(input: HTMLInputElement, digits: string): void {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const available = Math.max(this.maxDigits - (input.value.length - (end - start)), 0);
    const nextDigits = digits.slice(0, available);
    const nextValue = `${input.value.slice(0, start)}${nextDigits}${input.value.slice(end)}`.slice(0, this.maxDigits);

    input.value = nextValue;
    input.setSelectionRange(start + nextDigits.length, start + nextDigits.length);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
}
