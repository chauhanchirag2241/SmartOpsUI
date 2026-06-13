import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  Output,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MappingOption } from '../../mapping/mapping.types';

@Component({
  selector: 'app-multi-select-chips',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCheckboxModule, MatIconModule],
  templateUrl: './multi-select-chips.component.html',
  styleUrl: './multi-select-chips.component.css',
})
export class MultiSelectChipsComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() options: MappingOption[] = [];
  @Input() selectedIds: string[] = [];
  @Input() disabled = false;
  @Input() placeholder = 'Select…';
  @Input() searchPlaceholder = 'Search';
  @Input() maxVisibleChips = 3;
  @Input() singleSelect = false;
  @Input() compact = false;

  @Output() selectedIdsChange = new EventEmitter<string[]>();

  panelOpen = false;
  searchTerm = '';

  @HostBinding('class.compact')
  get compactHostClass(): boolean {
    return this.compact;
  }

  get filteredOptions(): MappingOption[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return this.options;
    return this.options.filter((o) => o.name.toLowerCase().includes(term));
  }

  get selectedOptions(): MappingOption[] {
    return this.selectedIds
      .map((id) => this.options.find((o) => o.id === id))
      .filter((o): o is MappingOption => !!o);
  }

  get visibleChips(): MappingOption[] {
    return this.selectedOptions.slice(0, this.maxVisibleChips);
  }

  get overflowCount(): number {
    return Math.max(0, this.selectedOptions.length - this.maxVisibleChips);
  }

  isSelected(id: string): boolean {
    return this.selectedIds.includes(id);
  }

  togglePanel(event: Event): void {
    if (this.disabled) return;
    event.stopPropagation();
    this.panelOpen = !this.panelOpen;
    if (this.panelOpen) {
      this.searchTerm = '';
    }
    this.cdr.markForCheck();
  }

  toggleOption(id: string, checked: boolean): void {
    if (this.disabled || !id) return;
    if (this.singleSelect) {
      this.selectSingle(checked ? id : '');
      return;
    }
    if (checked) {
      if (!this.selectedIds.includes(id)) {
        this.selectedIdsChange.emit([...this.selectedIds, id]);
      }
      return;
    }
    this.selectedIdsChange.emit(this.selectedIds.filter((x) => x !== id));
  }

  selectSingle(id: string): void {
    if (this.disabled) return;
    const next = id ? [id] : [];
    this.selectedIdsChange.emit(next);
    this.panelOpen = false;
    this.searchTerm = '';
    this.cdr.markForCheck();
  }

  remove(id: string, event: Event): void {
    event.stopPropagation();
    if (this.disabled) return;
    this.selectedIdsChange.emit(this.selectedIds.filter((x) => x !== id));
  }

  clearAll(event: Event): void {
    event.stopPropagation();
    if (this.disabled || !this.selectedIds.length) return;
    this.selectedIdsChange.emit([]);
    this.cdr.markForCheck();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.panelOpen) return;
    const target = event.target as Node | null;
    if (target && !this.host.nativeElement.contains(target)) {
      this.panelOpen = false;
      this.searchTerm = '';
      this.cdr.markForCheck();
    }
  }
}
