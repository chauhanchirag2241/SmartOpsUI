import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { forkJoin } from 'rxjs';
import { SchoolUserDto, UserService } from '../../../core/services/user.service';
import { UserTypeDto, UserTypeService } from '../../../core/services/user-type.service';
import { MultiSelectChipsComponent } from '../../../shared/components/multi-select-chips/multi-select-chips.component';
import { MappingOption } from '../../../shared/mapping/mapping.types';

export interface RoleAssignStagedUser {
  id: string;
  username: string;
  email: string;
  userTypeName: string;
}

@Component({
  selector: 'app-assign-role-users-form',
  standalone: true,
  imports: [CommonModule, MatIconModule, MultiSelectChipsComponent],
  templateUrl: './assign-role-users-form.component.html',
  styleUrl: './assign-role-users-form.component.css',
})
export class AssignRoleUsersFormComponent implements OnInit {
  /** User IDs already mapped to the role (excluded from picker). */
  @Input() excludeUserIds: string[] = [];

  @Output() saved = new EventEmitter<string[]>();
  @Output() busyChange = new EventEmitter<boolean>();
  @Output() stagedCountChange = new EventEmitter<number>();

  private readonly userService = inject(UserService);
  private readonly userTypeService = inject(UserTypeService);
  private readonly cdr = inject(ChangeDetectorRef);

  loading = true;
  loadError = '';
  allUsers: SchoolUserDto[] = [];
  userTypeOptions: MappingOption[] = [];
  selectedUserTypeIds: string[] = [];
  pendingUserIds: string[] = [];
  staged: RoleAssignStagedUser[] = [];

  get userOptions(): MappingOption[] {
    const exclude = new Set([
      ...this.excludeUserIds,
      ...this.staged.map((s) => s.id),
    ]);
    const typeFilter = new Set(this.selectedUserTypeIds);
    return this.allUsers
      .filter((u) => {
        if (exclude.has(u.id)) return false;
        if (!typeFilter.size) return false;
        return !!u.userTypeId && typeFilter.has(u.userTypeId);
      })
      .map((u) => ({
        id: u.id,
        name: `${u.username}${u.email ? ` (${u.email})` : ''}`,
      }));
  }

  ngOnInit(): void {
    this.busyChange.emit(true);
    forkJoin({
      users: this.userService.getUsers(),
      types: this.userTypeService.getUserTypes(),
    }).subscribe({
      next: ({ users, types }) => {
        this.allUsers = users ?? [];
        this.userTypeOptions = (types ?? []).map((t: UserTypeDto) => ({
          id: t.id,
          name: t.name || t.code,
        }));
        this.loading = false;
        this.busyChange.emit(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadError = 'Failed to load users.';
        this.loading = false;
        this.busyChange.emit(false);
        this.cdr.markForCheck();
      },
    });
  }

  onUserTypeIdsChange(ids: string[]): void {
    this.selectedUserTypeIds = ids;
    const allowed = new Set(this.userOptions.map((o) => o.id));
    this.pendingUserIds = this.pendingUserIds.filter((id) => allowed.has(id));
    this.cdr.markForCheck();
  }

  onPendingUserIdsChange(ids: string[]): void {
    this.pendingUserIds = ids;
    this.cdr.markForCheck();
  }

  addPendingUsers(): void {
    if (!this.pendingUserIds.length) return;
    const byId = new Map(this.allUsers.map((u) => [u.id, u]));
    const stagedIds = new Set(this.staged.map((s) => s.id));
    for (const id of this.pendingUserIds) {
      if (stagedIds.has(id)) continue;
      const u = byId.get(id);
      if (!u) continue;
      this.staged = [
        ...this.staged,
        {
          id: u.id,
          username: u.username,
          email: u.email,
          userTypeName: u.userTypeName || u.userTypeCode || '—',
        },
      ];
      stagedIds.add(id);
    }
    this.pendingUserIds = [];
    this.stagedCountChange.emit(this.staged.length);
    this.cdr.markForCheck();
  }

  removeStaged(id: string): void {
    this.staged = this.staged.filter((s) => s.id !== id);
    this.stagedCountChange.emit(this.staged.length);
    this.cdr.markForCheck();
  }

  /** Called by dialog shell Save. */
  save(): void {
    if (!this.staged.length) return;
    this.saved.emit(this.staged.map((s) => s.id));
  }
}
