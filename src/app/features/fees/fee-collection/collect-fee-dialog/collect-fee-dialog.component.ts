import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import {
  FeeCollectionHead,
  FeeCollectionMasterCard,
} from '../../../../core/services/fee-collection.service';

export interface CollectFeeDialogData {
  card: FeeCollectionMasterCard;
}

export interface CollectFeeDialogResult {
  paymentMethod: string;
  lines: { feeHeadId: string; amount: number }[];
}

type CollectRow = FeeCollectionHead & {
  selected: boolean;
  collectAmount: number;
};

@Component({
  selector: 'app-collect-fee-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatIconModule],
  templateUrl: './collect-fee-dialog.component.html',
  styleUrl: './collect-fee-dialog.component.css',
})
export class CollectFeeDialogComponent implements OnInit {
  readonly ref = inject(MatDialogRef<CollectFeeDialogComponent, CollectFeeDialogResult | false>);

  readonly paymentMethods: { value: string; label: string }[] = [
    { value: 'Cash', label: 'Cash' },
    { value: 'UPI', label: 'UPI' },
    { value: 'Cheque', label: 'Cheque' },
    { value: 'Card', label: 'Card' },
    { value: 'BankTransfer', label: 'Bank transfer' },
    { value: 'Other', label: 'Other' },
  ];

  rows: CollectRow[] = [];
  paymentMethod = 'Cash';

  constructor(@Inject(MAT_DIALOG_DATA) public data: CollectFeeDialogData) {}

  get dialogSubtitle(): string {
    const card = this.data.card;
    if (card.periodLabel) {
      return `${card.feeName} — ${card.periodLabel}`;
    }
    return card.feeName;
  }

  ngOnInit(): void {
    this.rows = (this.data.card.heads || [])
      .filter((h) => h.balance > 0)
      .map((h) => ({
        ...h,
        selected: h.isMandatory,
        // Default to remaining balance; user can lower for partial collection.
        collectAmount: h.balance,
      }));
  }

  get selectedAmount(): number {
    return this.rows.filter((r) => r.selected).reduce((s, r) => s + Number(r.collectAmount || 0), 0);
  }

  get remainingAfter(): number {
    const pending = this.data.card.totalPending;
    return Math.max(0, pending - this.selectedAmount);
  }

  onAmountChange(row: CollectRow): void {
    const n = Number(row.collectAmount);
    if (!Number.isFinite(n) || n < 0) {
      row.collectAmount = 0;
      return;
    }
    if (n > row.balance) {
      row.collectAmount = row.balance;
    }
  }

  confirm(): void {
    if (!this.paymentMethod) {
      return;
    }
    const lines = this.rows
      .filter((r) => r.selected && Number(r.collectAmount) > 0)
      .map((r) => ({
        feeHeadId: r.feeHeadId,
        amount: Number(r.collectAmount),
      }));
    if (!lines.length) {
      return;
    }
    this.ref.close({ paymentMethod: this.paymentMethod, lines });
  }

  cancel(): void {
    this.ref.close(false);
  }
}
