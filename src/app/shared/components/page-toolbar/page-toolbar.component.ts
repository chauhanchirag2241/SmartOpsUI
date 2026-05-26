import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { isInsideFilterDrop, isNativeSelectInteraction } from '../../utils/filter-panel.util';

@Component({
  selector: 'app-page-toolbar',
  standalone: true,
  imports: [FormsModule, MatIconModule],
  templateUrl: './page-toolbar.component.html',
})
export class PageToolbarComponent implements OnChanges {
  @Input() searchPlaceholder = 'Search...';
  @Input() showSearch = true;
  @Input() showExport = false;
  @Input() showFilter = true;
  @Input() filterPanelActive = false;
  @Input() searchValue = '';
  @Input() searchDisabled = false;
  @Input() searchInputId = '';
  @Output() searchSubmitted = new EventEmitter<string>();
  @Output() exportClicked = new EventEmitter<void>();
  @Output() advancedFiltersCleared = new EventEmitter<void>();

  searchDraft = '';
  showFilterMenu = false;
  private suppressFilterOutsideClose = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['searchValue']) {
      this.searchDraft = this.searchValue ?? '';
    }
  }

  submitSearch(): void {
    if (this.searchDisabled) {
      return;
    }
    this.searchSubmitted.emit(this.searchDraft.trim());
  }

  toggleFilterMenu(event: Event): void {
    event.stopPropagation();
    this.showFilterMenu = !this.showFilterMenu;
  }

  closeFilterMenu(event?: Event): void {
    event?.stopPropagation();
    this.showFilterMenu = false;
  }

  clearFilters(): void {
    this.advancedFiltersCleared.emit();
  }

  onExport(): void {
    this.exportClicked.emit();
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    if (isNativeSelectInteraction(event.target)) {
      this.suppressFilterOutsideClose = true;
      window.setTimeout(() => (this.suppressFilterOutsideClose = false), 250);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.showFilterMenu || this.suppressFilterOutsideClose) {
      return;
    }
    if (!isInsideFilterDrop(event)) {
      this.showFilterMenu = false;
    }
  }
}
