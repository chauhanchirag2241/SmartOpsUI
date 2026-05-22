import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

export type ActionButtonType = 'back' | 'cancel' | 'next' | 'save' | 'submit';

@Component({
  selector: 'app-action-button',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './action-button.component.html',
  styleUrls: ['./action-button.component.css']
})
export class ActionButtonComponent {
  @Input() type: ActionButtonType = 'submit';
  @Input() disabled = false;
  @Input() label?: string;
  @Input() icon?: string;
  
  @Output() action = new EventEmitter<void>();

  get defaultLabel(): string {
    switch(this.type) {
      case 'back': return 'Back';
      case 'cancel': return 'Cancel';
      case 'next': return 'Next';
      case 'save': return 'Save';
      case 'submit': return 'Submit';
      default: return 'Submit';
    }
  }

  get defaultIcon(): string {
    switch(this.type) {
      case 'back': return 'arrow_back';
      case 'cancel': return 'close';
      case 'next': return 'arrow_forward';
      case 'save': return 'save';
      case 'submit': return 'check';
      default: return '';
    }
  }

  get buttonClass(): string {
    if (this.type === 'back' || this.type === 'cancel') return 'btn-back';
    return 'btn-next';
  }

  onClick() {
    if (!this.disabled) {
      this.action.emit();
    }
  }
}
