import { Component, inject, OnInit } from '@angular/core';
import { LayoutUiService } from '../../core/services/layout-ui.service';
import { RouterOutlet } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { AcademicYearContextService } from '../../core/services/academic-year-context.service';
import { AuthService } from '../../core/services/auth.service';
import { switchMap } from 'rxjs';

@Component({
  selector: 'app-admin-layout',
  imports: [FooterComponent, HeaderComponent, MatSidenavModule, MatButtonModule, MatIconModule, RouterOutlet, SidebarComponent],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.css',
})
export class AdminLayoutComponent implements OnInit {
  readonly layoutUi = inject(LayoutUiService);
  readonly ayContext = inject(AcademicYearContextService);
  private readonly auth = inject(AuthService);

  ngOnInit(): void {
    if (!this.auth.isLoggedIn) {
      return;
    }

    this.ayContext
      .initialize()
      .pipe(switchMap(() => this.ayContext.loadDropdown()))
      .subscribe({ error: () => undefined });
  }

  onMenuToggle(): void {
    this.layoutUi.toggleSidebar();
  }
}
