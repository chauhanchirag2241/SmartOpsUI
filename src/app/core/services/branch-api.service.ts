import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface BranchDropdownItem {
  id: string;
  name: string;
  isHeadOffice: boolean;
  isDefault: boolean;
}

export interface MyBranchesResponse {
  branches: BranchDropdownItem[];
  canViewAllBranches: boolean;
}

@Injectable({ providedIn: 'root' })
export class BranchApiService {
  private readonly api = inject(ApiService);

  getMyBranches(): Observable<MyBranchesResponse> {
    return this.api.get<MyBranchesResponse>('branches/my');
  }

  getSchoolBranches(schoolId: string): Observable<BranchDropdownItem[]> {
    return this.api.get<BranchDropdownItem[]>(`branches/school/${schoolId}`);
  }

  getUserBranches(userId: string): Observable<BranchDropdownItem[]> {
    return this.api.get<BranchDropdownItem[]>(`branches/users/${userId}`);
  }

  setUserBranches(
    userId: string,
    branchIds: string[],
    defaultBranchId?: string | null,
  ): Observable<void> {
    return this.api.put<void>(`branches/users/${userId}`, {
      branchIds,
      defaultBranchId: defaultBranchId ?? null,
    });
  }
}
