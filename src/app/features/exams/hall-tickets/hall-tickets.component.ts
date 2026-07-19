import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { NotificationService } from '../../../core/services/notification.service';
import { PermissionService } from '../../../core/services/permission.service';
import { MenuCodes } from '../../../core/constants/menu-codes';
import {
  ExamService,
  ExamListItem,
  ExamClassInfo,
  HallTicket,
} from '../../../core/services/exam.service';

@Component({
  selector: 'app-hall-tickets',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './hall-tickets.component.html',
  styleUrl: './hall-tickets.component.css',
})
export class HallTicketsComponent implements OnInit {
  private examService = inject(ExamService);
  private snackBar = inject(NotificationService);
  private permissions = inject(PermissionService);
  private cdr = inject(ChangeDetectorRef);

  exams: ExamListItem[] = [];
  tickets: HallTicket[] = [];

  selectedExamId = '';
  selectedClassId = '';

  loading = false;
  generating = false;

  get canGenerate(): boolean {
    return (
      this.permissions.canAdd(MenuCodes.ExamHallTickets) ||
      this.permissions.canEdit(MenuCodes.ExamHallTickets)
    );
  }

  get selectedExam(): ExamListItem | undefined {
    return this.exams.find((e) => e.id === this.selectedExamId);
  }

  get examClasses(): ExamClassInfo[] {
    return this.selectedExam?.classes ?? [];
  }

  ngOnInit(): void {
    this.examService.getExams().subscribe({
      next: (exams) => {
        this.exams = exams ?? [];
        if (this.exams.length > 0) {
          this.selectedExamId = this.exams[0].id;
          this.onExamChange();
        }
        this.cdr.detectChanges();
      },
      error: () =>
        this.snackBar.open('Failed to load exams', 'Close', {
          duration: 3000,
          panelClass: 'snack-error',
        }),
    });
  }

  onExamChange(): void {
    this.selectedClassId = this.examClasses[0]?.classId ?? '';
    this.loadTickets();
  }

  loadTickets(): void {
    this.tickets = [];
    if (!this.selectedExamId || !this.selectedClassId) return;
    this.loading = true;
    this.examService.getHallTickets(this.selectedExamId, this.selectedClassId).subscribe({
      next: (tickets) => {
        this.tickets = tickets ?? [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.snackBar.open('Failed to load hall tickets', 'Close', {
          duration: 3000,
          panelClass: 'snack-error',
        });
        this.cdr.detectChanges();
      },
    });
  }

  generate(): void {
    if (!this.selectedExamId || !this.selectedClassId) {
      this.snackBar.open('Select an exam and class first', 'Close', {
        duration: 2500,
        panelClass: 'snack-error',
      });
      return;
    }
    this.generating = true;
    this.examService.generateHallTickets(this.selectedExamId, this.selectedClassId).subscribe({
      next: (tickets) => {
        this.tickets = tickets ?? [];
        this.generating = false;
        this.snackBar.open(`Generated hall tickets for ${this.tickets.length} student(s)`, 'Close', {
          duration: 2500,
          panelClass: 'snack-success',
        });
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.generating = false;
        this.snackBar.open(
          typeof err?.error === 'string' ? err.error : 'Hall ticket generation failed',
          'Close',
          { duration: 3500, panelClass: 'snack-error' },
        );
        this.cdr.detectChanges();
      },
    });
  }

  initials(name: string): string {
    return (name || '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('');
  }

  printAll(): void {
    window.print();
  }
}
