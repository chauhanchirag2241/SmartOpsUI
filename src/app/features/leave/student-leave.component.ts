import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { LeaveService } from '../../core/services/leave.service';
import { NotificationService } from '../../core/services/notification.service';
import { refreshUi } from '../../core/utils/ui-refresh.util';
import { ListPageHeaderComponent } from '../../shared/components/list-page-header/list-page-header.component';
import { PageToolbarComponent } from '../../shared/components/page-toolbar/page-toolbar.component';
import { ScopeReadonlyLockComponent } from '../../shared/components/scope-readonly-lock/scope-readonly-lock.component';
import { asLeaveArray, leaveStatusBadgeClass, LeaveListItem } from './leave.shared';

@Component({
  selector: 'app-student-leave',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    ListPageHeaderComponent,
    PageToolbarComponent,
    ScopeReadonlyLockComponent,
  ],
  templateUrl: './student-leave.component.html',
  styleUrl: './workflow-page.shared.css',
})
export class StudentLeaveComponent implements OnInit {
  private readonly leaveService = inject(LeaveService);
  private readonly notify = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);

  items: LeaveListItem[] = [];
  statusFilter = '';
  loading = false;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    refreshUi(this.cdr);
    this.leaveService.getStudentList(this.statusFilter || undefined).subscribe({
      next: (data) => {
        this.items = asLeaveArray(data);
        this.loading = false;
        refreshUi(this.cdr);
      },
      error: (err) => {
        this.notify.error(typeof err?.error === 'string' ? err.error : 'Failed to load student leave');
        this.loading = false;
        refreshUi(this.cdr);
      },
    });
  }

  badgeClass(status: string): string {
    return leaveStatusBadgeClass(status);
  }
}
