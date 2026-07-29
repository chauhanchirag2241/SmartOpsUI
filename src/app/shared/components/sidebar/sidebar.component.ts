import { Component, inject, computed, signal, effect, untracked, HostListener } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { filter } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { PermissionService } from '../../../core/services/permission.service';
import { LayoutUiService } from '../../../core/services/layout-ui.service';
import { IMenu } from '../../../core/models/menu.model';

const EXPANDED_GROUPS_KEY = 'sidebar-expanded-groups';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
  host: {
    '[class.labels-visible]': 'labelsVisible()',
    '[class.rail-mode]': '!labelsVisible()',
    '(mouseenter)': 'onRailEnter()',
    '(mouseleave)': 'onRailLeave()',
  },
})
export class SidebarComponent {
  private readonly auth = inject(AuthService);
  private readonly permissionService = inject(PermissionService);
  private readonly layoutUi = inject(LayoutUiService);
  private readonly router = inject(Router);

  private readonly user = toSignal(this.auth.currentUser$, { initialValue: this.auth.currentUser });
  private readonly menus = toSignal(this.permissionService.menus$, {
    initialValue: this.permissionService.menus,
  });

  private readonly currentUrl = signal(this.router.url);
  private readonly expandedCodes = signal<Set<string>>(this.readExpandedGroups());
  /** Codes the user manually collapsed while still on an active child route. */
  private readonly userCollapsedCodes = signal<Set<string>>(new Set());
  /** Group flyout while in icon-rail mode */
  readonly flyoutCode = signal<string | null>(null);
  private leaveTimer: ReturnType<typeof setTimeout> | null = null;
  private enterTimer: ReturnType<typeof setTimeout> | null = null;

  readonly labelsVisible = this.layoutUi.sidebarExpanded;
  readonly pinned = this.layoutUi.sidebarPinned;

  readonly visibleNavItems = computed(() => this.filterVisibleMenus(this.menus() ?? []));

  readonly displayRole = computed(() => {
    const roles = this.user()?.roles ?? [];
    return roles[0] ?? this.user()?.role ?? 'User';
  });

  readonly displayName = computed(() => this.user()?.name ?? 'User');

