import { Component, OnInit, inject, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Observable, catchError, EMPTY, map, switchMap } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { StudentService } from '../../../core/services/student.service';
import { EmployeeService } from '../../../core/services/employee.service';
import { ClassService } from '../../../core/services/class.service';
import { SubjectService } from '../../../core/services/subject.service';
import { ShiftService } from '../../../core/services/shift.service';
import { PeriodTemplateService } from '../../../core/services/period-template.service';
import { AcademicYearService } from '../../../core/services/academic-year.service';
import { FrontOfficeService } from '../../../core/services/front-office.service';
import { AuditHistoryEntityType } from '../../../core/services/audit.service';
import { AuditHistoryComponent } from '../../components/audit-history/audit-history.component';
import { PageChromeDirective } from '../../directives/page-chrome.directive';

const GUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type EntityHistoryKind = AuditHistoryEntityType;

interface EntityHistoryRouteConfig {
  listRoute: string;
  entityType: EntityHistoryKind;
}

const ROUTE_CONFIG: Record<EntityHistoryKind, EntityHistoryRouteConfig> = {
  student: { listRoute: '/students', entityType: 'student' },
  employee: { listRoute: '/employees', entityType: 'employee' },
  class: { listRoute: '/classes', entityType: 'class' },
  subject: { listRoute: '/subjects', entityType: 'subject' },
  shift: { listRoute: '/shifts', entityType: 'shift' },
  period: { listRoute: '/timetable/periods', entityType: 'period' },
  'academic-year': { listRoute: '/academic-years', entityType: 'academic-year' },
  visitor: { listRoute: '/front-office/visitors', entityType: 'visitor' },
  'phone-log': { listRoute: '/front-office/phone-logs', entityType: 'phone-log' },
  complaint: { listRoute: '/front-office/complaints', entityType: 'complaint' },
  'admission-inquiry': {
    listRoute: '/front-office/admission-inquiries',
    entityType: 'admission-inquiry',
  },
};

interface EntityHistoryHeader {
  title: string;
  subtitle: string;
}

