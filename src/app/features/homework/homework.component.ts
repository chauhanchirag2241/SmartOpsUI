import { Component, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { LayoutUiService } from '../../core/services/layout-ui.service';
import { AcademicYearContextService } from '../../core/services/academic-year-context.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { NotificationService } from '../../core/services/notification.service';
import { ClassService } from '../../core/services/class.service';
import { SubjectService } from '../../core/services/subject.service';
import {
  HomeworkService,
  HomeworkPriority,
} from '../../core/services/homework.service';
import { AddHomeworkComponent } from './add-homework/add-homework.component';
import { PageToolbarComponent } from '../../shared/components/page-toolbar/page-toolbar.component';
import { PageChromeDirective } from '../../shared/directives/page-chrome.directive';
import { DeleteConfirmDialogComponent } from '../../shared/components/delete-confirm-dialog/delete-confirm-dialog.component';
import { MultiSelectChipsComponent } from '../../shared/components/multi-select-chips/multi-select-chips.component';
import { MappingOption } from '../../shared/mapping/mapping.types';
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
    MatDialogModule,
    PageToolbarComponent,
    AddHomeworkComponent,
    PageChromeDirective,
    MultiSelectChipsComponent,
  ],
  templateUrl: './homework.component.html',
  styleUrl: './homework.component.css',
})
export class HomeworkComponent implements OnInit {
  private classService = inject(ClassService);
  private subjectService = inject(SubjectService);
  private homeworkService = inject(HomeworkService);
  private snackBar = inject(NotificationService);
  private dialog = inject(MatDialog);
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
  classOptions: MappingOption[] = [];
  subjectOptions: MappingOption[] = [];
  selectedClassIds: string[] = [];
  selectedSubjectIds: string[] = [];

  stats = { totalAssigned: 0, dueToday: 0, totalSubmissions: 0, overdue: 0 };

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
      next: (c) => {
        this.classOptions = (c || [])
          .map((item: any) => ({
            id: String(item.id ?? item.Id ?? ''),
            name: String(item.name ?? item.Name ?? item.className ?? item.ClassName ?? ''),
          }))
          .filter((o) => o.id && o.name);
        this.cdr.detectChanges();
      },
      error: () => this.snackBar.open('Failed to load classes', 'Close', { duration: 3000 }),
    });
    this.reloadSubjectFilterOptions();
  }

  onClassFilterChange(ids: string[]): void {
    this.selectedClassIds = ids;
    this.selectedSubjectIds = [];
    this.reloadSubjectFilterOptions();
    this.loadList();
  }

  onSubjectFilterChange(ids: string[]): void {
    this.selectedSubjectIds = ids;
    this.loadList();
  }

  private reloadSubjectFilterOptions(): void {
    const yearId = this.ayContext.effectiveYearId() || undefined;

    if (this.selectedClassIds.length) {
      forkJoin(
        this.selectedClassIds.map((classId) =>
          this.classService.getTeachingSubjectsForClass(classId, yearId).pipe(catchError(() => of([]))),
        ),
      ).subscribe({
        next: (pages) => {
          const byId = new Map<string, MappingOption>();
          for (const rows of pages) {
            for (const s of rows || []) {
              const id = String((s as any).id ?? (s as any).Id ?? '');
              const name = String(
                (s as any).name ??
                  (s as any).Name ??
                  (s as any).subjectName ??
                  (s as any).SubjectName ??
                  '',
              );
              if (id && name && !byId.has(id)) {
                byId.set(id, { id, name });
              }
            }
          }
          this.subjectOptions = [...byId.values()].sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
          );
          const allowed = new Set(this.subjectOptions.map((o) => o.id));
          this.selectedSubjectIds = this.selectedSubjectIds.filter((id) => allowed.has(id));
          this.cdr.detectChanges();
        },
        error: () => {
          this.subjectOptions = [];
          this.snackBar.open('Failed to load subjects', 'Close', { duration: 3000 });
        },
      });
      return;
    }

    this.subjectService.getSubjectDropdown().subscribe({
      next: (s) => {
        this.subjectOptions = (s || [])
          .map((item: any) => ({
            id: String(item.id ?? item.Id ?? ''),
            name: String(item.subjectName ?? item.name ?? item.Name ?? ''),
          }))
          .filter((o) => o.id && o.name);
        this.cdr.detectChanges();
      },
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
        this.selectedClassIds.length ? this.selectedClassIds : null,
        this.selectedSubjectIds.length ? this.selectedSubjectIds : null,
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
    return (
      this.selectedClassIds.length > 0 ||
      this.selectedSubjectIds.length > 0 ||
      this.chipFilter !== 'all'
    );
  }

  onToolbarFiltersCleared(): void {
    this.selectedClassIds = [];
    this.selectedSubjectIds = [];
    this.chipFilter = 'all';
    this.searchQuery = '';
    this.reloadSubjectFilterOptions();
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

    const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
      data: {
        title: 'Delete homework?',
        description: 'This homework assignment will be permanently removed.',
        recordName: item.title,
        recordMeta: [item.className, item.subjectName].filter(Boolean).join(' · '),
        initials: this.initialsFrom(item.title),
        warningMessage: 'Submissions linked to this homework may also be affected.',
        confirmButtonText: 'Yes, delete',
        cancelButtonText: 'Cancel',
      },
      panelClass: 'erp-dialog',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.homeworkService.delete(item.id).subscribe({
        next: () => {
          this.snackBar.open('Homework deleted', 'Close', { duration: 2500 });
          this.loadList();
          this.loadStats();
          this.refreshView();
        },
        error: () => this.snackBar.open('Delete failed', 'Close', { duration: 3000 }),
      });
    });
  }

  private initialsFrom(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'HW';
    return parts
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join('');
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
