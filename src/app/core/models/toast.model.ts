export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastConfig {
  type: ToastType;
  title: string;
  message?: string;
  action?: ToastAction;
  duration?: number;
}

export interface SmartToastData {
  type: ToastType;
  title: string;
  message?: string;
  action?: ToastAction;
  duration: number;
}
