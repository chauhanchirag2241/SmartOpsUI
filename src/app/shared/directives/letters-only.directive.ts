import { Directive, HostListener, Input } from '@angular/core';

/** Allows only A–Z, a–z, and space (for person/place name fields). */
@Directive({
  selector: 'input[appLettersOnly]',
  standalone: true,
})
export class LettersOnlyDirective {
  @Input() appLettersOnly = true;

  @HostListener('beforeinput', ['$event'])
  onBeforeInput(event: InputEvent): void {
    if (!this.appLettersOnly || !event.data) {
      return;
    }

    if (!/^[A-Za-z ]*$/.test(event.data)) {
      event.preventDefault();
    }
  }

  @HostListener('paste', ['$event'])
  onPaste(event: ClipboardEvent): void {
    if (!this.appLettersOnly) {
      return;
    }

    event.preventDefault();
    const input = event.target as HTMLInputElement;
    const pasted = event.clipboardData?.getData('text') ?? '';
    this.insertText(input, pasted.replace(/[^A-Za-z ]/g, ''));
  }

  @HostListener('input', ['$event'])
  onInput(event: Event): void {
    if (!this.appLettersOnly) {
      return;
    }

    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/[^A-Za-z ]/g, '');
    if (input.value !== sanitized) {
      input.value = sanitized;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  private insertText(input: HTMLInputElement, text: string): void {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const nextValue = `${input.value.slice(0, start)}${text}${input.value.slice(end)}`;

    input.value = nextValue.replace(/[^A-Za-z ]/g, '');
    const caret = start + text.length;
    input.setSelectionRange(caret, caret);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
}
