import { Component, inject, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { AuthService } from '../../../core/services/auth.service';
import { AcademicYearService } from '../../../core/services/academic-year.service';
import { LayoutUiService } from '../../../core/services/layout-ui.service';
import { TenantService } from '../../../core/services/tenant.service';

@Component({
  selector: 'app-header',
  imports: [MatButtonModule, MatDividerModule, MatIconModule, MatMenuModule, MatToolbarModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
})
export class HeaderComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly layoutUi = inject(LayoutUiService);
  readonly tenant = inject(TenantService);
  private readonly academicYearService = inject(AcademicYearService);

  schoolName = 'SmartOps';
  academicYearLabel = '';

  ngOnInit(): void {
    this.schoolName = this.tenant.displayName;
    this.loadActiveAcademicYear();
  }

  onLogout(): void {
    this.auth.logout();
  }

  private loadActiveAcademicYear(): void {
    this.academicYearService.getAcademicYearDropdown().subscribe({
      next: (years: { id: string; name: string; isActive?: boolean }[]) => {
        const active = (years || []).find((y) => y.isActive) ?? years?.[0];
        this.academicYearLabel = active?.name ?? '';
      },
      error: () => {
        this.academicYearLabel = '';
      },
    });
  }
}
