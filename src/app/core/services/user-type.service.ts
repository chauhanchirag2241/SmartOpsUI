import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface UserTypeDto {
  id: string;
  code: string;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class UserTypeService {
  private readonly api = inject(ApiService);

  getUserTypes(): Observable<UserTypeDto[]> {
    return this.api.get<UserTypeDto[]>('user-types');
  }
}
