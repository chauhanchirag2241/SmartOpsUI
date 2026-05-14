import { Component, OnInit, HostListener, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ClassService } from '../../core/services/class.service';
import { StudentService } from '../../core/services/student.service';
import { StudentFilter } from '../../shared/enums/table-filters.enum';

interface Student {
  id: string;
  classId?: string;
  roll: string;
  name: string;
  avClass: string;
  initials: string;
}

interface AttendanceStatus {
  [key: string]: string; // '' | 'present' | 'absent' | 'leave' | 'late'
}

interface AttendanceNote {
  [key: string]: string;
}

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, MatSnackBarModule],
  templateUrl: './attendance.component.html',
  styleUrl: './attendance.component.css'
})
export class AttendanceComponent implements OnInit {
  private classService = inject(ClassService);
  private studentService = inject(StudentService);
  private snackBar = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);

  students: Student[] = [];
  status: AttendanceStatus = {};
  notes: AttendanceNote = {};
  
  classes: any[] = [];
  
  selectedClassId = '';
  selectedDate = new Date().toISOString().split('T')[0];
  searchQuery = '';
  
  curFilter = 'all';
  viewMode: 'grid' | 'list' = 'grid';
  kbdVisible = false;
  darkMode = false;
  isSubmitting = false;
  submittedInfo: { date: string, by: string } | null = null;
  
  history: any[] = [];
  noteTargetId: string | null = null;
  tempNote = '';
  
  focusIdx = -1;

  ngOnInit() {
    this.loadClasses();
  }

  loadClasses() {
    this.classService.getClassDropdown().subscribe({
      next: (classes: any[]) => {
        this.classes = classes || [];
        if (this.classes.length > 0) {
          this.selectedClassId = this.classes[0].id;
          this.loadStudents();
        } else {
          this.students = [];
        }
      },
      error: () => {
        this.snackBar.open('Error loading classes', 'Close', { duration: 3000 });
      }
    });
  }

  get selectedClassName(): string {
    return this.classes.find(c => c.id === this.selectedClassId)?.name || 'Select class';
  }

  onClassChanged(classId: string): void {
    this.selectedClassId = classId;
    this.loadStudents();
  }

  loadStudents() {
    if (!this.selectedClassId) {
      this.clearClassStudents();
      this.cdr.detectChanges();
      return;
    }

    this.clearClassStudents();
    this.cdr.detectChanges();

    this.studentService.getStudents(1, 100, '', null, null, StudentFilter.Active, this.selectedClassId).subscribe({
      next: (res: any) => {
        const classStudents = this.filterStudentsBySelectedClass(res?.items || []);

        this.students = classStudents.map((s: any, idx: number) => ({
          id: s.id,
          classId: s.classId,
          roll: s.rollNumber || (idx + 1).toString().padStart(2, '0'),
          name: s.name,
          avClass: this.getAvatarClass(idx),
          initials: this.getInitials(s.name)
        }));

        this.students.forEach(s => {
          this.status[s.id] ??= '';
          this.notes[s.id] ??= '';
        });
        this.focusIdx = this.students.length ? 0 : -1;
        this.history = [];
        this.cdr.detectChanges();
      },
      error: () => {
        this.clearClassStudents();
        this.snackBar.open('Error loading students for selected class', 'Close', { duration: 3000 });
        this.cdr.detectChanges();
      }
    });
  }

  private filterStudentsBySelectedClass(items: any[]): any[] {
    const selectedClassId = String(this.selectedClassId).toLowerCase();
    const selectedClassName = this.normalizeClassName(this.selectedClassName);

    return items.filter((student: any) => {
      if (student.classId) {
        return String(student.classId).toLowerCase() === selectedClassId;
      }

      if (student.class) {
        return this.normalizeClassName(student.class) === selectedClassName;
      }

      return false;
    });
  }

  private clearClassStudents(): void {
    this.students = [];
    this.history = [];
    this.focusIdx = -1;
    this.curFilter = 'all';
  }

  private normalizeClassName(value: unknown): string {
    return String(value || '')
      .replace(/[–—]/g, '-')
      .replace(/\s*-\s*/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  getAvatarClass(idx: number): string {
    const classes = ['av-g', 'av-b', 'av-p', 'av-o'];
    return classes[idx % classes.length];
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  }

  get visibleStudents(): Student[] {
    return this.students.filter(s => {
      const mq = !this.searchQuery || s.name.toLowerCase().includes(this.searchQuery.toLowerCase()) || s.roll.includes(this.searchQuery);
      const mf = this.curFilter === 'all' || this.status[s.id] === this.curFilter || (this.curFilter === 'unmarked' && this.status[s.id] === '');
      return mq && mf;
    });
  }

  setStatus(id: string, st: string, event?: Event) {
    if (event) event.stopPropagation();
    const prev = this.status[id];
    if (prev === st) {
      this.status[id] = '';
      this.pushHistory(id, prev, '');
    } else {
      this.status[id] = st;
      this.pushHistory(id, prev, st);
    }
    this.showToast(id);
  }

  cardClick(id: string) {
    const cycles: { [key: string]: string } = { '': 'present', 'present': 'absent', 'absent': 'leave', 'leave': 'late', 'late': '' };
    const prev = this.status[id];
    this.status[id] = cycles[prev];
    this.pushHistory(id, prev, this.status[id]);
    this.showToast(id);
  }

  markAll(st: string) {
    const vis = this.visibleStudents;
    const snap = vis.map(s => ({ id: s.id, was: this.status[s.id] }));
    vis.forEach(s => this.status[s.id] = st);
    this.history.push({ type: 'bulk', snap });
    this.snackBar.open(st ? `Marked ${vis.length} as ${st}` : `Reset ${vis.length} students`, 'Undo', { duration: 3000 })
      .onAction().subscribe(() => this.undo());
  }

  pushHistory(id: string, from: string, to: string) {
    this.history.push({ type: 'single', id, from, to });
  }

  undo() {
    if (!this.history.length) return;
    const last = this.history.pop();
    if (last.type === 'single') {
      this.status[last.id] = last.from;
    } else {
      last.snap.forEach((s: any) => this.status[s.id] = s.was);
    }
    this.snackBar.open('Undone', 'Close', { duration: 2000 });
  }

  filterBy(f: string) {
    this.curFilter = f;
  }

  setView(v: 'grid' | 'list') {
    this.viewMode = v;
  }

  openNote(id: string, event: Event) {
    event.stopPropagation();
    this.noteTargetId = id;
    this.tempNote = this.notes[id] || '';
  }

  closeNote() {
    this.noteTargetId = null;
    this.tempNote = '';
  }

  saveNote() {
    if (this.noteTargetId) {
      this.notes[this.noteTargetId] = this.tempNote.trim();
    }
    this.closeNote();
  }

  get stats() {
    const vals = this.students.map(s => this.status[s.id] || '');
    const p = vals.filter(s => s === 'present').length;
    const a = vals.filter(s => s === 'absent').length;
    const l = vals.filter(s => s === 'leave').length;
    const lt = vals.filter(s => s === 'late').length;
    const tot = this.students.length;
    const marked = p + a + l + lt;
    const pct = tot > 0 ? Math.round((marked / tot) * 100) : 0;
    
    return {
      total: tot,
      present: p,
      absent: a,
      leave: l,
      late: lt,
      marked,
      pct,
      pPct: tot > 0 ? (p / tot) * 100 : 0,
      aPct: tot > 0 ? (a / tot) * 100 : 0,
      lPct: tot > 0 ? (l / tot) * 100 : 0,
      ltPct: tot > 0 ? (lt / tot) * 100 : 0
    };
  }

  showToast(id: string) {
    const s = this.students.find(x => x.id === id);
    const st = this.status[id];
    const labels: { [key: string]: string } = { 'present': 'Present', 'absent': 'Absent', 'leave': 'Leave', 'late': 'Late', '': 'Unmarked' };
    this.snackBar.open(`${s?.name} → ${labels[st]}`, 'Undo', { duration: 2000 })
      .onAction().subscribe(() => this.undo());
  }

  submitAttendance() {
    const unmarked = this.stats.total - this.stats.marked;
    if (unmarked > 0 && !confirm(`${unmarked} students unmarked. Submit anyway?`)) return;
    
    this.isSubmitting = true;
    setTimeout(() => {
      this.isSubmitting = false;
      this.submittedInfo = {
        date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
        by: 'Admin'
      };
      this.snackBar.open('Attendance submitted successfully', 'Close', { duration: 3000 });
    }, 1000);
  }

  toggleKbd() {
    this.kbdVisible = !this.kbdVisible;
  }

  toggleDark() {
    this.darkMode = !this.darkMode;
    document.body.classList.toggle('dark', this.darkMode);
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement).tagName)) return;
    
    if (event.key === '/') {
      event.preventDefault();
      const searchInp = document.getElementById('search-inp');
      if (searchInp) searchInp.focus();
      return;
    }
    
    if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
      event.preventDefault();
      this.undo();
      return;
    }

    const vis = this.visibleStudents;
    if (this.focusIdx === -1 && vis.length > 0) this.focusIdx = 0;
    
    const sid = vis[this.focusIdx]?.id;
    if (!sid) return;

    const keyMap: { [key: string]: string } = { 'p': 'present', 'a': 'absent', 'l': 'leave', 't': 'late', ' ': 'cycle' };
    const action = keyMap[event.key.toLowerCase()];
    
    if (action === 'cycle') {
      event.preventDefault();
      this.cardClick(sid);
    } else if (action) {
      event.preventDefault();
      this.setStatus(sid, action);
    }
    
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.focusIdx = Math.min(this.focusIdx + 1, vis.length - 1);
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.focusIdx = Math.max(this.focusIdx - 1, 0);
    }
  }

  onCardFocus(idx: number) {
    this.focusIdx = idx;
  }
}
