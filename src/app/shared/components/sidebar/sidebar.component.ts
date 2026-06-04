import { Component, Output, EventEmitter, inject, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth.service';
import { PermissionService } from '../../../core/services/permission.service';
import { IMenu } from '../../../core/models/menu.model';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [MatIconModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
})
export class SidebarComponent {
  @Output() toggle = new EventEmitter<void>();

  private readonly auth = inject(AuthService);
  private readonly permissionService = inject(PermissionService);
  private readonly router = inject(Router);

  private readonly user = toSignal(this.auth.currentUser$, { initialValue: this.auth.currentUser });
  private readonly menus = toSignal(this.permissionService.menus$, {
    initialValue: this.permissionService.menus,
  });

  readonly visibleNavItems = computed(() => {
    const items = this.menus() ?? [];
    return items
      .map((item) => ({
        ...item,
        route: this.permissionService.resolveRoute(item) ?? item.route,
        children: (item.children ?? [])
          .filter((child) => this.permissionService.canView(child.code))
          .map((child) => ({
            ...child,
            route: this.permissionService.resolveRoute(child) ?? child.route,
          }))
          .filter((child) => !!child.route),
      }))
      .filter((item) => {
        if (item.route) {
          return this.permissionService.canView(item.code);
        }
        return (item.children?.length ?? 0) > 0;
      });
  });

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

  onToggle(): void {
    this.toggle.emit();
  }

  trackMenu(index: number, item: IMenu): string {
    return `${item.code}-${index}`;
  }

  hasChildren(item: IMenu): boolean {
    return (item.children?.length ?? 0) > 0;
  }

  navRoute(item: IMenu): string | null {
    return this.permissionService.resolveRoute(item);
  }

  onNavClick(item: IMenu, event: MouseEvent): void {
    const path = this.permissionService.resolveRoute(item);
    if (!path) {
      event.preventDefault();
      return;
    }
    void this.router.navigateByUrl(path);
  }
}
