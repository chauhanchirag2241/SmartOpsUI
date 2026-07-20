import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface TimetableSlotDialogData {
  dayLabel: string;
  periodName: string;
  subjectId: string;
  employeeId: string;
  roomNo: string;
  subjects: { id: string; name: string; code?: string }[];
  employeesForSubject: (subjectId: string) => { id: string; name: string }[];
}

export interface TimetableSlotDialogResult {
  subjectId: string;
  employeeId: string;
  roomNo: string;
}

@Component({
  selector: 'app-timetable-slot-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Assign slot — {{ data.dayLabel }} / {{ data.periodName }}</h2>
    <div mat-dialog-content class="slot-dialog-body">
      <label class="field-label" for="slot-subject">Subject</label>
      <select id="slot-subject" class="sel-filter sel-filter-lg" [(ngModel)]="subjectId" (ngModelChange)="onSubjectChange()">
        <option value="">Select subject</option>
        @for (s of data.subjects; track s.id) {
          <option [value]="s.id">{{ s.name }}@if (s.code) { ({{ s.code }}) }</option>
        }
      </select>

      <label class="field-label" for="slot-teacher">Teacher</label>
      <select id="slot-teacher" class="sel-filter sel-filter-lg" [(ngModel)]="employeeId">
        <option value="">Select teacher</option>
        @for (e of employees; track e.id) {
          <option [value]="e.id">{{ e.name }}</option>
        }
      </select>

      <label class="field-label" for="slot-room">Room no.</label>
      <input id="slot-room" class="text-input" type="text" [(ngModel)]="roomNo" placeholder="e.g. Lab-2" />
    </div>
    <div mat-dialog-actions align="end" class="slot-dialog-actions">
      <button type="button" class="btn-outline" (click)="clear()">Clear</button>
      <button type="button" class="btn-outline" (click)="ref.close()">Cancel</button>
      <button type="button" class="btn-primary" [disabled]="!subjectId" (click)="save()">Apply</button>
    </div>
  `,
  styles: [
    `
      .slot-dialog-body {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 320px;
        padding-top: 4px;
      }
      .field-label {
        font-size: 12px;
        font-weight: 600;
        color: #4b5563;
        margin-top: 6px;
      }
      .text-input {
        border: 1px solid #d1d5db;
        border-radius: 8px;
        padding: 8px 10px;
        font-size: 14px;
      }
      .slot-dialog-actions {
        gap: 8px;
        padding: 12px 16px 16px;
      }
    `,
  ],
})
export class TimetableSlotDialogComponent {
  readonly data = inject<TimetableSlotDialogData>(MAT_DIALOG_DATA);
  readonly ref = inject(MatDialogRef<TimetableSlotDialogComponent, TimetableSlotDialogResult | 'clear'>);

  subjectId = this.data.subjectId || '';
  employeeId = this.data.employeeId || '';
  roomNo = this.data.roomNo || '';
  employees = this.data.employeesForSubject(this.subjectId);

  onSubjectChange(): void {
    this.employees = this.data.employeesForSubject(this.subjectId);
    if (!this.employees.some((e) => e.id === this.employeeId)) {
      this.employeeId = this.employees[0]?.id || '';
    }
  }

  save(): void {
    this.ref.close({
      subjectId: this.subjectId,
      employeeId: this.employeeId,
      roomNo: this.roomNo.trim(),
    });
  }

  clear(): void {
    this.ref.close('clear');
  }
}
