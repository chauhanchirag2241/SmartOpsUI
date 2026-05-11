import { Component, EventEmitter, Output, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-header',
  imports: [MatButtonModule, MatDividerModule, MatIconModule, MatMenuModule, MatToolbarModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
})
export class HeaderComponent {
  @Output() readonly menuToggle = new EventEmitter<void>();
  readonly auth = inject(AuthService);

  onMenuToggle(): void {
    this.menuToggle.emit();
  }

  onLogout(): void {
    this.auth.logout();
  }
}
