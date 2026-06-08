import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { NotificationService } from '../../../core/services/notification.service';
import { finalize } from 'rxjs';
import { MenuCodes } from '../../../core/constants/menu-codes';
import { PermissionService } from '../../../core/services/permission.service';
import { TenantService } from '../../../core/services/tenant.service';
import { RoleDto, RoleService } from '../../../core/services/role.service';
import { UserService } from '../../../core/services/user.service';
import { UserTypeDto, UserTypeService } from '../../../core/services/user-type.service';

const FALLBACK_ROLES = ['Admin'];

@Component({
  selector: 'app-add-user',
  standalone: true,
  imports: [ReactiveFormsModule, MatIconModule],
  templateUrl: './add-user.component.html',
  styleUrl: './add-user.component.css',
})
export class AddUserComponent implements OnInit {
  @Input() mode: 'add' | 'edit' | 'view' = 'add';
  @Input() userId?: string;
  @Output() cancel = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly userTypeService = inject(UserTypeService);
  private readonly roleService = inject(RoleService);
  private readonly permissionService = inject(PermissionService);
  private readonly tenant = inject(TenantService);
  private readonly snackBar = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);

  form!: FormGroup;
  roles: RoleDto[] = [];
  userTypes: UserTypeDto[] = [];
  selectedRoles = new Set<string>();
  isSaving = false;
  loading = false;
  rolesLoading = false;
  rolesLoadError = '';

  get canEdit(): boolean {
    return this.mode !== 'view' && this.permissionService.canEdit(MenuCodes.Users);
  }

  get schoolReady(): boolean {
    return this.tenant.isReady;
  }

  get selectedSchoolName(): string {
    return this.tenant.school?.name ?? '';
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      username: ['', [Validators.required, Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(256)]],
      password: [''],
      userTypeId: ['', Validators.required],
      isActive: [true],
      lockoutEnabled: [true],
    });

    if (this.mode === 'add') {
      this.form.get('password')?.setValidators([Validators.required, Validators.minLength(8)]);
    }

    if (this.userId && this.mode !== 'add') {
      this.loading = true;
      this.loadUser(this.userId);
    }

    this.loadRoles();
    this.loadUserTypes();
  }

  private loadUserTypes(): void {
    this.userTypeService.getUserTypes().subscribe({
      next: (types) => {
        this.userTypes = types;
        this.cdr.markForCheck();
      },
    });
  }

  private loadRoles(): void {
    this.rolesLoading = true;
    this.roleService
      .getRoles()
      .pipe(
        finalize(() => {
          this.rolesLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (roles) => {
          this.roles = roles.filter((r) => r.name !== 'PlatformAdmin');
          this.rolesLoadError = '';
        },
        error: () => {
          this.rolesLoadError = 'Could not load roles from server. Using defaults.';
          this.roles = FALLBACK_ROLES.map((name, i) => ({
            id: `fallback-${i}`,
            name,
            code: name.toUpperCase(),
            menuPermissions: [],
            dashboardWidgetPermissions: [],
          }));
        },
      });
  }

  toggleRole(name: string): void {
    if (!this.canEdit) return;
    if (this.selectedRoles.has(name)) {
      this.selectedRoles.delete(name);
    } else {
      this.selectedRoles.add(name);
    }
    this.cdr.markForCheck();
  }

  isRoleSelected(name: string): boolean {
    return this.selectedRoles.has(name);
  }

  onCancel(): void {
    this.cancel.emit();
  }

  onSubmit(): void {
    if (!this.schoolReady) {
      this.snackBar.open('Select a school before creating a user', 'Close', {
        duration: 3000,
        panelClass: 'snack-info',
      });
      return;
    }

    if (!this.canEdit || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.selectedRoles.size === 0) {
      this.snackBar.open('Select at least one role', 'Close', { duration: 3000, panelClass: 'snack-error' });
      return;
    }

    const { username, email, password, userTypeId, isActive, lockoutEnabled } = this.form.getRawValue();
    const roleNames = [...this.selectedRoles];
    this.isSaving = true;

    if (this.mode === 'add') {
      this.userService
        .createUser({
          username: String(username).trim(),
          email: String(email).trim(),
          password: String(password),
          userTypeId: String(userTypeId),
          isActive: !!isActive,
          lockoutEnabled: !!lockoutEnabled,
          roleNames,
        })
        .subscribe({
          next: () => {
            this.isSaving = false;
            this.snackBar.open('User created successfully', 'Close', {
              duration: 3000,
              panelClass: 'snack-success',
            });
            this.saved.emit();
          },
          error: (err) => {
            this.isSaving = false;
            const msg = err?.error?.title ?? err?.error ?? 'Failed to create user';
            this.snackBar.open(String(msg), 'Close', { duration: 4000, panelClass: 'snack-error' });
            this.cdr.markForCheck();
          },
        });
      return;
    }

    if (!this.userId) return;

    this.userService
      .updateUser(this.userId, {
        username: String(username).trim(),
        email: String(email).trim(),
        userTypeId: String(userTypeId) || undefined,
        isActive: !!isActive,
        lockoutEnabled: !!lockoutEnabled,
      })
      .subscribe({
        next: () => {
          this.userService.updateUserRoles(this.userId!, roleNames).subscribe({
            next: () => {
              if (password) {
                this.userService.resetPassword(this.userId!, String(password)).subscribe({
                  next: () => this.finishSave(),
                  error: () => this.finishSave(),
                });
              } else {
                this.finishSave();
              }
            },
            error: () => {
              this.isSaving = false;
              this.snackBar.open('Failed to update roles', 'Close', { duration: 3000, panelClass: 'snack-error' });
              this.cdr.markForCheck();
            },
          });
        },
        error: () => {
          this.isSaving = false;
          this.snackBar.open('Failed to update user', 'Close', { duration: 3000, panelClass: 'snack-error' });
          this.cdr.markForCheck();
        },
      });
  }

  showError(controlName: string): boolean {
    const c = this.form.get(controlName);
    return !!(c && c.invalid && (c.dirty || c.touched));
  }

  private loadUser(id: string): void {
    this.userService.getUser(id).subscribe({
      next: (user) => {
        this.form.patchValue({
          username: user.username,
          email: user.email,
          userTypeId: user.userTypeId ?? '',
          isActive: user.isActive,
          lockoutEnabled: user.lockoutEnabled ?? true,
        });
        this.selectedRoles = new Set(user.roles ?? []);
        if (!this.canEdit) {
          this.form.disable();
        }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.snackBar.open('Failed to load user', 'Close', { duration: 3000, panelClass: 'snack-error' });
        this.cdr.markForCheck();
      },
    });
  }

  private finishSave(): void {
    this.isSaving = false;
    this.snackBar.open('User updated', 'Close', { duration: 3000, panelClass: 'snack-success' });
    this.saved.emit();
  }
}
