import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AttendanceService } from '../../../core/services/attendance.service';
import { ClassService } from '../../../core/services/class.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { PageChromeDirective } from '../../../shared/directives/page-chrome.directive';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { AcademicYearService, AcademicYearDropdownItem } from '../../../core/services/academic-year.service';

@Component({
  selector: 'app-attendance-report',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, AvatarComponent, MatFormFieldModule, MatSelectModule, PageChromeDirective],
  templateUrl: './attendance-report.component.html',
  styleUrls: ['./attendance-report.component.css']
})
export class AttendanceReportComponent implements OnInit {
  private attendanceService = inject(AttendanceService);
  private classService = inject(ClassService);
  private academicYearService = inject(AcademicYearService);
  private snackBar = inject(NotificationService);

  classes = signal<any[]>([]);
  academicYears = signal<AcademicYearDropdownItem[]>([]);
  
  selectedClassId = signal<string>('');
  selectedAcademicYearId = signal<string>('');
  selectedMonth = signal<number>(new Date().getMonth() + 1);
  selectedYear = signal<number>(new Date().getFullYear());
  
  searchQuery = signal<string>('');
  chipFilter = signal<string>('all');
  currentView = signal<string>('register');
  
  reportData = signal<any>(null);
  loading = signal<boolean>(false);

  daysInMonth = computed(() => {
    if (!this.reportData()) return [];
    const month = this.selectedMonth();
    const year = this.selectedYear();
    const days = new Date(year, month, 0).getDate();
    return Array.from({ length: days }, (_, i) => i + 1);
  });

  filteredStudents = computed(() => {
    const data = this.reportData();
    if (!data) return [];
    
    let students = data.students || [];
    const q = this.searchQuery().toLowerCase();
    
    if (q) {
      students = students.filter((s: any) => 
        s.studentName.toLowerCase().includes(q) || s.rollNo.toLowerCase().includes(q)
      );
    }
    
    if (this.chipFilter() === 'low') {
      students = students.filter((s: any) => s.attendancePercentage < 75);
    }
    
    if (this.chipFilter() === 'absent') {
      students = students.filter((s: any) => s.totalAbsent >= 3);
    }
    
    return students;
  });

  ngOnInit() {
    this.loadAcademicYears();
    this.loadClasses();
  }

  loadAcademicYears() {
    this.academicYearService.getAcademicYearDropdown('switcher').subscribe({
      next: (res) => {
        this.academicYears.set(res || []);
        const current = res.find(a => a.isCurrent);
        if (current) {
          this.selectedAcademicYearId.set(current.id);
        } else if (res.length > 0) {
          this.selectedAcademicYearId.set(res[0].id);
        }
      },
      error: () => this.snackBar.error('Failed to load academic years')
    });
  }

  loadClasses() {
    this.classService.getClasses(1, 1000).subscribe({
      next: (res: any) => {
        this.classes.set(res.items || []);
        if (this.classes().length > 0) {
          this.selectedClassId.set(this.classes()[0].id);
        }
      },
      error: () => this.snackBar.error('Failed to load classes')
    });
  }

  loadReport() {
    if (!this.selectedClassId() || !this.selectedAcademicYearId()) return;
    
    this.loading.set(true);
    this.attendanceService.getAttendanceReport(
      this.selectedClassId(),
      this.selectedMonth(),
      this.selectedAcademicYearId()
    ).subscribe({
      next: (res: any) => {
        this.reportData.set(res);
        this.loading.set(false);
      },
      error: () => {
        this.snackBar.error('Failed to load report data');
        this.loading.set(false);
      }
    });
  }

  setChip(filter: string) {
    this.chipFilter.set(filter);
  }

  setView(view: string) {
    this.currentView.set(view);
  }

  showToast(msg: string) {
    this.snackBar.success(msg);
  }

  isSunday(day: number): boolean {
    const date = new Date(this.selectedYear(), this.selectedMonth() - 1, day);
    return date.getDay() === 0;
  }
}
