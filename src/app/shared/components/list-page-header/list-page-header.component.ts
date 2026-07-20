import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { PageChromeService } from '../../../core/services/page-chrome.service';

@Component({
  selector: 'app-list-page-header',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './list-page-header.component.html',
  styleUrl: './list-page-header.component.css',
})
export class ListPageHeaderComponent implements OnInit, OnChanges, OnDestroy {
  private readonly pageChrome = inject(PageChromeService);

  @Input() title = '';
  @Input() subtitle = '';
  @Input() primaryLabel = '';
  @Input() primaryIcon = 'add';
  @Input() showPrimary = false;
  @Output() primaryClick = new EventEmitter<void>();

  ngOnInit(): void {
    this.syncChrome();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['title'] || changes['subtitle']) {
      this.syncChrome();
    }
  }

  ngOnDestroy(): void {
    this.pageChrome.clear(this);
  }

  private syncChrome(): void {
    this.pageChrome.set(this.title, this.subtitle, this);
  }
}
