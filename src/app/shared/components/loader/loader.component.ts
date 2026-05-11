import { NgIf } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-loader',
  imports: [MatProgressSpinnerModule, NgIf],
  template: `
    <div class="loader-overlay" *ngIf="loading">
      <mat-spinner diameter="48"></mat-spinner>
    </div>
  `,
  styles: [`
    .loader-overlay {
      align-items: center;
      background: rgba(255, 255, 255, 0.72);
      display: flex;
      inset: 0;
      justify-content: center;
      position: fixed;
      z-index: 9999;
    }
  `],
})
export class LoaderComponent {
  @Input() loading = false;
}
