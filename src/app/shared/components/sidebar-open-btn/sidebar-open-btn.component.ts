import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { LayoutUiService } from '../../../core/services/layout-ui.service';

@Component({
  selector: 'app-sidebar-open-btn',
  imports: [MatButtonModule, MatIconModule],
  template: `
    @if (!layoutUi.sidebarOpened()) {
      <button
        type="button"
        class="sidebar-open-btn"
        (click)="layoutUi.toggleSidebar()"
        aria-label="Open menu"
      >
        <mat-icon>read_more</mat-icon>
      </button>
    }
  `,
})
export class SidebarOpenBtnComponent {
  readonly layoutUi = inject(LayoutUiService);
}
