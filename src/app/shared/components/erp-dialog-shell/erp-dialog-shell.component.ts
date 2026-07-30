import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ActionButtonComponent } from '../action-button/action-button.component';

/** Shared add/edit popup chrome: header + body + Cancel/Save side-by-side. */
@Component({
  selector: 'app-erp-dialog-shell',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatIconModule, ActionButtonComponent],
  template: `
    <div
      class="erp-dialog-shell"
      [class.no-body-scroll]="!bodyScroll"
      [style.--erp-dialog-width]="width"
      [style.--erp-dialog-max-height]="maxHeight"
    >
      <div class="dialog-header">
        <div class="dialog-header-text">
          <h2 class="dialog-title">{{ title }}</h2>
          @if (subtitle) {
            <div class="dialog-sub">{{ subtitle }}</div>
          }
        </div>
        <button
          type="button"
          class="dialog-close"
          mat-dialog-close
          aria-label="Close"
          [disabled]="saving"
        >
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-body">
        <ng-content />
      </div>

      @if (showFooter) {
        <div class="dialog-footer">
          <app-action-button type="cancel" [disabled]="saving" (action)="cancel.emit()" />
          @if (showSave) {
            <app-action-button
              type="save"
              [label]="saveLabel"
              [icon]="saveIcon"
              [disabled]="saveDisabled || saving"
              (action)="save.emit()"
            />
          }
        </div>
      }

      @if (saving) {
        <div class="dialog-loader" role="status" aria-live="polite" aria-busy="true">
          <div class="dialog-loader-ring">
            <div class="dialog-loader-icon">
              <mat-icon aria-hidden="true">school</mat-icon>
            </div>
          </div>
          <p class="dialog-loader-text">{{ savingLabel }}</p>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .erp-dialog-shell {
        position: relative;
        width: min(var(--erp-dialog-width, 760px), 94vw);
        max-height: var(--erp-dialog-max-height, 90vh);
        display: flex;
        flex-direction: column;
      }

      .dialog-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        padding: 18px 20px 0;
        flex-shrink: 0;
      }

      .dialog-title {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: var(--text-primary, #1a1a1a);
      }

      .dialog-sub {
        margin-top: 3px;
        font-size: 11px;
        color: var(--text-secondary, #6b7280);
      }

      .dialog-close {
        display: inline-flex;
        padding: 4px;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: var(--text-secondary, #6b7280);
        cursor: pointer;
      }

      .dialog-close:hover:not(:disabled) {
        background: var(--hover, #f3f4f6);
      }

      .dialog-close:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .dialog-close mat-icon {
        width: 18px;
        height: 18px;
        font-size: 18px;
      }

      .dialog-body {
        padding: 16px 20px;
        overflow: auto;
        flex: 1 1 auto;
        min-height: 0;
      }

      .erp-dialog-shell.no-body-scroll {
        max-height: none;
        height: auto;
      }

      .erp-dialog-shell.no-body-scroll .dialog-body {
        overflow: visible;
        flex: 0 0 auto;
        min-height: unset;
      }

      .dialog-footer {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
        flex-shrink: 0;
        padding: 12px 20px 18px;
        border-top: 1px solid var(--border-color, #e5e7eb);
      }

      .dialog-loader {
        position: absolute;
        inset: 0;
        z-index: 5;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        border-radius: inherit;
        background: color-mix(in srgb, var(--bg-page, #f5f7f2) 88%, transparent);
        backdrop-filter: blur(2px);
      }

      .dialog-loader-ring {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        border: 2px solid var(--g100, #c0dd97);
        display: flex;
        align-items: center;
        justify-content: center;
        animation: dialogLoaderRing 2s ease-in-out infinite;
      }

      @keyframes dialogLoaderRing {
        0%,
        100% {
          border-color: var(--g100, #c0dd97);
          transform: scale(1);
        }
        50% {
          border-color: var(--g400, #639922);
          transform: scale(1.08);
        }
      }

      .dialog-loader-icon {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        background: var(--g400, #639922);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .dialog-loader-icon mat-icon {
        color: #fff;
        font-size: 22px;
        width: 22px;
        height: 22px;
      }

      .dialog-loader-text {
        margin: 0;
        font-size: 12px;
        color: var(--text-secondary, #6b7280);
      }
    `,
  ],
})
export class ErpDialogShellComponent {
  @Input() title = '';
  @Input() subtitle = '';
  /** CSS length, e.g. `760px`. Defaults to shared add/edit popup size. */
  @Input() width = '760px';
  /** Shell max height (e.g. `94vh`). */
  @Input() maxHeight = '90vh';
  /** When false, body does not scroll — use for short / self-sized fee dialogs. */
  @Input() bodyScroll = true;
  @Input() showFooter = true;
  @Input() showSave = true;
  @Input() saveLabel = 'Save';
  @Input() savingLabel = 'Saving...';
  @Input() saveIcon = 'save';
  @Input() saveDisabled = false;
  @Input() saving = false;

  @Output() cancel = new EventEmitter<void>();
  @Output() save = new EventEmitter<void>();
}
