import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpParams } from '@angular/common/http';
import { ApiService } from './api.service';

// ── Grade scales ─────────────────────────────────────────────

export interface ExamGradeScaleDetail {
  id?: string | null;
  grade: string;
  minPercent: number;
  maxPercent: number;
  gradePoint?: number | null;
  description?: string | null;
  displayOrder: number;
}

export interface ExamGradeScale {
  id: string;
  name: string;
  description?: string | null;
  isDefault: boolean;
  grades: ExamGradeScaleDetail[];
}

export interface SaveExamGradeScaleRequest {
  name: string;
  description?: string | null;
  isDefault: boolean;
  grades: ExamGradeScaleDetail[];
}

// ── Exam groups ──────────────────────────────────────────────

export enum ExamEvaluationType {
  Marks = 0,
  Grade = 1,
  Both = 2,
}

export interface ExamGroup {
  id: string;
  name: string;
  description?: string | null;
  academicYearId: string;
  academicYearTitle: string;
  gradeScaleId?: string | null;
  gradeScaleName?: string | null;
  evaluationType: ExamEvaluationType;
  evaluationTypeLabel: string;
  examCount: number;
}

export interface SaveExamGroupRequest {
  name: string;
  description?: string | null;
  academicYearId: string;
  gradeScaleId?: string | null;
  evaluationType: ExamEvaluationType;
}

// ── Exams ────────────────────────────────────────────────────

export enum ExamStatus {
  Draft = 0,
  Scheduled = 1,
  Ongoing = 2,
  Completed = 3,
  ResultDeclared = 4,
}

export interface ExamMarkComponent {
  id?: string | null;
  name: string;
  maxMarks: number;
  passingMarks?: number | null;
  displayOrder: number;
}

export interface ExamClassInfo {
  classId: string;
  className: string;
}

export interface ExamListItem {
  id: string;
  name: string;
  examType: string;
  examGroupId: string;
  examGroupName: string;
  startDate: string;
  endDate: string;
  status: ExamStatus;
  statusLabel: string;
  resultDeclared: boolean;
  totalMaxMarks: number;
  subjectCount: number;
  classes: ExamClassInfo[];
}

export interface ExamDetail {
  id: string;
  examGroupId: string;
  examGroupName: string;
  name: string;
  examType: string;
  academicPeriodId?: string | null;
  startDate: string;
  endDate: string;
  minPassPercent: number;
  gradeScaleId?: string | null;
  status: ExamStatus;
  statusLabel: string;
  resultDeclared: boolean;
  description?: string | null;
  classIds: string[];
  classes: ExamClassInfo[];
  components: ExamMarkComponent[];
}

export interface SaveExamRequest {
  examGroupId: string;
  name: string;
  examType: string;
  academicPeriodId?: string | null;
  startDate: string;
  endDate: string;
  minPassPercent: number;
  gradeScaleId?: string | null;
  description?: string | null;
  classIds: string[];
  components: ExamMarkComponent[];
}

export interface ExamStats {
  total: number;
  ongoing: number;
  completed: number;
  upcoming: number;
}

// ── Schedule ─────────────────────────────────────────────────

export interface ExamScheduleItem {
  id: string;
  examId: string;
  examName: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  examDate: string;
  startTime?: string | null;
  endTime?: string | null;
  roomNo?: string | null;
  invigilatorId?: string | null;
  invigilatorName?: string | null;
  maxMarks: number;
  status: string;
}

export interface SaveExamScheduleRequest {
  examId: string;
  classId: string;
  subjectId: string;
  examDate: string;
  startTime?: string | null;
  endTime?: string | null;
  roomNo?: string | null;
  invigilatorId?: string | null;
}

// ── Marks entry ──────────────────────────────────────────────

export interface ExamComponentMark {
  componentId: string;
  marksObtained?: number | null;
}

export interface ExamStudentMarksRow {
  studentId: string;
  studentName: string;
  rollNo: string;
  isAbsent: boolean;
  remark?: string | null;
  marks: ExamComponentMark[];
}

export interface ExamMarksGrid {
  examScheduleId: string;
  examId: string;
  examName: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  minPassPercent: number;
  components: ExamMarkComponent[];
  students: ExamStudentMarksRow[];
}

