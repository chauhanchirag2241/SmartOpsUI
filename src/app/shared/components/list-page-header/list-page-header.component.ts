import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-list-page-header',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './list-page-header.component.html',
  styleUrl: './list-page-header.component.css',
})
export class ListPageHeaderComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() primaryLabel = '';
  @Input() primaryIcon = 'add';
  @Input() showPrimary = false;
  @Output() primaryClick = new EventEmitter<void>();
}
