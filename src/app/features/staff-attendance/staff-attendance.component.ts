import { Component, OnInit, ChangeDetectorRef, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MenuCodes } from '../../core/constants/menu-codes';
import { DepartmentService, DepartmentDto } from '../../core/services/department.service';
import { NotificationService } from '../../core/services/notification.service';
import { PermissionService } from '../../core/services/permission.service';
import {
  StaffAttendanceService,
  StaffAttendanceRowDto,
  StaffAttendanceSettingsDto,
  StaffPunchType,
} from '../../core/services/staff-attendance.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { PageToolbarComponent } from '../../shared/components/page-toolbar/page-toolbar.component';
import { PageChromeDirective } from '../../shared/directives/page-chrome.directive';

type PunchFilter = 'all' | 'checkedin' | 'checkedout' | 'notpunched';

@Component({
  selector: 'app-staff-attendance',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatSnackBarModule,
    AvatarComponent,
    PageToolbarComponent,
    PageChromeDirective,
  ],
  templateUrl: './staff-attendance.component.html',
  styleUrl: './staff-attendance.component.css',
})
export class StaffAttendanceComponent implements OnInit {
  private readonly staffAttendance = inject(StaffAttendanceService);
  private readonly departmentService = inject(DepartmentService);
  private readonly permissions = inject(PermissionService);
  private readonly snackBar = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild('faceFileInput') faceFileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('enrollFileInput') enrollFileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('webcamVideo') webcamVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('webcamCanvas') webcamCanvas?: ElementRef<HTMLCanvasElement>;

  rows: StaffAttendanceRowDto[] = [];
  departments: DepartmentDto[] = [];
  settings: StaffAttendanceSettingsDto = { type: '', allowsManual: false, allowsFace: false };

  selectedDate = this.localDateString();
  readonly maxDate = this.localDateString();
  selectedDepartmentId = '';
  appliedSearchQuery = '';
  curFilter: PunchFilter = 'all';

  loading = false;
  actionBusy = false;
  faceModalOpen = false;
  enrollTarget: StaffAttendanceRowDto | null = null;
  webcamStream: MediaStream | null = null;
  webcamError = '';

  get canEdit(): boolean {
    return this.permissions.canEdit(MenuCodes.StaffAttendance);
  }

  ngOnInit(): void {
    this.loadSettings();
    this.loadDepartments();
    this.loadRows();
  }

  get displaySelectedDate(): string {
    return this.formatDisplayDate(this.selectedDate);
  }

  get toolbarFilterActive(): boolean {
    const today = this.localDateString();
    return this.selectedDate !== today || !!this.selectedDepartmentId;
  }

  get stats() {
    const total = this.departmentFilteredRows.length;
    const checkedIn = this.departmentFilteredRows.filter((r) => !!r.checkInTime && !r.checkOutTime).length;
    const checkedOut = this.departmentFilteredRows.filter((r) => !!r.checkOutTime).length;
    const notPunched = this.departmentFilteredRows.filter((r) => !r.checkInTime).length;
    return { total, checkedIn, checkedOut, notPunched };
  }

  get departmentFilteredRows(): StaffAttendanceRowDto[] {
    if (!this.selectedDepartmentId) {
      return this.rows;
    }
    return this.rows.filter(
      (r) => String(r.departmentId || '').toLowerCase() === this.selectedDepartmentId.toLowerCase(),
    );
  }

  get visibleRows(): StaffAttendanceRowDto[] {
    const q = this.appliedSearchQuery.trim().toLowerCase();
    return this.departmentFilteredRows.filter((r) => {
      const mq =
        !q ||
        r.employeeName.toLowerCase().includes(q) ||
        (r.departmentName || '').toLowerCase().includes(q);
      if (!mq) return false;
      switch (this.curFilter) {
        case 'checkedin':
          return !!r.checkInTime && !r.checkOutTime;
        case 'checkedout':
          return !!r.checkOutTime;
        case 'notpunched':
          return !r.checkInTime;
        default:
          return true;
      }
    });
  }

  loadSettings(): void {
    this.staffAttendance.getSettings().subscribe({
      next: (res) => {
        this.settings = res || { type: '', allowsManual: false, allowsFace: false };
        this.cdr.detectChanges();
      },
      error: () => {
        this.settings = { type: '', allowsManual: false, allowsFace: false };
      },
    });
  }