export interface SaveStudentMarks {
  studentId: string;
  isAbsent: boolean;
  remark?: string | null;
  marks: ExamComponentMark[];
}

export interface SaveExamMarksRequest {
  examScheduleId: string;
  students: SaveStudentMarks[];
}

export interface ExamSubjectProgress {
  examScheduleId: string;
  subjectId: string;
  subjectName: string;
  entered: number;
  total: number;
}

// ── Results ──────────────────────────────────────────────────

export enum ExamResultStatus {
  Pending = 0,
  Pass = 1,
  Fail = 2,
  Absent = 3,
}

export interface ExamResultSubjectMark {
  subjectId: string;
  marks?: number | null;
  isAbsent: boolean;
  pass: boolean;
}

export interface ExamResultRow {
  studentId: string;
  studentName: string;
  rollNo: string;
  rank: number;
  totalMarks: number;
  maxMarks: number;
  percentage: number;
  grade?: string | null;
  result: ExamResultStatus;
  resultLabel: string;
  subjectMarks: ExamResultSubjectMark[];
}

export interface ExamResultSubjectColumn {
  subjectId: string;
  subjectName: string;
  maxMarks: number;
}

export interface ExamResultSheet {
  examId: string;
  examName: string;
  classId: string;
  className: string;
  resultDeclared: boolean;
  totalStudents: number;
  passCount: number;
  failCount: number;
  absentCount: number;
  classAveragePercent: number;
  topScore: number;
  maxMarks: number;
  subjects: ExamResultSubjectColumn[];
  rows: ExamResultRow[];
}

export interface ReportCardSubjectRow {
  subjectName: string;
  maxMarks: number;
  marksObtained?: number | null;
  percentage: number;
  grade?: string | null;
  isAbsent: boolean;
  pass: boolean;
}

export interface ReportCard {
  examId: string;
  examName: string;
  examType: string;
  academicYearTitle: string;
  studentId: string;
  studentName: string;
  rollNo: string;
  className: string;
  totalMarks: number;
  maxMarks: number;
  percentage: number;
  grade?: string | null;
  rank: number;
  totalStudents: number;
  result: ExamResultStatus;
  resultLabel: string;
  subjects: ReportCardSubjectRow[];
}

// ── Hall tickets ─────────────────────────────────────────────

export interface HallTicketSchedule {
  subjectName: string;
  examDate: string;
  startTime?: string | null;
  endTime?: string | null;
  roomNo?: string | null;
}

export interface HallTicket {
  id: string;
  studentId: string;
  studentName: string;
  rollNo: string;
  className: string;
  ticketNo: string;
  seatNo?: string | null;
  examId: string;
  examName: string;
  startDate: string;
  endDate: string;
  schedule: HallTicketSchedule[];
}

@Injectable({ providedIn: 'root' })
export class ExamService {
  private readonly api = inject(ApiService);

  // Grade scales
  getGradeScales(): Observable<ExamGradeScale[]> {
    return this.api.get<ExamGradeScale[]>('exam-grade-scales');
  }

  createGradeScale(data: SaveExamGradeScaleRequest): Observable<ExamGradeScale> {
    return this.api.post<ExamGradeScale>('exam-grade-scales', data);
  }

  updateGradeScale(id: string, data: SaveExamGradeScaleRequest): Observable<ExamGradeScale> {
    return this.api.put<ExamGradeScale>(`exam-grade-scales/${id}`, data);
  }

  deleteGradeScale(id: string): Observable<void> {
    return this.api.delete<void>(`exam-grade-scales/${id}`);
  }

  // Exam groups
  getGroups(): Observable<ExamGroup[]> {
    return this.api.get<ExamGroup[]>('exam-groups');
  }

  createGroup(data: SaveExamGroupRequest): Observable<ExamGroup> {
    return this.api.post<ExamGroup>('exam-groups', data);
  }

  updateGroup(id: string, data: SaveExamGroupRequest): Observable<ExamGroup> {
    return this.api.put<ExamGroup>(`exam-groups/${id}`, data);
  }

  deleteGroup(id: string): Observable<void> {
    return this.api.delete<void>(`exam-groups/${id}`);
  }

