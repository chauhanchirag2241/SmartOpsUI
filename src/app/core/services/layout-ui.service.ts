import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LayoutUiService {
  readonly sidebarOpened = signal(true);

  toggleSidebar(): void {
    this.sidebarOpened.update((open) => !open);
  }

  setSidebarOpened(open: boolean): void {
    this.sidebarOpened.set(open);
  }
}
