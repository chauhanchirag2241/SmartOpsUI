import { Component, Output, EventEmitter, inject, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth.service';
import { NAV_ITEMS, NavItemConfig } from '../../../core/config/nav.config';
import { canShowNavItem } from '../../../core/utils/permission-ui.util';

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

  /** Re-computes when login completes and permissions are stored. */
  private readonly user = toSignal(this.auth.currentUser$, { initialValue: this.auth.currentUser });

  readonly visibleNavItems = computed(() => {
    const _ = this.user();
    return NAV_ITEMS.filter((item) =>
      canShowNavItem(this.auth, item.permissions, item.permission),
    );
  });

  readonly displayRole = computed(() => {
    const roles = this.user()?.roles ?? [];
    return roles[0] ?? this.user()?.role ?? 'User';
  });

  readonly displayName = computed(() => this.user()?.name ?? 'User');

  onToggle(): void {
    this.toggle.emit();
  }

  trackNavItem(index: number, item: NavItemConfig): string {
    return `${item.route}-${index}`;
  }
}