  loadDepartments(): void {
    this.departmentService.getDepartments().subscribe({
      next: (deps) => {
        this.departments = (deps || []).filter((d) => d.isActive !== false);
        this.cdr.detectChanges();
      },
      error: () => {
        this.departments = [];
      },
    });
  }

  loadRows(): void {
    if (!this.selectedDate) return;
    this.loading = true;
    this.staffAttendance.listByDate(this.selectedDate).subscribe({
      next: (res) => {
        this.rows = Array.isArray(res) ? res : [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.rows = [];
        this.loading = false;
        const message =
          err?.status === 403
            ? 'You do not have permission to view staff attendance.'
            : err?.error?.message || err?.error || 'Failed to load staff attendance';
        this.snackBar.open(typeof message === 'string' ? message : 'Failed to load staff attendance', 'Close', {
          duration: 3000,
        });
        this.cdr.detectChanges();
      },
    });
  }

  onDateChanged(date: string): void {
    this.selectedDate = date;
    this.loadRows();
  }

  onDepartmentChanged(departmentId: string): void {
    this.selectedDepartmentId = departmentId;
    this.cdr.markForCheck();
  }

  onToolbarFiltersCleared(): void {
    this.selectedDate = this.localDateString();
    this.selectedDepartmentId = '';
    this.appliedSearchQuery = '';
    this.curFilter = 'all';
    this.loadRows();
  }

  onToolbarSearchSubmit(q: string): void {
    this.appliedSearchQuery = q;
    this.cdr.markForCheck();
  }

  filterBy(f: PunchFilter): void {
    this.curFilter = f;
  }

  formatTime(value?: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  sourceLabel(source?: string | null): string {
    if (!source) return '';
    const s = source.toLowerCase();
    if (s.includes('face')) return 'Face';
    if (s.includes('manual')) return 'Manual';
    return source;
  }

  sourceClass(source?: string | null): string {
    const label = this.sourceLabel(source).toLowerCase();
    if (label === 'face') return 'src-face';
    if (label === 'manual') return 'src-manual';
    return 'src-other';
  }

  statusClass(row: StaffAttendanceRowDto): string {
    const label = (row.statusLabel || String(row.status) || '').toLowerCase();
    if (label.includes('present')) return 'st-present';
    if (label.includes('late')) return 'st-late';
    if (label.includes('half')) return 'st-half';
    if (label.includes('absent')) return 'st-absent';
    return 'st-muted';
  }

  canCheckIn(row: StaffAttendanceRowDto): boolean {
    return this.canEdit && this.settings.allowsManual && !row.checkInTime;
  }

  canCheckOut(row: StaffAttendanceRowDto): boolean {
    return this.canEdit && this.settings.allowsManual && !!row.checkInTime && !row.checkOutTime;
  }

  manualPunch(row: StaffAttendanceRowDto, punchType: StaffPunchType): void {
    if (!this.canEdit || this.actionBusy) return;
    this.actionBusy = true;
    this.staffAttendance
      .manualPunch({
        employeeId: row.employeeId,
        punchType,
        attendanceDate: this.selectedDate,
      })
      .subscribe({
        next: () => {
          this.actionBusy = false;
          this.snackBar.open(
            `${row.employeeName} · ${punchType === 'checkin' ? 'Checked in' : 'Checked out'}`,
            'Close',
            { duration: 2500 },
          );
          this.loadRows();
        },
        error: (err) => {
          this.actionBusy = false;
          this.snackBar.open(this.errorMessage(err, 'Punch failed'), 'Close', { duration: 4000 });
          this.cdr.detectChanges();
        },
      });
  }

  openFacePunch(): void {
    if (!this.canEdit || !this.settings.allowsFace) return;
    this.faceModalOpen = true;
    this.webcamError = '';
    this.cdr.detectChanges();
    setTimeout(() => this.startWebcam(), 50);
  }

  closeFaceModal(): void {
    this.stopWebcam();
    this.faceModalOpen = false;
    this.webcamError = '';
  }

  triggerFaceFile(): void {
    this.faceFileInput?.nativeElement.click();
  }

  onFaceFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.submitFacePunch(file);
    input.value = '';
  }

  async captureWebcamAndPunch(): Promise<void> {
    const video = this.webcamVideo?.nativeElement;
    const canvas = this.webcamCanvas?.nativeElement;
    if (!video || !canvas || !video.videoWidth) {
      this.webcamError = 'Camera not ready. Use file upload instead.';
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) {
        this.snackBar.open('Could not capture image', 'Close', { duration: 3000 });
        return;
      }
      this.submitFacePunch(blob, 'webcam-punch.jpg');
    }, 'image/jpeg', 0.92);
  }

  private submitFacePunch(image: File | Blob, fileName?: string): void {
    if (this.actionBusy) return;
    this.actionBusy = true;
    this.staffAttendance.facePunch(image, fileName).subscribe({
      next: (row) => {
        this.actionBusy = false;
        this.closeFaceModal();
        this.snackBar.open(
          `Face punch · ${row.employeeName || 'Employee'} recorded`,
          'Close',
          { duration: 3000 },
        );
        this.loadRows();
      },
      error: (err) => {
        this.actionBusy = false;
        this.snackBar.open(this.errorMessage(err, 'Face punch failed'), 'Close', { duration: 4000 });
        this.cdr.detectChanges();
      },
    });
  }

  startEnroll(row: StaffAttendanceRowDto): void {
    if (!this.canEdit || !this.settings.allowsFace) return;
    this.enrollTarget = row;
    this.cdr.detectChanges();
    setTimeout(() => this.enrollFileInput?.nativeElement.click(), 0);
  }

  onEnrollFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const target = this.enrollTarget;
    input.value = '';
    this.enrollTarget = null;
    if (!file || !target) return;
    if (this.actionBusy) return;
    this.actionBusy = true;
    this.staffAttendance.enrollFace(target.employeeId, file, file.name).subscribe({
      next: () => {
        this.actionBusy = false;
        this.snackBar.open(`Face enrolled for ${target.employeeName}`, 'Close', { duration: 3000 });
        this.loadRows();
      },
      error: (err) => {
        this.actionBusy = false;
        this.snackBar.open(this.errorMessage(err, 'Face enrollment failed'), 'Close', { duration: 4000 });
        this.cdr.detectChanges();
      },
    });
  }

  deactivateFace(row: StaffAttendanceRowDto): void {
    if (!this.canEdit || !row.isFaceEnrolled || this.actionBusy) return;
    this.actionBusy = true;
    this.staffAttendance.deactivateFaceEnrollment(row.employeeId).subscribe({
      next: () => {
        this.actionBusy = false;
        this.snackBar.open(`Face enrollment removed for ${row.employeeName}`, 'Close', { duration: 3000 });
        this.loadRows();
      },
      error: (err) => {
        this.actionBusy = false;
        this.snackBar.open(this.errorMessage(err, 'Could not remove face enrollment'), 'Close', {
          duration: 4000,
        });
        this.cdr.detectChanges();
      },
    });
  }

  private async startWebcam(): Promise<void> {
    this.stopWebcam();
    if (!navigator.mediaDevices?.getUserMedia) {
      this.webcamError = 'Camera not supported in this browser. Use file upload.';
      this.cdr.detectChanges();
      return;
    }
    try {
      this.webcamStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      const video = this.webcamVideo?.nativeElement;
      if (video) {
        video.srcObject = this.webcamStream;
        await video.play();
      }
      this.webcamError = '';
      this.cdr.detectChanges();
    } catch {
      this.webcamError = 'Unable to access camera. Use file upload instead.';
      this.cdr.detectChanges();
    }
  }

  private stopWebcam(): void {
    this.webcamStream?.getTracks().forEach((t) => t.stop());
    this.webcamStream = null;
    const video = this.webcamVideo?.nativeElement;
    if (video) {
      video.srcObject = null;
    }
  }

  private errorMessage(err: unknown, fallback: string): string {
    const e = err as { status?: number; error?: unknown; message?: string };
    if (e?.status === 403) return 'You do not have permission for this action.';
    if (typeof e?.error === 'string' && e.error.trim()) return e.error;
    if (e?.error && typeof e.error === 'object') {
      const msg = (e.error as { message?: string }).message;
      if (msg) return msg;
    }
    return e?.message || fallback;
  }

  private formatDisplayDate(value: string): string {
    const [year, month, day] = value.split('-');
    return year && month && day ? `${day}-${month}-${year}` : value;
  }

  private localDateString(date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
