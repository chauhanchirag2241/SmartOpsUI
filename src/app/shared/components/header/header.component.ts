import { Component, HostListener, inject, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { AuthService } from '../../../core/services/auth.service';
import { AcademicYearContextService } from '../../../core/services/academic-year-context.service';
import { LayoutUiService } from '../../../core/services/layout-ui.service';
import { TenantService } from '../../../core/services/tenant.service';

@Component({
  selector: 'app-header',
  imports: [
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatMenuModule,
    MatToolbarModule,
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
})
export class HeaderComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly layoutUi = inject(LayoutUiService);
  readonly tenant = inject(TenantService);
  readonly ayContext = inject(AcademicYearContextService);

  schoolName = 'SmartOps';
  selectedYearId: string | null = null;
  yearMenuOpen = false;

  ngOnInit(): void {
    this.schoolName = this.tenant.displayName;
    this.selectedYearId = this.ayContext.effectiveYearId();
  }

  get academicYearLabel(): string {
    return this.ayContext.effectiveYearLabel();
  }

  get selectedYearLabel(): string {
    const id = this.selectedYearId ?? this.ayContext.effectiveYearId();
    const year = this.ayContext.dropdownYears().find((y) => y.id === id);
    if (year) {
      return `${year.name}${year.isCurrent ? ' (current)' : ''}`;
    }
    return this.academicYearLabel || 'Academic year';
  }

  toggleYearMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.yearMenuOpen = !this.yearMenuOpen;
  }

  pickYear(yearId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    this.yearMenuOpen = false;
    this.onYearChange(yearId);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.header-year-picker')) {
      this.yearMenuOpen = false;
    }
  }

  onYearChange(yearId: string): void {
    if (!yearId || yearId === this.ayContext.effectiveYearId()) {
      return;
    }
    this.selectedYearId = yearId;
    this.ayContext.switchAcademicYear(yearId);
  }

  onLogout(): void {
    this.ayContext.clear();
    this.auth.logout();
  }
}
