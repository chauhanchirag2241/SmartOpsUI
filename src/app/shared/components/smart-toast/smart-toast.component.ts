import { Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar';

import { SmartToastData, ToastType } from '../../../core/models/toast.model';

const TOAST_ICONS: Record<ToastType, string> = {
  success: 'check_circle',
  error: 'cancel',
  warning: 'warning',
  info: 'info',
};

@Component({
  selector: 'app-smart-toast',
  imports: [MatIconModule],
  templateUrl: './smart-toast.component.html',
  styleUrl: './smart-toast.component.css',
})
export class SmartToastComponent {
  private readonly snackRef = inject(MatSnackBarRef<SmartToastComponent>);
  readonly data = inject<SmartToastData>(MAT_SNACK_BAR_DATA);

  get icon(): string {
    return TOAST_ICONS[this.data.type];
  }

  dismiss(): void {
    this.snackRef.dismiss();
  }

  onAction(): void {
    this.data.action?.onClick();
    this.dismiss();
  }
}
