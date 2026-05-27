import { Injectable, inject } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig, MatSnackBarRef } from '@angular/material/snack-bar';

import { SmartToastComponent } from '../../shared/components/smart-toast/smart-toast.component';
import { SmartToastData } from '../models/toast.model';

/** Wraps the real Material MatSnackBar (avoids circular DI with NotificationService). */
@Injectable({ providedIn: 'root' })
export class ToastHostService {
  private readonly snackBar = inject(MatSnackBar);

  openSmartToast(
    data: SmartToastData,
    config: Pick<MatSnackBarConfig, 'duration' | 'horizontalPosition' | 'verticalPosition'>,
  ): MatSnackBarRef<SmartToastComponent> {
    return this.snackBar.openFromComponent(SmartToastComponent, {
      data,
      duration: config.duration,
      horizontalPosition: config.horizontalPosition ?? 'right',
      verticalPosition: config.verticalPosition ?? 'bottom',
      panelClass: ['smartops-toast-panel'],
    });
  }
}