@Component({
  selector: 'app-entity-history',
  standalone: true,
  imports: [CommonModule, MatIconModule, AuditHistoryComponent, PageChromeDirective],
  templateUrl: './entity-history.component.html',
  styleUrl: './entity-history.component.css',
})
export class EntityHistoryComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly studentService = inject(StudentService);
  private readonly employeeService = inject(EmployeeService);
  private readonly classService = inject(ClassService);
  private readonly subjectService = inject(SubjectService);
  private readonly shiftService = inject(ShiftService);
  private readonly periodTemplateService = inject(PeriodTemplateService);
  private readonly academicYearService = inject(AcademicYearService);
  private readonly frontOfficeService = inject(FrontOfficeService);
  private readonly snackBar = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  entityId = '';
  entityType: EntityHistoryKind = 'student';
  listRoute = '/students';
  recordTitle = '';
  recordSubtitle = '';
  loadingHeader = true;

  get historyChromeSubtitle(): string {
    if (this.loadingHeader || !this.recordTitle) {
      return '';
    }
    return this.recordSubtitle ? `${this.recordTitle} · ${this.recordSubtitle}` : this.recordTitle;
  }

  ngOnInit(): void {
    const kind = (this.route.snapshot.data['entityKind'] as EntityHistoryKind) ?? 'student';
    const config = ROUTE_CONFIG[kind] ?? ROUTE_CONFIG.student;
    this.entityType = config.entityType;
    this.listRoute = config.listRoute;

    this.route.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((params) => {
          const id = (params.get('id') ?? '').trim();
          if (!id || !GUID_REGEX.test(id)) {
            this.router.navigate([this.listRoute]);
            return EMPTY;
          }
          this.entityId = id;
          this.loadingHeader = true;
          this.recordTitle = '';
          this.recordSubtitle = '';
          this.cdr.markForCheck();
          return this.loadHeader(kind, id).pipe(
            catchError(() => {
              this.snackBar.open('Failed to load record', 'Close', {
                duration: 3000,
                panelClass: 'snack-error',
              });
              this.router.navigate([this.listRoute]);
              return EMPTY;
            }),
          );
        }),
      )
      .subscribe({
        next: (header) => {
          this.recordTitle = header.title;
          this.recordSubtitle = header.subtitle;
          this.loadingHeader = false;
          this.cdr.markForCheck();
        },
      });
  }

  goBack(): void {
    this.router.navigate([this.listRoute]);
  }

  private loadHeader(kind: EntityHistoryKind, id: string): Observable<EntityHistoryHeader> {
    switch (kind) {
      case 'employee':
        return this.employeeService.getEmployeeById(id).pipe(
          map((data) => ({
            title:
              [data.firstName, data.lastName]
                .map((p: string) => String(p ?? '').trim())
                .filter(Boolean)
                .join(' ') || 'Employee',
            subtitle: [data.employeeCode ?? data.employeeId, data.email]
              .map((p: string) => String(p ?? '').trim())
              .filter(Boolean)
              .join(' · '),
          })),
        );
      case 'class':
        return this.classService.getClassById(id).pipe(
          map((data) => ({
            title: String(data.className ?? 'Class').trim() || 'Class',
            subtitle: [
              data.section != null ? `Section ${data.section}` : '',
              data.roomNumber ? `Room ${data.roomNumber}` : '',
            ]
              .map((p) => String(p).trim())
              .filter(Boolean)
              .join(' · '),
          })),
        );
      case 'subject':
        return this.subjectService.getSubject(id).pipe(
          map((data) => ({
            title: String(data.subjectName ?? 'Subject').trim() || 'Subject',
            subtitle: String(data.subjectCode ?? '').trim(),
          })),
        );
      case 'shift':
        return this.shiftService.getShift(id).pipe(
          map((data) => ({
            title: String(data.shiftName ?? 'Shift').trim() || 'Shift',
            subtitle: [data.startTime, data.endTime]
              .map((p) => String(p ?? '').trim())
              .filter(Boolean)
              .join(' - '),
          })),
        );
      case 'period':
        return this.periodTemplateService.get(id).pipe(
          map((data) => ({
            title: String(data.name ?? 'Period template').trim() || 'Period template',
            subtitle: `${(data.periods || []).length} periods`,
          })),
        );
      case 'academic-year':
        return this.academicYearService.getAcademicYearById(id).pipe(
          map((raw) => {
            const data = raw as Record<string, unknown>;
            const title = String(data['title'] ?? 'Academic year').trim() || 'Academic year';
            const start = String(data['startDate'] ?? '').trim();
            const end = String(data['endDate'] ?? '').trim();
            const subtitle = [start, end].filter(Boolean).join(' → ');
            return { title, subtitle };
          }),
        );
      case 'visitor':
        return this.frontOfficeService.getVisitor(id).pipe(
          map((data) => ({
            title: String(data.name ?? 'Visitor').trim() || 'Visitor',
            subtitle: [data.phone, data.purposeName]
              .map((p) => String(p ?? '').trim())
              .filter(Boolean)
              .join(' · '),
          })),
        );
      case 'phone-log':
        return this.frontOfficeService.getPhoneLog(id).pipe(
          map((data) => ({
            title: String(data.callerName ?? 'Phone log').trim() || 'Phone log',
            subtitle: [data.phone, data.callTypeLabel]
              .map((p) => String(p ?? '').trim())
              .filter(Boolean)
              .join(' · '),
          })),
        );
      case 'complaint':
        return this.frontOfficeService.getComplaint(id).pipe(
          map((data) => ({
            title:
              String(
                data.isAnonymous
                  ? 'Anonymous complaint'
                  : (data.complainantName ?? data.complaintTypeName ?? 'Complaint'),
              ).trim() || 'Complaint',
            subtitle: [data.complaintTypeName, data.statusLabel]
              .map((p) => String(p ?? '').trim())
              .filter(Boolean)
              .join(' · '),
          })),
        );
      case 'admission-inquiry':
        return this.frontOfficeService.getAdmissionInquiry(id).pipe(
          map((data) => ({
            title: String(data.studentName ?? data.parentName ?? 'Inquiry').trim() || 'Inquiry',
            subtitle: [data.parentName, data.statusLabel, data.classLabel]
              .map((p) => String(p ?? '').trim())
              .filter(Boolean)
              .join(' · '),
          })),
        );
      case 'student':
      default:
        return this.studentService.getStudentById(id).pipe(
          map((data) => ({
            title:
              [data.firstName, data.middleName, data.lastName]
                .map((p: string) => String(p ?? '').trim())
                .filter(Boolean)
                .join(' ') || 'Student',
            subtitle: String(data.admissionNo ?? '').trim(),
          })),
        );
    }
  }
}
