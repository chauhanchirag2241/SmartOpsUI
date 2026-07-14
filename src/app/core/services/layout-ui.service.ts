import { Injectable, computed, signal } from '@angular/core';

const PINNED_KEY = 'sidebar-pinned';

@Injectable({ providedIn: 'root' })
export class LayoutUiService {
  /** When true, sidebar stays expanded with labels (locked). */
  readonly sidebarPinned = signal(this.readPinned());

  /** Transient expand from hover (ignored when pinned). */
  readonly sidebarHovered = signal(false);

  /** Labels visible when pinned or hovered. */
  readonly sidebarExpanded = computed(() => this.sidebarPinned() || this.sidebarHovered());

  /** Sidebar rail is always present. */
  readonly sidebarOpened = signal(true);

  togglePin(): void {
    this.sidebarPinned.update((pinned) => {
      const next = !pinned;
      this.persistPinned(next);
      if (next) {
        this.sidebarHovered.set(false);
      }
      return next;
    });
  }

  setPinned(pinned: boolean): void {
    this.sidebarPinned.set(pinned);
    this.persistPinned(pinned);
    if (pinned) {
      this.sidebarHovered.set(false);
    }
  }

  setHovered(hovered: boolean): void {
    // When pinned, stay expanded — ignore hover collapse
    if (this.sidebarPinned()) {
      return;
    }
    this.sidebarHovered.set(hovered);
  }

  toggleSidebar(): void {
    this.togglePin();
  }

  setSidebarOpened(open: boolean): void {
    this.setPinned(open);
  }

  private readPinned(): boolean {
    try {
      return localStorage.getItem(PINNED_KEY) === '1';
    } catch {
      return false;
    }
  }

  private persistPinned(pinned: boolean): void {
    try {
      localStorage.setItem(PINNED_KEY, pinned ? '1' : '0');
    } catch {
      // ignore
    }
  }
}
