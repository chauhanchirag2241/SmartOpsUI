import { Injectable, computed, inject, signal } from '@angular/core';
import { BranchApiService, BranchDropdownItem } from './branch-api.service';
import { AuthService } from './auth.service';
import { StorageService } from './storage.service';

const ACTIVE_BRANCH_KEY = 'erp_active_branch';
const SELECTED_BRANCHES_KEY = 'erp_selected_branches';

@Injectable({ providedIn: 'root' })
export class BranchContextService {
  private readonly branchApi = inject(BranchApiService);
  private readonly auth = inject(AuthService);
  private readonly storage = inject(StorageService);

  private readonly _branches = signal<BranchDropdownItem[]>([]);
  private readonly _canViewAllBranches = signal(false);
  private readonly _activeBranchId = signal<string | null>(this.readStoredActiveBranchId());
  private readonly _selectedBranchIds = signal<string[]>(this.readStoredSelectedBranchIds());
  private readonly _searchTerm = signal('');

  readonly branches = this._branches.asReadonly();
  readonly canViewAllBranches = this._canViewAllBranches.asReadonly();
  readonly activeBranchId = this._activeBranchId.asReadonly();
  readonly selectedBranchIds = this._selectedBranchIds.asReadonly();
  readonly searchTerm = this._searchTerm.asReadonly();

  readonly filteredBranches = computed(() => {
    const term = this._searchTerm().trim().toLowerCase();
    const list = this._branches();
    if (!term) {
      return list;
    }
    return list.filter((b) => b.name.toLowerCase().includes(term));
  });

  readonly effectiveBranchKey = computed(
    () => this._activeBranchId() ?? this._branches()[0]?.id ?? 'none',
  );

  loadBranches(): void {
    if (!this.auth.isLoggedIn) {
      return;
    }

    this.branchApi.getMyBranches().subscribe({
      next: (response) => {
        this._branches.set(response.branches ?? []);
        this._canViewAllBranches.set(!!response.canViewAllBranches);
        this.ensureValidActiveBranch();
      },
    });
  }

  setSearchTerm(term: string): void {
    this._searchTerm.set(term);
  }

  switchBranch(branchId: string): void {
    if (!branchId || !this._branches().some((b) => b.id === branchId)) {
      return;
    }
    this._activeBranchId.set(branchId);
    this.storage.set(ACTIVE_BRANCH_KEY, branchId);
    if (!this._selectedBranchIds().includes(branchId)) {
      this.setSelectedBranches([branchId]);
    }
  }

  toggleSelectedBranch(branchId: string): void {
    const current = new Set(this._selectedBranchIds());
    if (current.has(branchId)) {
      current.delete(branchId);
    } else {
      current.add(branchId);
    }
    const next = [...current];
    if (next.length === 0 && this._activeBranchId()) {
      next.push(this._activeBranchId()!);
    }
    this.setSelectedBranches(next);
  }

  setSelectedBranches(branchIds: string[]): void {
    const allowed = new Set(this._branches().map((b) => b.id));
    const filtered = branchIds.filter((id) => allowed.has(id));
    const resolved = filtered.length > 0 ? filtered : this._activeBranchId() ? [this._activeBranchId()!] : [];
    this._selectedBranchIds.set(resolved);
    this.storage.set(SELECTED_BRANCHES_KEY, JSON.stringify(resolved));
  }

  activeBranchLabel(): string {
    const id = this._activeBranchId();
    const branch = this._branches().find((b) => b.id === id);
    return branch?.name ?? 'Branch';
  }

  clear(): void {
    this._branches.set([]);
    this._canViewAllBranches.set(false);
    this._activeBranchId.set(null);
    this._selectedBranchIds.set([]);
    this._searchTerm.set('');
    this.storage.remove(ACTIVE_BRANCH_KEY);
    this.storage.remove(SELECTED_BRANCHES_KEY);
  }

  private ensureValidActiveBranch(): void {
    const list = this._branches();
    if (list.length === 0) {
      this._activeBranchId.set(null);
      return;
    }

    const stored = this._activeBranchId();
    if (stored && list.some((b) => b.id === stored)) {
      return;
    }

    const defaultBranch = list.find((b) => b.isDefault) ?? list.find((b) => b.isHeadOffice) ?? list[0];
    this.switchBranch(defaultBranch.id);

    if (this._selectedBranchIds().length === 0) {
      this.setSelectedBranches([defaultBranch.id]);
    }
  }

  private readStoredActiveBranchId(): string | null {
    const raw = this.storage.get<string>(ACTIVE_BRANCH_KEY);
    return typeof raw === 'string' && raw.length > 0 ? raw : null;
  }

  private readStoredSelectedBranchIds(): string[] {
    const raw = this.storage.get<string[]>(SELECTED_BRANCHES_KEY);
    return Array.isArray(raw) ? raw : [];
  }
}
