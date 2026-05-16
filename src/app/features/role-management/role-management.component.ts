import { Component, OnInit, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { forkJoin } from 'rxjs';
import { PermissionDto, RoleDto, RoleService } from '../../core/services/role.service';

interface RoleCategory {
  label: string;
  roleId?: string;
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
export class RoleManagementComponent implements OnInit {
  private readonly roleService = inject(RoleService);

  activeTab: 'info' | 'permissions' = 'permissions';
  activeModuleIndex = 0;
  isDark = false;
  loading = true;
  saving = false;
  errorMessage = '';

  roleCategories: RoleCategory[] = [];
  allPermissions: PermissionDto[] = [];
  selectedRole: RoleDto | null = null;

  readonly modules: RoleModule[] = [
    { label: 'Students', icon: 'groups', groups: [] },
    { label: 'Attendance', icon: 'how_to_reg', groups: [] },
    { label: 'Fees', icon: 'payments', groups: [] },
    { label: 'Exams', icon: 'workspace_premium', groups: [] },
    { label: 'Teachers', icon: 'co_present', groups: [] },
    { label: 'HR & Admin', icon: 'settings', groups: [] },
  ];

  ngOnInit(): void {
    forkJoin({
      roles: this.roleService.getRoles(),
      permissions: this.roleService.getPermissions(),
    }).subscribe({
      next: ({ roles, permissions }) => {
        this.allPermissions = permissions;
        this.roleCategories = roles.map((r, index) => ({
          label: r.name,
          roleId: r.id,
          selected: index === 0,
        }));
        this.buildPermissionModules(permissions);
        const first = roles[0];
        if (first) {
          this.selectRoleById(first.id, first);
        }
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Failed to load roles and permissions.';
        this.loading = false;
      },
    });
  }

  get tabSubtitle(): string {
    return this.activeTab === 'info' ? 'Basic role setup' : 'Menu-wise permissions';
  }

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
    if (category.roleId) {
      this.roleService.getRole(category.roleId).subscribe({
        next: (role) => this.applyRolePermissions(role),
        error: () => (this.errorMessage = 'Failed to load role.'),
      });
    }
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

  savePermissions(): void {
    if (!this.selectedRole) {
      return;
    }

    const permissionNames = this.modules
      .flatMap((m) => m.groups)
      .flatMap((g) => g.permissions)
      .filter((p) => p.enabled)
      .map((p) => p.key);

    this.saving = true;
    this.roleService.updateRolePermissions(this.selectedRole.id, permissionNames).subscribe({
      next: () => {
        this.saving = false;
        this.selectedRole = { ...this.selectedRole!, permissions: permissionNames };
      },
      error: () => {
        this.saving = false;
        this.errorMessage = 'Failed to save permissions.';
      },
    });
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

  trackModule(index: number, module: RoleModule): string {
    return `${index}-${module.label}`;
  }

  trackPermissionGroup(index: number, group: PermissionGroup): string {
    return `${this.activeModuleIndex}-${index}-${group.name}`;
  }

  private selectRoleById(id: string, role?: RoleDto): void {
    if (role) {
      this.applyRolePermissions(role);
      return;
    }
    this.roleService.getRole(id).subscribe({
      next: (r) => this.applyRolePermissions(r),
    });
  }

  private applyRolePermissions(role: RoleDto): void {
    this.selectedRole = role;
    const enabledSet = new Set(role.permissions ?? []);
    this.modules.forEach((module) => {
      module.groups.forEach((group) => {
        group.permissions.forEach((p) => {
          p.enabled = enabledSet.has(p.key);
        });
      });
    });
  }

  private buildPermissionModules(permissions: PermissionDto[]): void {
    const prefixMap: Record<string, number> = {
      student: 0,
      attendance: 1,
      fees: 2,
      exam: 2,
      exams: 2,
      teacher: 4,
      hr: 5,
      admin: 5,
      class: 5,
      subject: 5,
      academicyear: 5,
      roles: 5,
      settings: 5,
      reports: 5,
    };

    this.modules.forEach((m) => (m.groups = []));

    for (const perm of permissions) {
      const prefix = perm.name.split('.')[0] ?? 'other';
      const moduleIndex = prefixMap[prefix] ?? 5;
      const module = this.modules[moduleIndex];
      let group = module.groups.find((g) => g.name === 'Permissions');
      if (!group) {
        group = { name: 'Permissions', open: true, permissions: [] };
        module.groups.push(group);
      }
      group.permissions.push({
        name: perm.description ?? perm.name,
        key: perm.name,
        enabled: false,
      });
    }
  }
}
