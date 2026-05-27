import { Injectable, inject } from '@angular/core';
import {
  MatSnackBar,
  MatSnackBarConfig,
  MatSnackBarRef,
} from '@angular/material/snack-bar';
import { Subject } from 'rxjs';

import { ToastConfig, ToastType } from '../models/toast.model';
import { SmartToastComponent } from '../../shared/components/smart-toast/smart-toast.component';
import { ToastHostService } from './toast-host.service';

export type NotificationType = ToastType;

type SnackOpenConfig = Pick<
  MatSnackBarConfig,
  'duration' | 'panelClass' | 'horizontalPosition' | 'verticalPosition'
>;

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly toastHost = inject(ToastHostService);

  /** MatSnackBar-compatible API — routes all calls to SmartOps toast UI. */
  open(
    message: string,
    action = '',
    config: SnackOpenConfig = {},
  ): MatSnackBarRef<SmartToastComponent> {
    const duration = config.duration ?? 3000;
    const type = resolveToastType(String(message), config.panelClass);
    const actionLabel = action && action !== 'Close' ? action : undefined;
    const action$ = new Subject<void>();

    const ref = this.toastHost.openSmartToast(
      {
        type,
        title: String(message),
        duration,
        action: actionLabel
          ? { label: actionLabel, onClick: () => action$.next() }
          : undefined,
      },
      {
        duration,
        horizontalPosition: config.horizontalPosition ?? 'right',
        verticalPosition: config.verticalPosition ?? 'bottom',
      },
    );

    if (actionLabel) {
      ref.onAction = () => action$.asObservable();
    }

    return ref;
  }

  show(config: ToastConfig): MatSnackBarRef<SmartToastComponent>;
  show(message: string, type?: NotificationType, duration?: number): MatSnackBarRef<SmartToastComponent>;
  show(
    configOrMessage: ToastConfig | string,
    type: NotificationType = 'info',
    duration = 3000,
  ): MatSnackBarRef<SmartToastComponent> {
    if (typeof configOrMessage === 'string') {
      return this.openToast({ type, title: configOrMessage, duration });
    }
    return this.openToast(configOrMessage);
  }

  success(title: string, message?: string, duration?: number): MatSnackBarRef<SmartToastComponent> {
    return this.openToast({ type: 'success', title, message, duration });
  }

  error(title: string, message?: string, duration?: number): MatSnackBarRef<SmartToastComponent> {
    return this.openToast({ type: 'error', title, message, duration });
  }

  warning(title: string, message?: string, duration?: number): MatSnackBarRef<SmartToastComponent> {
    return this.openToast({ type: 'warning', title, message, duration });
  }

  info(title: string, message?: string, duration?: number): MatSnackBarRef<SmartToastComponent> {
    return this.openToast({ type: 'info', title, message, duration });
  }

  private openToast(config: ToastConfig): MatSnackBarRef<SmartToastComponent> {
    const duration = config.duration ?? 3000;
    const action$ = new Subject<void>();

    const ref = this.toastHost.openSmartToast(
      {
        type: config.type,
        title: config.title,
        message: config.message,
        duration,
        action: config.action
          ? {
              label: config.action.label,
              onClick: () => {
                config.action!.onClick();
                action$.next();
              },
            }
          : undefined,
      },
      { duration, horizontalPosition: 'right', verticalPosition: 'bottom' },
    );

    if (config.action) {
      ref.onAction = () => action$.asObservable();
    }

    return ref;
  }
}

function resolveToastType(message: string, panelClass?: string | string[]): ToastType {
  if (panelClass) {
    return panelClassToType(panelClass);
  }

  const text = message.toLowerCase();
  if (/fail|error|invalid|unable|could not|cannot|timeout/.test(text)) {
    return 'error';
  }
  if (/warn|overdue|caution/.test(text)) {
    return 'warning';
  }
  if (
    /success|saved|deleted|submitted|marked|created|updated|removed|added|assigned|recorded|undone|completed/.test(
      text,
    )
  ) {
    return 'success';
  }
  return 'info';
}

function panelClassToType(panelClass?: string | string[]): ToastType {
  const classes = !panelClass ? [] : Array.isArray(panelClass) ? panelClass : [panelClass];
  const joined = classes.join(' ').toLowerCase();
  if (joined.includes('error')) return 'error';
  if (joined.includes('success')) return 'success';
  if (joined.includes('warning')) return 'warning';
  if (joined.includes('info')) return 'info';
  return 'info';
}
