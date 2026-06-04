import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { AcademicYearContextService } from '../../../core/services/academic-year-context.service';

@Component({
  selector: 'app-scope-readonly-lock',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './scope-readonly-lock.component.html',
})
export class ScopeReadonlyLockComponent {
  readonly ayContext = inject(AcademicYearContextService);

  /** e.g. "add or edit leave" */
  @Input() actionLabel = 'add or edit records';
  @Input() message = '';
}