  // Exams
  getExams(filters?: {
    groupId?: string;
    classId?: string;
    status?: number;
    search?: string;
  }): Observable<ExamListItem[]> {
    let params = new HttpParams();
    if (filters?.groupId) params = params.set('groupId', filters.groupId);
    if (filters?.classId) params = params.set('classId', filters.classId);
    if (filters?.status !== undefined && filters.status !== null) {
      params = params.set('status', String(filters.status));
    }
    if (filters?.search) params = params.set('search', filters.search);
    return this.api.get<ExamListItem[]>('exams', params);
  }

  getExamStats(): Observable<ExamStats> {
    return this.api.get<ExamStats>('exams/stats');
  }

  getExam(id: string): Observable<ExamDetail> {
    return this.api.get<ExamDetail>(`exams/${id}`);
  }

  createExam(data: SaveExamRequest): Observable<ExamDetail> {
    return this.api.post<ExamDetail>('exams', data);
  }

  updateExam(id: string, data: SaveExamRequest): Observable<ExamDetail> {
    return this.api.put<ExamDetail>(`exams/${id}`, data);
  }

  updateExamStatus(id: string, status: ExamStatus): Observable<void> {
    return this.api.put<void>(`exams/${id}/status`, { status });
  }

  deleteExam(id: string): Observable<void> {
    return this.api.delete<void>(`exams/${id}`);
  }

  // Schedule
  getSchedules(examId?: string, classId?: string): Observable<ExamScheduleItem[]> {
    let params = new HttpParams();
    if (examId) params = params.set('examId', examId);
    if (classId) params = params.set('classId', classId);
    return this.api.get<ExamScheduleItem[]>('exam-schedules', params);
  }

  createSchedule(data: SaveExamScheduleRequest): Observable<ExamScheduleItem> {
    return this.api.post<ExamScheduleItem>('exam-schedules', data);
  }

  updateSchedule(id: string, data: SaveExamScheduleRequest): Observable<ExamScheduleItem> {
    return this.api.put<ExamScheduleItem>(`exam-schedules/${id}`, data);
  }

  deleteSchedule(id: string): Observable<void> {
    return this.api.delete<void>(`exam-schedules/${id}`);
  }

  // Marks entry
  getMarksGrid(scheduleId: string): Observable<ExamMarksGrid> {
    return this.api.get<ExamMarksGrid>(`exam-marks/grid/${scheduleId}`);
  }

  getSubjectProgress(examId: string, classId: string): Observable<ExamSubjectProgress[]> {
    const params = new HttpParams().set('examId', examId).set('classId', classId);
    return this.api.get<ExamSubjectProgress[]>('exam-marks/subject-progress', params);
  }

  saveMarks(data: SaveExamMarksRequest): Observable<ExamMarksGrid> {
    return this.api.post<ExamMarksGrid>('exam-marks/save', data);
  }

  // Results
  getResultSheet(examId: string, classId: string): Observable<ExamResultSheet> {
    const params = new HttpParams().set('examId', examId).set('classId', classId);
    return this.api.get<ExamResultSheet>('exam-results/sheet', params);
  }

  calculateResults(examId: string, classId: string): Observable<ExamResultSheet> {
    return this.api.post<ExamResultSheet>('exam-results/calculate', { examId, classId });
  }

  declareResults(examId: string, classId: string): Observable<ExamResultSheet> {
    return this.api.post<ExamResultSheet>('exam-results/declare', { examId, classId });
  }

  getReportCard(examId: string, studentId: string): Observable<ReportCard> {
    const params = new HttpParams().set('examId', examId).set('studentId', studentId);
    return this.api.get<ReportCard>('exam-results/report-card', params);
  }

  // Hall tickets
  getHallTickets(examId: string, classId: string): Observable<HallTicket[]> {
    const params = new HttpParams().set('examId', examId).set('classId', classId);
    return this.api.get<HallTicket[]>('exam-hall-tickets', params);
  }

  generateHallTickets(examId: string, classId: string): Observable<HallTicket[]> {
    return this.api.post<HallTicket[]>('exam-hall-tickets/generate', { examId, classId });
  }
}
