import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
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

  schoolName = 'SmartOps';
  selectedYearId: string | null = null;

  ngOnInit(): void {
    this.schoolName = this.tenant.displayName;
    this.selectedYearId = this.ayContext.effectiveYearId();
  }

  get academicYearLabel(): string {
    return this.ayContext.effectiveYearLabel();
  }

  onYearChange(yearId: string): void {
    if (!yearId || yearId === this.ayContext.effectiveYearId()) {
      return;
    }
    this.selectedYearId = yearId;
    this.ayContext.setSelectedYearId(yearId);
    window.location.reload();
  }

  onLogout(): void {
    this.ayContext.clear();
    this.auth.logout();
  }
}
