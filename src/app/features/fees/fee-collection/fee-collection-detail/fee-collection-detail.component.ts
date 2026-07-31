import {
  Component,
  OnInit,
  ChangeDetectorRef,
  NgZone,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { PageChromeDirective } from '../../../../shared/directives/page-chrome.directive';
import { SmartDataTableComponent } from '../../../../shared/components/smart-data-table';
import type { DataTableConfig } from '../../../../shared/components/smart-data-table';
import { NotificationService } from '../../../../core/services/notification.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { MenuCodes } from '../../../../core/constants/menu-codes';
import { AcademicYearContextService } from '../../../../core/services/academic-year-context.service';
import { getUserFacingApiError } from '../../../../shared/utils/api-error.util';
import {
  FeeCollectionDetail,
  FeeCollectionHistoryRow,
  FeeCollectionMasterCard,
  FeeCollectionService,
} from '../../../../core/services/fee-collection.service';
import {
  CollectFeeDialogComponent,
  CollectFeeDialogResult,
} from '../collect-fee-dialog/collect-fee-dialog.component';

@Component({
  selector: 'app-fee-collection-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatDialogModule,
    PageChromeDirective,
    SmartDataTableComponent,
  ],
  templateUrl: './fee-collection-detail.component.html',
  styleUrl: './fee-collection-detail.component.css',
})
export class FeeCollectionDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(FeeCollectionService);
  private readonly snackBar = inject(NotificationService);
  private readonly permissionService = inject(PermissionService);
  private readonly ayContext = inject(AcademicYearContextService);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);

  studentId = '';
  loading = true;
  detail: FeeCollectionDetail | null = null;
  historyRows: Record<string, unknown>[] = [];
  /** Keep payment payloads on each history row for the expandable template. */
  private historyById = new Map<string, FeeCollectionHistoryRow>();
  historyTableConfig: DataTableConfig = {
    header: {
      title: 'Fee Collection History',
      subtitle: 'All fees collected for this student',
      showAddButton: false,
      syncPageChrome: false,
    },
    columns: [
      { key: 'feeName', label: 'Fee Master', sortable: false, cellType: 'text' },
      { key: 'totalDueDisplay', label: 'Total', sortable: false, cellType: 'text' },
      { key: 'totalPaidDisplay', label: 'Paid', sortable: false, cellType: 'text' },
      { key: 'totalPendingDisplay', label: 'Pending', sortable: false, cellType: 'text' },
      {
        key: 'status',
        label: 'Status',
        cellType: 'badge',
        badgeMap: {
          Pending: { cssClass: 'b-red', label: 'Pending' },
          Partial: { cssClass: 'b-amber', label: 'Partial' },
          Paid: { cssClass: 'b-green', label: 'Paid' },
        },
      },
    ],
    expandableRows: true,
    expandRowKey: 'feeMasterId',
    expandAccordion: true,
    searchPlaceholder: 'Search fee...',
    searchKeys: ['feeName'],
    itemLabel: 'fee masters',
    defaultPageSize: 10,
    selectable: false,
    showExport: false,
    showColumnToggle: false,
    filtersInPanel: false,
  };

  get pageTitle(): string {
    return 'Fee Collection';
  }

  get pageSubtitle(): string {
    const name = this.detail?.student.studentName?.trim();
    const year = this.academicYearLabel;
    if (name && year) return `${name} · ${year}`;
    if (name) return name;
    if (year) return year;
    return 'Collect fee for student';
  }

  get academicYearLabel(): string {
    return this.ayContext.effectiveYearLabel();
  }

  get canCollect(): boolean {
    return this.permissionService.canEdit(MenuCodes.FeeCollection);
  }

  /** Cards with pending dues or not-yet-published; paid fees stay in history only. Nearest due date first. */
  get actionableCards(): FeeCollectionMasterCard[] {
    const cards = this.detail?.dueCards ?? [];
    return cards
      .filter((c) => c.isPublished === false || Number(c.totalPending) > 0)
      .slice()
      .sort((a, b) => this.compareDueDate(a.defaultDueDate, b.defaultDueDate));
  }

  ngOnInit(): void {
    this.studentId = this.route.snapshot.paramMap.get('studentId') ?? '';
    if (!this.studentId) {
      void this.router.navigate(['/fees/collection']);
      return;
    }
    this.load();
  }

  load(): void {
    this.loading = true;
    this.api.getStudentDetail(this.studentId).subscribe({
      next: (detail) => {
        this.detail = detail;
        this.historyById.clear();
        this.historyRows = (detail.history || []).map((row) => {
          this.historyById.set(row.feeMasterId, row);
          return this.mapHistoryRow(row);
        });
        this.loading = false;
        this.refreshView();
      },
      error: (err) => {
        this.loading = false;
        this.snackBar.open(getUserFacingApiError(err, 'Failed to load fee collection'), 'Close', {
          duration: 3500,
          panelClass: 'snack-error',
        });
        this.refreshView();
      },
    });
  }

  goBack(): void {
    void this.router.navigate(['/fees/collection']);
  }

  statusClass(status: string): string {
    const s = (status || '').toLowerCase();
    if (s === 'paid') return 'paid';
    if (s === 'partial') return 'partial';
    return 'pending';
  }

  openCollect(card: FeeCollectionMasterCard): void {
    if (!this.canCollect || !card.canCollect) {
      if (card.isPublished === false) {
        this.snackBar.open('Fee can be collected only on or after the published-on date.', 'Close', {
          duration: 3500,
          panelClass: 'snack-warning',
        });
      }
      return;
    }

    this.dialog
      .open(CollectFeeDialogComponent, {
        data: { card },
        panelClass: ['erp-dialog', 'fee-dialog', 'collect-fee-dialog'],
        width: '760px',
        maxWidth: '96vw',
        minHeight: '520px',
        disableClose: true,
      })
      .afterClosed()
      .subscribe((result: CollectFeeDialogResult | false | undefined) => {
        if (!result || !result.lines?.length) return;
        this.api
          .collect(this.studentId, {
            feeMasterId: card.feeMasterId,
            academicPeriodId: card.academicPeriodId,
            paymentMethod: result.paymentMethod,
            lines: result.lines,
          })
          .subscribe({
            next: (res) => {
              this.snackBar.open(res.message || 'Fee collected successfully', 'Close', {
                duration: 3000,
                panelClass: 'snack-success',
              });
              this.load();
            },
            error: (err) => {
              this.snackBar.open(getUserFacingApiError(err, 'Failed to collect fee'), 'Close', {
                duration: 3500,
                panelClass: 'snack-error',
              });
            },
          });
      });
  }

  historyDetail(row: Record<string, unknown>): FeeCollectionHistoryRow | null {
    const id = String(row['feeMasterId'] ?? '');
    return this.historyById.get(id) ?? null;
  }

  formatMoney(n: number | null | undefined): string {
    return `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    const raw = String(value).trim();
    const isoDay = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
    if (isoDay) {
      return `${isoDay[3]}-${isoDay[2]}-${isoDay[1]}`;
    }
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }

  formatPaymentMethod(value: string | null | undefined): string {
    const v = String(value || '').trim();
    if (!v) return '—';
    if (v.toLowerCase() === 'banktransfer') return 'Bank transfer';
    return v;
  }

  lineBalance(due: number, paid: number): number {
    return Math.max(0, Number(due || 0) - Number(paid || 0));
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private mapHistoryRow(row: FeeCollectionHistoryRow): Record<string, unknown> {
    return {
      feeMasterId: row.feeMasterId,
      feeName: row.feeName,
      totalDue: row.totalDue,
      totalPaid: row.totalPaid,
      totalPending: row.totalPending,
      totalDueDisplay: this.formatMoney(row.totalDue),
      totalPaidDisplay: this.formatMoney(row.totalPaid),
      totalPendingDisplay: this.formatMoney(row.totalPending),
      status: row.status,
    };
  }

  private compareDueDate(a: string | null | undefined, b: string | null | undefined): number {
    const ta = this.dueDateTime(a);
    const tb = this.dueDateTime(b);
    if (ta === null && tb === null) return 0;
    if (ta === null) return 1;
    if (tb === null) return -1;
    return ta - tb;
  }

  private dueDateTime(value: string | null | undefined): number | null {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.getTime();
  }

  private refreshView(): void {
    this.ngZone.run(() => this.cdr.detectChanges());
  }
}
