import { Component, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { LayoutUiService } from '../../core/services/layout-ui.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ClassService } from '../../core/services/class.service';
import { SubjectService } from '../../core/services/subject.service';
import {
  HomeworkService,
  HomeworkPriority,
  HomeworkSubmissionType,
  CreateHomeworkRequest,
} from '../../core/services/homework.service';
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
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, MatSnackBarModule],
  templateUrl: './homework.component.html',
  styleUrl: './homework.component.css',
})
export class HomeworkComponent implements OnInit {
  private classService = inject(ClassService);
  private subjectService = inject(SubjectService);
  private homeworkService = inject(HomeworkService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  readonly layoutUi = inject(LayoutUiService);

  HomeworkPriority = HomeworkPriority;
  HomeworkSubmissionType = HomeworkSubmissionType;

  items: HomeworkListItem[] = [];
  classes: any[] = [];
  subjects: any[] = [];
  listLoading = true;

  stats = { totalAssigned: 0, dueToday: 0, totalSubmissions: 0, overdue: 0 };

  classFilter = '';
  subjectFilter = '';
  chipFilter = 'all';
  searchQuery = '';
  viewMode: 'grid' | 'list' = 'grid';

  showCreateModal = false;
  editingHomeworkId: string | null = null;
  form: CreateHomeworkRequest = this.emptyForm();

  ngOnInit(): void {
    this.loadDropdowns();
    this.loadStats();
    this.loadList();
  }

  private emptyForm(): CreateHomeworkRequest {
    const today = new Date().toISOString().split('T')[0];
    const due = new Date();
    due.setDate(due.getDate() + 2);
    return {
      classId: '',
      subjectId: '',
      title: '',
      description: '',
      assignDate: today,
      dueDate: due.toISOString().split('T')[0],
      priority: HomeworkPriority.Normal,
      marks: null,
      submissionType: HomeworkSubmissionType.Physical,
    };
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
    this.listLoading = true;
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
            this.listLoading = false;
            this.refreshView();
          }
        },
        error: () => {
          this.listLoading = false;
          this.items = [];
          this.snackBar.open('Failed to load homework', 'Close', { duration: 3000 });
          this.refreshView();
        },
      });
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

  openCreate(): void {
    this.editingHomeworkId = null;
    this.form = this.emptyForm();
    this.showCreateModal = true;
    this.refreshView();
  }

  openEdit(item: HomeworkListItem, event?: Event): void {
    event?.stopPropagation();
    this.editingHomeworkId = item.id;
    this.form = {
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
    this.showCreateModal = true;
    this.refreshView();
  }

  closeCreate(): void {
    this.showCreateModal = false;
    this.editingHomeworkId = null;
    this.refreshView();
  }

  saveHomework(): void {
    if (!this.form.classId || !this.form.subjectId || !this.form.title?.trim() || !this.form.dueDate) {
      this.snackBar.open('Please fill required fields', 'Close', { duration: 3000 });
      return;
    }

    const req = { ...this.form, title: this.form.title.trim() };
    const call = this.editingHomeworkId
      ? this.homeworkService.update(this.editingHomeworkId, req)
      : this.homeworkService.create(req);

    call.subscribe({
      next: (res) => {
        this.snackBar.open(
          this.editingHomeworkId ? 'Homework updated' : 'Homework assigned',
          'Close',
          { duration: 2500, panelClass: ['snack-success'] },
        );
        this.closeCreate();
        this.loadList();
        this.loadStats();
        const newId = res?.id ?? res?.Id;
        if (newId) {
          this.router.navigate(['/homework', newId]);
        } else {
          this.refreshView();
        }
      },
      error: (err) =>
        this.snackBar.open(err?.error || 'Save failed', 'Close', {
          duration: 3000,
          panelClass: ['snack-error'],
        }),
    });
  }

  deleteHomework(item: HomeworkListItem, event: Event): void {
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
