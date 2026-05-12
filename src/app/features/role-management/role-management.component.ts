import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

interface RoleCategory {
  label: string;
  selected?: boolean;
}

interface Permission {
  name: string;
  key: string;
  enabled: boolean;
}

interface PermissionGroup {
  name: string;
  open: boolean;
  permissions: Permission[];
}

interface RoleModule {
  label: string;
  icon: string;
  groups: PermissionGroup[];
}

@Component({
  selector: 'app-role-management',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './role-management.component.html',
  styleUrl: './role-management.component.css',
})
export class RoleManagementComponent {
  activeTab: 'info' | 'permissions' = 'info';
  activeModuleIndex = 0;
  isDark = false;

  get tabSubtitle(): string {
    return this.activeTab === 'info' ? 'Basic role setup' : 'Menu-wise permissions';
  }

  trackModule(index: number, module: RoleModule): string {
    return `${index}-${module.label}`;
  }

  trackPermissionGroup(index: number, group: PermissionGroup): string {
    return `${this.activeModuleIndex}-${index}-${group.name}`;
  }

  readonly roleCategories: RoleCategory[] = [
    { label: 'Admin' },
    { label: 'Academic staff', selected: true },
    { label: 'Non-academic staff' },
    { label: 'Finance' },
    { label: 'Parent' },
    { label: 'Student' },
    { label: 'Custom' },
  ];

  readonly modules: RoleModule[] = [
    {
      label: 'Students',
      icon: 'groups',
      groups: [
        {
          name: 'View',
          open: true,
          permissions: [
            { name: 'View student list', key: 'student.read', enabled: true },
            { name: 'View student profile', key: 'student.read.profile', enabled: true },
          ],
        },
        {
          name: 'Manage',
          open: true,
          permissions: [
            { name: 'Add new student', key: 'student.create', enabled: true },
            { name: 'Edit student details', key: 'student.update', enabled: true },
            { name: 'Delete student', key: 'student.delete', enabled: false },
          ],
        },
        {
          name: 'Export',
          open: false,
          permissions: [
            { name: 'Export student list', key: 'student.export', enabled: false },
            { name: 'Download TC / documents', key: 'student.docs.download', enabled: false },
          ],
        },
      ],
    },
    {
      label: 'Attendance',
      icon: 'how_to_reg',
      groups: [
        {
          name: 'View',
          open: true,
          permissions: [{ name: 'View attendance records', key: 'attendance.read', enabled: true }],
        },
        {
          name: 'Manage',
          open: true,
          permissions: [
            { name: 'Mark daily attendance', key: 'attendance.mark', enabled: true },
            { name: 'Edit previous attendance', key: 'attendance.update', enabled: false },
          ],
        },
      ],
    },
    {
      label: 'Fees',
      icon: 'payments',
      groups: [
        {
          name: 'Collections',
          open: true,
          permissions: [
            { name: 'View fee ledger', key: 'fees.read', enabled: true },
            { name: 'Collect payment', key: 'fees.collect', enabled: true },
            { name: 'Apply concession', key: 'fees.concession', enabled: false },
          ],
        },
        {
          name: 'Reports',
          open: false,
          permissions: [
            { name: 'Export dues report', key: 'fees.report.export', enabled: false },
            { name: 'Send payment reminders', key: 'fees.reminder.send', enabled: true },
          ],
        },
      ],
    },
    {
      label: 'Exams',
      icon: 'workspace_premium',
      groups: [
        {
          name: 'Exam setup',
          open: true,
          permissions: [
            { name: 'View exam schedule', key: 'exam.read', enabled: false },
            { name: 'Create exam timetable', key: 'exam.create', enabled: false },
            { name: 'Publish result', key: 'exam.result.publish', enabled: false },
          ],
        },
      ],
    },
    {
      label: 'Teachers',
      icon: 'co_present',
      groups: [
        {
          name: 'Staff',
          open: true,
          permissions: [
            { name: 'View teacher list', key: 'teacher.read', enabled: false },
            { name: 'Assign class teacher', key: 'teacher.assign.class', enabled: false },
          ],
        },
      ],
    },
    {
      label: 'Library',
      icon: 'menu_book',
      groups: [
        {
          name: 'Books',
          open: true,
          permissions: [
            { name: 'View catalogue', key: 'library.read', enabled: false },
            { name: 'Issue book', key: 'library.issue', enabled: false },
          ],
        },
      ],
    },
    {
      label: 'Transport',
      icon: 'directions_bus',
      groups: [
        {
          name: 'Routes',
          open: true,
          permissions: [
            { name: 'View routes', key: 'transport.route.read', enabled: false },
            { name: 'Assign vehicle', key: 'transport.vehicle.assign', enabled: false },
          ],
        },
      ],
    },
    {
      label: 'Reports',
      icon: 'bar_chart',
      groups: [
        {
          name: 'Analytics',
          open: true,
          permissions: [
            { name: 'View dashboard reports', key: 'report.read', enabled: false },
            { name: 'Download reports', key: 'report.download', enabled: false },
          ],
        },
      ],
    },
    {
      label: 'Settings',
      icon: 'settings',
      groups: [
        {
          name: 'System',
          open: true,
          permissions: [
            { name: 'Manage school profile', key: 'settings.school.update', enabled: false },
            { name: 'Manage academic year', key: 'settings.year.update', enabled: false },
          ],
        },
      ],
    },
  ];

  get activeModule(): RoleModule {
    return this.modules[this.activeModuleIndex];
  }

  get totalEnabledPermissions(): number {
    return this.modules.reduce((sum, module) => sum + this.enabledCount(module), 0);
  }

  setTab(tab: 'info' | 'permissions'): void {
    this.activeTab = tab;
  }

  selectCategory(category: RoleCategory): void {
    this.roleCategories.forEach((item) => (item.selected = item === category));
  }

  selectModule(index: number): void {
    this.activeModuleIndex = index;
  }

  toggleGroup(group: PermissionGroup): void {
    group.open = !group.open;
  }

  togglePermission(permission: Permission): void {
    permission.enabled = !permission.enabled;
  }

  selectAllActiveModule(): void {
    const shouldEnable = this.enabledCount(this.activeModule) !== this.permissionCount(this.activeModule);
    this.activeModule.groups.forEach((group) =>
      group.permissions.forEach((permission) => (permission.enabled = shouldEnable)),
    );
  }

  enabledCount(module: RoleModule): number {
    return module.groups.reduce(
      (sum, group) => sum + group.permissions.filter((permission) => permission.enabled).length,
      0,
    );
  }

  permissionCount(module: RoleModule): number {
    return module.groups.reduce((sum, group) => sum + group.permissions.length, 0);
  }

  enabledGroupCount(group: PermissionGroup): number {
    return group.permissions.filter((permission) => permission.enabled).length;
  }
}
