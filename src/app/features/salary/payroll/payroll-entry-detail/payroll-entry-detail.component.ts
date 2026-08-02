import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ChangeDetectorRef,
  NgZone,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { NotificationService } from '../../../../core/services/notification.service';
import { PayrollService } from '../../../../core/services/payroll.service';
import { PageChromeDirective } from '../../../../shared/directives/page-chrome.directive';
import { ActionButtonComponent } from '../../../../shared/components/action-button/action-button.component';
import {
  extractApiError,
  formatInr,
  MONTH_OPTIONS,
  normalizePayslip,
} from '../../salary.shared';

@Component({
  selector: 'app-payroll-entry-detail',
  standalone: true,
  imports: [CommonModule, MatIconModule, PageChromeDirective, ActionButtonComponent],
  templateUrl: './payroll-entry-detail.component.html',
  styleUrl: '../../salary.shared.css',
  host: { class: 'form-page-shell' },
})
export class PayrollEntryDetailComponent implements OnInit {
  @Input({ required: true }) entryId!: string;
  @Output() cancel = new EventEmitter<void>();

  private readonly service = inject(PayrollService);
  private readonly snackBar = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);

  payslip: ReturnType<typeof normalizePayslip> | null = null;
  loading = true;
  formatInr = formatInr;

  ngOnInit(): void {
    this.load();
  }

  get monthLabel(): string {
    if (!this.payslip) return '';
    return MONTH_OPTIONS.find((m) => m.value === this.payslip!.payMonth)?.label ?? '';
  }

  payslipRows(): { earning: string; earningAmt: number; deduction: string; deductionAmt: number }[] {
    if (!this.payslip) return [];
    const max = Math.max(this.payslip.earnings.length, this.payslip.deductions.length);
    const rows: { earning: string; earningAmt: number; deduction: string; deductionAmt: number }[] = [];
    for (let i = 0; i < max; i++) {
      const er = this.payslip.earnings[i];
      const dr = this.payslip.deductions[i];
      rows.push({
        earning: er?.name ?? '',
        earningAmt: er?.amount ?? 0,
        deduction: dr?.name ?? '',
        deductionAmt: dr?.amount ?? 0,
      });
    }
    return rows;
  }

  private load(): void {
    this.loading = true;
    this.service.getPayslip(this.entryId).subscribe({
      next: (raw) => {
        this.payslip = normalizePayslip(raw);
        this.loading = false;
        this.refresh();
      },
      error: (e) => {
        this.loading = false;
        this.toast(extractApiError(e, 'Failed to load payroll details'), true);
        this.refresh();
      },
    });
  }

  private toast(msg: string, isError = false): void {
    this.snackBar.open(msg, 'Close', { duration: 3500, panelClass: isError ? 'snack-error' : undefined });
  }

  private refresh(): void {
    this.ngZone.run(() => this.cdr.detectChanges());
  }
}
