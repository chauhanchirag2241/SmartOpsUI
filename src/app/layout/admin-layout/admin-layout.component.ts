import { Component, inject } from '@angular/core';
import { LayoutUiService } from '../../core/services/layout-ui.service';
import { RouterOutlet } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';

@Component({
  selector: 'app-admin-layout',
  imports: [FooterComponent, HeaderComponent, MatSidenavModule, MatButtonModule, MatIconModule, RouterOutlet, SidebarComponent],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.css',
})
export class AdminLayoutComponent {
  readonly layoutUi = inject(LayoutUiService);

  onMenuToggle(): void {
    this.layoutUi.toggleSidebar();
  }
}
