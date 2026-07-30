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
import { PageChromeService } from '../../../core/services/page-chrome.service';

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
  readonly ayContext = inject(AcademicYearContextService);
  readonly branchContext = inject(BranchContextService);
  readonly pageChrome = inject(PageChromeService);

  branchMenuOpen = false;
  branchSearch = '';

  ngOnInit(): void {
    // Academic year selection lives on Settings; header only shows the effective label.
  }

  get academicYearLabel(): string {
    return this.ayContext.effectiveYearLabel();
  }

  get showBranchPicker(): boolean {
    return this.branchContext.branches().length > 0;
  }

  get showBranchDropdown(): boolean {
    return this.branchContext.branches().length > 0;
  }

  toggleBranchMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.branchMenuOpen = !this.branchMenuOpen;
    if (this.branchMenuOpen) {
      this.branchSearch = '';
      this.branchContext.setSearchTerm('');
    }
  }

  pickBranch(branchId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    this.branchContext.switchBranch(branchId);
    this.branchMenuOpen = false;
    // Selected AY is branch-scoped; clear before reload so the new branch's current year is used.
    this.ayContext.clear();
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
    if (!target.closest('.header-branch-picker')) {
      this.branchMenuOpen = false;
    }
  }

  onLogout(): void {
    this.ayContext.clear();
    this.branchContext.clear();
    this.auth.logout();
  }
}
