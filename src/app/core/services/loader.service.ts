import { Injectable, signal } from '@angular/core';

const SHOW_DELAY_MS = 300;
const MIN_VISIBLE_MS = 250;

const DEFAULT_MESSAGES = [
  'Loading...',
  'Fetching data...',
  'Please wait...',
  'Processing...',
  'Almost done...',
];

@Injectable({ providedIn: 'root' })
export class LoaderService {
  private readonly _loading = signal(false);
  private readonly _message = signal(DEFAULT_MESSAGES[0]);

  readonly loading = this._loading.asReadonly();
  readonly message = this._message.asReadonly();

  private httpCount = 0;
  private manualCount = 0;
  private showTimer: ReturnType<typeof setTimeout> | undefined;
  private hideTimer: ReturnType<typeof setTimeout> | undefined;
  private messageTimer: ReturnType<typeof setInterval> | undefined;
  private showStartedAt = 0;
  private messageIndex = 0;

  onRequestStart(): void {
    this.httpCount++;
    this.syncVisibility();
  }

  onRequestEnd(): void {
    this.httpCount = Math.max(0, this.httpCount - 1);
    this.syncVisibility();
  }

  /** Manual overlay for non-HTTP work; pair with {@link hideManual}. */
  showManual(message = 'Loading...'): void {
    this.manualCount++;
    this._message.set(message);
    this.syncVisibility();
  }

  hideManual(): void {
    this.manualCount = Math.max(0, this.manualCount - 1);
    this.syncVisibility();
  }

  setMessage(message: string): void {
    this._message.set(message);
  }

  private get isBusy(): boolean {
    return this.httpCount > 0 || this.manualCount > 0;
  }

  private syncVisibility(): void {
    if (this.isBusy) {
      this.scheduleShow();
      return;
    }
    this.scheduleHide();
  }

  private scheduleShow(): void {
    if (this._loading() || this.showTimer) {
      return;
    }

    this.clearHideTimer();

    this.showTimer = setTimeout(() => {
      this.showTimer = undefined;
      if (!this.isBusy) {
        return;
      }

      this.showStartedAt = Date.now();
      this._loading.set(true);
      this.startMessageRotation();
    }, SHOW_DELAY_MS);
  }

  private scheduleHide(): void {
    if (this.showTimer) {
      clearTimeout(this.showTimer);
      this.showTimer = undefined;
    }

    if (!this._loading()) {
      return;
    }

    const elapsed = Date.now() - this.showStartedAt;
    const delay = Math.max(0, MIN_VISIBLE_MS - elapsed);

    this.clearHideTimer();
    this.hideTimer = setTimeout(() => {
      this.hideTimer = undefined;
      if (!this.isBusy) {
        this._loading.set(false);
        this.stopMessageRotation();
        this._message.set(DEFAULT_MESSAGES[0]);
        this.messageIndex = 0;
      }
    }, delay);
  }

  private startMessageRotation(): void {
    this.stopMessageRotation();
    this.messageTimer = setInterval(() => {
      if (!this._loading()) {
        return;
      }
      this.messageIndex = (this.messageIndex + 1) % DEFAULT_MESSAGES.length;
      this._message.set(DEFAULT_MESSAGES[this.messageIndex]);
    }, 2200);
  }

  private stopMessageRotation(): void {
    if (this.messageTimer) {
      clearInterval(this.messageTimer);
      this.messageTimer = undefined;
    }
  }

  private clearHideTimer(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = undefined;
    }
  }
}
