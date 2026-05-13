import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  section?: string;
  badge?: string;
  danger?: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [MatIconModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
})
export class SidebarComponent {
  trackNavItem(index: number, item: NavItem): string {
    return `${item.route}-${index}`;
  }

  readonly navItems: NavItem[] = [
    { section: 'Overview', label: 'Dashboard', icon: 'grid_view', route: '/dashboard' },
    { section: 'Academics', label: 'Students', icon: 'group', route: '/students', badge: '248' },
    { label: 'Classes', icon: 'domain', route: '/classes' },
    { label: 'Subjects', icon: 'school', route: '/subjects' },
    { label: 'Teachers', icon: 'co_present', route: '/teachers', badge: '18' },
    { label: 'Attendance', icon: 'person_check', route: '/attendance' },
    { label: 'Exams', icon: 'workspace_premium', route: '/exams' },
    { section: 'Finance', label: 'Fees', icon: 'payments', route: '/fees', badge: '32', danger: true },
    { label: 'Payroll', icon: 'price_check', route: '/payroll' },
    { section: 'Other', label: 'Library', icon: 'menu_book', route: '/library' },
    { label: 'Transport', icon: 'directions_bus', route: '/transport' },
    { label: 'Branches', icon: 'apartment', route: '/branches' },
    { label: 'Roles', icon: 'admin_panel_settings', route: '/roles' },
    { label: 'Settings', icon: 'settings', route: '/settings' },
  ];
}
