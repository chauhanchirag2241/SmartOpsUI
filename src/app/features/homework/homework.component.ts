import { Component, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { LayoutUiService } from '../../core/services/layout-ui.service';
import { AcademicYearContextService } from '../../core/services/academic-year-context.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NotificationService } from '../../core/services/notification.service';
import { ClassService } from '../../core/services/class.service';
import { SubjectService } from '../../core/services/subject.service';
import {
  HomeworkService,
  HomeworkPriority,
} from '../../core/services/homework.service';
import { AddHomeworkComponent } from './add-homework/add-homework.component';
import { PageToolbarComponent } from '../../shared/components/page-toolbar/page-toolbar.component';
import {
  HomeworkListItem,
  asHomeworkArray,
  homeworkStatusBadgeClass,
  homeworkSubjectBadgeClass,
  homeworkPriorityDotClass,
} from './homework.shared';

@Component({
  selector: 'app-homework',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatSnackBarModule,
    PageToolbarComponent,
    AddHomeworkComponent,
  ],
  templateUrl: './homework.component.html',
  styleUrl: './homework.component.css',
})
export class HomeworkComponent implements OnInit {
  private classService = inject(ClassService);
  private subjectService = inject(SubjectService);
  private homeworkService = inject(HomeworkService);
  private snackBar = inject(NotificationService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  readonly layoutUi = inject(LayoutUiService);
  readonly ayContext = inject(AcademicYearContextService);

  get canManageHomework(): boolean {
    return !this.ayContext.isReadOnlyScope();
  }

  HomeworkPriority = HomeworkPriority;

  items: HomeworkListItem[] = [];
  classes: any[] = [];
  subjects: any[] = [];

  stats = { totalAssigned: 0, dueToday: 0, totalSubmissions: 0, overdue: 0 };

  classFilter = '';
  subjectFilter = '';
  chipFilter = 'all';
  searchQuery = '';
  viewMode: 'grid' | 'list' = 'grid';

  showAddForm = false;
  formMode: 'add' | 'edit' = 'add';
  editingHomeworkId: string | null = null;
  editingHomeworkForm?: any;

  ngOnInit(): void {
    this.loadDropdowns();
    this.loadStats();
    this.loadList();
  }



  loadDropdowns(): void {
    this.classService.getClassDropdown().subscribe({
      next: (c) => (this.classes = c || []),
      error: () => this.snackBar.open('Failed to load classes', 'Close', { duration: 3000 }),
    });
    this.subjectService.getSubjectDropdown().subscribe({
      next: (s) => (this.subjects = s || []),
      error: () => this.snackBar.open('Failed to load subjects', 'Close', { duration: 3000 }),
    });
  }

  loadStats(): void {
    this.homeworkService.getStats().subscribe({
      next: (s) => {
        this.stats = {
          totalAssigned: s?.totalAssigned ?? 0,
          dueToday: s?.dueToday ?? 0,
          totalSubmissions: s?.totalSubmissions ?? 0,
          overdue: s?.overdue ?? 0,
        };
        this.refreshView();
      },
    });
  }

  loadList(): void {
    this.homeworkService
      .getList(
        this.classFilter || undefined,
        this.subjectFilter || undefined,
        this.chipFilter === 'all' ? undefined : this.chipFilter,
        this.searchQuery || undefined,
      )
      .subscribe({
        next: (list) => {
          try {
            this.items = asHomeworkArray<any>(list).map((h: any) => ({
              id: h.id ?? h.Id,
              title: h.title ?? h.Title,
              description: h.description ?? h.Description,
              classId: h.classId ?? h.ClassId,
              className: h.className ?? h.ClassName,
              subjectId: h.subjectId ?? h.SubjectId,
              subjectName: h.subjectName ?? h.SubjectName,
              assignDate: h.assignDate ?? h.AssignDate,
              dueDate: h.dueDate ?? h.DueDate,
              priority: h.priority ?? h.Priority,
              priorityLabel: h.priorityLabel ?? h.PriorityLabel,
              marks: h.marks ?? h.Marks,
              submissionType: h.submissionType ?? h.SubmissionType,
              submissionTypeLabel: h.submissionTypeLabel ?? h.SubmissionTypeLabel,
              status: h.status ?? h.Status,
              submitted: h.submitted ?? h.Submitted ?? 0,
              pending: h.pending ?? h.Pending ?? 0,
              late: h.late ?? h.Late ?? 0,
              total: h.total ?? h.Total ?? 0,
            }));
          } catch {
            this.items = [];
            this.snackBar.open('Invalid homework list response', 'Close', { duration: 3000 });
          } finally {
            this.refreshView();
          }
        },
        error: () => {
          this.items = [];
          this.snackBar.open('Failed to load homework', 'Close', { duration: 3000 });
          this.refreshView();
        },
      });
  }

  get toolbarFilterActive(): boolean {
    return !!this.classFilter || !!this.subjectFilter || this.chipFilter !== 'all';
  }

  onToolbarFiltersCleared(): void {
    this.classFilter = '';
    this.subjectFilter = '';
    this.chipFilter = 'all';
    this.searchQuery = '';
    this.loadList();
  }

  onToolbarSearchSubmit(q: string): void {
    this.searchQuery = q;
    this.loadList();
  }

  setChip(filter: string): void {
    this.chipFilter = filter;
    this.loadList();
    this.refreshView();
  }

  setView(mode: 'grid' | 'list'): void {
    this.viewMode = mode;
    this.refreshView();
  }

  /** Browser local calendar date (YYYY-MM-DD), not UTC from toISOString(). */
  private localDateString(date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  openCreate(): void {
    if (!this.canManageHomework) return;
    this.formMode = 'add';
    this.editingHomeworkId = null;
    this.editingHomeworkForm = undefined;
    this.showAddForm = true;
    this.refreshView();
  }

  openEdit(item: HomeworkListItem, event?: Event): void {
    if (!this.canManageHomework) return;
    event?.stopPropagation();
    this.formMode = 'edit';
    this.editingHomeworkId = item.id;
    this.editingHomeworkForm = {
      classId: item.classId,
      subjectId: item.subjectId,
      title: item.title,
      description: item.description || '',
      assignDate: item.assignDate,
      dueDate: item.dueDate,
      priority: item.priority,
      marks: item.marks ?? null,
      submissionType: item.submissionType,
    };
    this.showAddForm = true;
    this.refreshView();
  }

  closeAddForm(): void {
    this.showAddForm = false;
    this.editingHomeworkId = null;
    this.editingHomeworkForm = undefined;
    this.refreshView();
  }

  onHomeworkSaved(): void {
    this.closeAddForm();
    this.loadList();
    this.loadStats();
    this.refreshView();
  }

  deleteHomework(item: HomeworkListItem, event: Event): void {
    if (!this.canManageHomework) return;
    event.stopPropagation();
    if (!confirm(`Delete "${item.title}"?`)) return;
    this.homeworkService.delete(item.id).subscribe({
      next: () => {
        this.snackBar.open('Homework deleted', 'Close', { duration: 2500 });
        this.loadList();
        this.loadStats();
        this.refreshView();
      },
      error: () => this.snackBar.open('Delete failed', 'Close', { duration: 3000 }),
    });
  }

  openDetail(id: string): void {
    if (!id) return;
    this.router.navigate(['/homework', id]);
  }

  private refreshView(): void {
    this.ngZone.run(() => {
      this.cdr.detectChanges();
    });
  }

  statusBadgeClass(status: string): string {
    return homeworkStatusBadgeClass(status);
  }

  subjectBadgeClass(name: string): string {
    return homeworkSubjectBadgeClass(name);
  }

  priorityDotClass(priority: HomeworkPriority): string {
    return homeworkPriorityDotClass(priority);
  }

  submissionPct(item: HomeworkListItem): number {
    return item.total ? Math.round((item.submitted / item.total) * 100) : 0;
  }

  statusLabel(hw: HomeworkListItem): string {
    if (hw.status === 'overdue') return 'Overdue';
    if (hw.status === 'today') return 'Due today';
    if (hw.status === 'done') return 'Completed';
    return 'Active';
  }
}
