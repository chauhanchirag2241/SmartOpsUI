import { Component, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ClassFeeAmountService } from '../../../core/services/class-fee-amount.service';
import { AcademicYearService } from '../../../core/services/academic-year.service';
import {
  asArray,
  formatInr,
  normalizeClassAmounts,
  normalizeClassSummary,
  normalizeDropdownItem,
} from '../fees.shared';

@Component({
  selector: 'app-class-fee-amounts',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatSnackBarModule],
  templateUrl: './class-fee-amounts.component.html',
  styleUrl: '../fees.shared.css',
})
export class ClassFeeAmountsComponent implements OnInit {
  private readonly service = inject(ClassFeeAmountService);
  private readonly academicYearService = inject(AcademicYearService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);

  academicYears: ReturnType<typeof normalizeDropdownItem>[] = [];
  academicYearId = '';
  classes: ReturnType<typeof normalizeClassSummary>[] = [];
  selectedClassId = '';
  amountData: ReturnType<typeof normalizeClassAmounts> | null = null;
  amountEdits: Record<string, number> = {};
  loading = false;

  ngOnInit(): void {
    this.academicYearService.getAcademicYearDropdown().subscribe({
      next: (years) => {
        this.academicYears = asArray(years).map(normalizeDropdownItem);
        const first = this.academicYears[0];
        if (first?.id) {
          this.academicYearId = first.id;
          this.loadClasses();
        }
        this.refreshView();
      },
      error: () => {
        this.toast('Failed to load academic years', true);
        this.refreshView();
      },
    });
  }

  onYearChange(): void {
    this.selectedClassId = '';
    this.amountData = null;
    this.loadClasses();
  }

  loadClasses(): void {
    if (!this.academicYearId) return;
    this.service.getClassSummaries(this.academicYearId).subscribe({
      next: (list) => {
        this.classes = asArray(list).map(normalizeClassSummary);
        if (!this.selectedClassId && this.classes.length) {
          this.selectClass(this.classes[0].classId);
        } else if (this.selectedClassId) {
          this.loadAmounts();
        }
        this.refreshView();
      },
      error: () => {
        this.toast('Failed to load classes', true);
        this.refreshView();
      },
    });
  }

  selectClass(classId: string): void {
    this.selectedClassId = classId;
    this.loadAmounts();
  }

  loadAmounts(): void {
    if (!this.selectedClassId || !this.academicYearId) return;
    this.loading = true;
    this.refreshView();

    this.service.getClassAmounts(this.selectedClassId, this.academicYearId).subscribe({
      next: (data) => {
        this.amountData = normalizeClassAmounts(data);
        this.amountEdits = {};
        this.amountData.items.forEach((i) => {
          this.amountEdits[i.feeTypeId] = i.amount ?? 0;
        });
        this.loading = false;
        this.refreshView();
      },
      error: () => {
        this.loading = false;
        this.toast('Failed to load amounts', true);
        this.refreshView();
      },
    });
  }

  get totalAmount(): number {
    return Object.values(this.amountEdits).reduce((a, b) => a + (Number(b) || 0), 0);
  }

  saveAmounts(): void {
    if (!this.selectedClassId) return;
    const amounts = Object.entries(this.amountEdits).map(([feeTypeId, amount]) => ({
      feeTypeId,
      amount: Number(amount) || 0,
    }));
    this.service
      .saveClassAmounts(this.selectedClassId, {
        academicYearId: this.academicYearId,
        amounts,
      })
      .subscribe({
        next: (data) => {
          this.amountData = normalizeClassAmounts(data);
          this.loadClasses();
          this.toast('Amounts saved');
          this.refreshView();
        },
        error: (e) => this.toast(e?.error ?? 'Save failed', true),
      });
  }

  formatInr = formatInr;

  private refreshView(): void {
    this.ngZone.run(() => this.cdr.detectChanges());
  }

  private toast(msg: string, error = false): void {
    this.snackBar.open(msg, 'Close', { duration: 2800, panelClass: error ? 'snack-error' : 'snack-success' });
  }
}
