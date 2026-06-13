import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface DepartmentDto {
  id: string;
  name: string;
  code?: string;
  isActive?: boolean;
}

@Injectable({ providedIn: 'root' })
export class DepartmentService {
  private readonly api = inject(ApiService);

  getDepartments(): Observable<DepartmentDto[]> {
    return this.api.get<DepartmentDto[]>('departments');
  }
}