  readonly initials = computed(() => {
    const name = this.displayName();
    const parts = name.split(' ').filter(Boolean);
    if (parts.length > 1) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  });

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.currentUrl.set(e.urlAfterRedirects);
        this.flyoutCode.set(null);
        // New navigation may leave a previously collapsed group — clear override so new parents open
        this.userCollapsedCodes.set(new Set());
        this.expandAncestorsForActiveRoute();
      });

    // Auto-open parents for the active route when menus load — never when user toggles collapse
    effect(() => {
      void this.visibleNavItems();
      void this.currentUrl();
      untracked(() => this.expandAncestorsForActiveRoute());
    });

    // Close flyout when labels expand (accordion takes over)
    effect(() => {
      if (this.labelsVisible()) {
        this.flyoutCode.set(null);
      }
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.flyoutCode()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.nav-group, .nav-flyout')) return;
    this.flyoutCode.set(null);
  }

  onRailEnter(): void {
    if (this.leaveTimer) {
      clearTimeout(this.leaveTimer);
      this.leaveTimer = null;
    }
    if (this.enterTimer) {
      clearTimeout(this.enterTimer);
    }
    // Small delay so brush-by doesn't flash-open
    this.enterTimer = setTimeout(() => {
      this.layoutUi.setHovered(true);
      this.enterTimer = null;
    }, 90);
  }

  onRailLeave(): void {
    if (this.enterTimer) {
      clearTimeout(this.enterTimer);
      this.enterTimer = null;
    }
    // Pinned stays open — no collapse on mouse leave
    if (this.layoutUi.sidebarPinned()) {
      return;
    }
    this.leaveTimer = setTimeout(() => {
      this.layoutUi.setHovered(false);
      this.flyoutCode.set(null);
      this.leaveTimer = null;
    }, 420);
  }

  onTogglePin(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.layoutUi.togglePin();
  }

  trackMenu(index: number, item: IMenu): string {
    return `${item.code}-${index}`;
  }

  hasChildren(item: IMenu): boolean {
    return (item.children?.length ?? 0) > 0;
  }

  isExpanded(code: string): boolean {
    return this.expandedCodes().has(code);
  }

  isGroupActive(item: IMenu): boolean {
    return this.menuTreeContainsActive(item.children ?? [], this.currentUrl());
  }

  isFlyoutOpen(code: string): boolean {
    return this.flyoutCode() === code;
  }

  onGroupClick(item: IMenu, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (!this.labelsVisible()) {
      // Icon rail: toggle flyout for children
      this.flyoutCode.update((current) => (current === item.code ? null : item.code));
      return;
    }

    this.toggleGroup(item.code);
  }

  toggleGroup(code: string): void {
    const collapsed = new Set(this.userCollapsedCodes());
    // Accordion: at most one parent group open at a time
    if (this.expandedCodes().has(code)) {
      collapsed.add(code);
      this.userCollapsedCodes.set(collapsed);
      const next = new Set<string>();
      this.expandedCodes.set(next);
      this.persistExpandedGroups(next);
      return;
    }

    collapsed.delete(code);
    this.userCollapsedCodes.set(collapsed);
    const next = new Set([code]);
    this.expandedCodes.set(next);
    this.persistExpandedGroups(next);
  }

  navRoute(item: IMenu): string | null {
    return this.permissionService.resolveRoute(item);
  }

  isLinkActive(item: IMenu): boolean {
    const path = this.navRoute(item);
    if (!path) return false;
    return this.urlMatches(path, this.currentUrl());
  }

  onNavClick(item: IMenu, event: MouseEvent): void {
    event.preventDefault();
    const path = this.permissionService.resolveRoute(item);
    if (!path) {
      return;
    }
    this.flyoutCode.set(null);
    void this.router.navigateByUrl(path);
  }

  private filterVisibleMenus(items: IMenu[]): IMenu[] {
    return items
      .map((item) => {
        const children = this.filterVisibleMenus(item.children ?? []).sort(
          (a, b) => a.displayOrder - b.displayOrder,
        );
        const route = this.permissionService.resolveRoute(item) ?? item.route ?? null;
        return { ...item, route, children };
      })
      .filter((item) => {
        if (item.children.length > 0) {
          return true;
        }
        if (item.route) {
          return this.permissionService.canView(item.code);
        }
        return false;
      })
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }

  private expandAncestorsForActiveRoute(): void {
    const url = this.currentUrl();
    const activeCodes = this.findAncestorCodes(this.visibleNavItems(), url);
    if (!activeCodes.length) return;

    const skipped = this.userCollapsedCodes();
    // Accordion: only the active route's ancestors stay open
    const next = new Set(activeCodes.filter((code) => !skipped.has(code)));
    const current = this.expandedCodes();
    const unchanged =
      next.size === current.size && [...next].every((code) => current.has(code));
    if (!unchanged) {
      this.expandedCodes.set(next);
      this.persistExpandedGroups(next);
    }
  }

  private findAncestorCodes(items: IMenu[], url: string): string[] {
    for (const item of items) {
      if (!item.children?.length) {
        continue;
      }
      if (this.menuTreeContainsActive(item.children, url)) {
        return [item.code, ...this.findAncestorCodes(item.children, url)];
      }
    }
    return [];
  }

  private menuTreeContainsActive(items: IMenu[], url: string): boolean {
    for (const item of items) {
      const path = this.navRoute(item);
      if (path && this.urlMatches(path, url)) {
        return true;
      }
      if (item.children?.length && this.menuTreeContainsActive(item.children, url)) {
        return true;
      }
    }
    return false;
  }

  private urlMatches(path: string, url: string): boolean {
    if (path === '/dashboard') {
      return url === '/dashboard' || url.startsWith('/dashboard?');
    }
    return url === path || url.startsWith(path + '/') || url.startsWith(path + '?');
  }

  private readExpandedGroups(): Set<string> {
    try {
      const raw = localStorage.getItem(EXPANDED_GROUPS_KEY);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw) as string[];
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  }

  private persistExpandedGroups(codes: Set<string>): void {
    try {
      localStorage.setItem(EXPANDED_GROUPS_KEY, JSON.stringify([...codes]));
    } catch {
      // ignore quota / private mode
    }
  }
}
