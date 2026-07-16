import { Component, HostListener, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { AuthService } from '../../../core/services/auth.service';
import { AcademicYearContextService } from '../../../core/services/academic-year-context.service';
import { BranchContextService } from '../../../core/services/branch-context.service';
import { LayoutUiService } from '../../../core/services/layout-ui.service';
import { TenantService } from '../../../core/services/tenant.service';

@Component({
  selector: 'app-header',
  imports: [
    FormsModule,
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
  readonly branchContext = inject(BranchContextService);

  schoolName = 'SmartOps';
  selectedYearId: string | null = null;
  yearMenuOpen = false;
  branchMenuOpen = false;
  branchSearch = '';

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

  get showBranchPicker(): boolean {
    return this.branchContext.branches().length > 0;
  }

  get showBranchDropdown(): boolean {
    return this.branchContext.branches().length > 1;
  }

  toggleYearMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.yearMenuOpen = !this.yearMenuOpen;
    this.branchMenuOpen = false;
  }

  toggleBranchMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.branchMenuOpen = !this.branchMenuOpen;
    this.yearMenuOpen = false;
    if (this.branchMenuOpen) {
      this.branchSearch = '';
      this.branchContext.setSearchTerm('');
    }
  }

  pickYear(yearId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    this.yearMenuOpen = false;
    this.onYearChange(yearId);
  }

  pickBranch(branchId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    this.branchContext.switchBranch(branchId);
    this.branchMenuOpen = false;
    window.location.reload();
  }

  onBranchSearchChange(value: string): void {
    this.branchSearch = value;
    this.branchContext.setSearchTerm(value);
  }

  isBranchSelected(branchId: string): boolean {
    return this.branchContext.selectedBranchIds().includes(branchId);
  }

  toggleBranchSelection(branchId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.branchContext.toggleSelectedBranch(branchId);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.header-year-picker')) {
      this.yearMenuOpen = false;
    }
    if (!target.closest('.header-branch-picker')) {
      this.branchMenuOpen = false;
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
    this.branchContext.clear();
    this.auth.logout();
  }
}
