import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { AuthService } from '../../../core/services/auth.service';
import { LayoutUiService } from '../../../core/services/layout-ui.service';

@Component({
  selector: 'app-header',
  imports: [MatButtonModule, MatDividerModule, MatIconModule, MatMenuModule, MatToolbarModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
})
export class HeaderComponent {
  readonly auth = inject(AuthService);
  readonly layoutUi = inject(LayoutUiService);

  onLogout(): void {
    this.auth.logout();
  }
}
