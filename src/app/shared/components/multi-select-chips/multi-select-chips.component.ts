import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MappingOption } from '../../mapping/mapping.types';

@Component({
  selector: 'app-multi-select-chips',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './multi-select-chips.component.html',
  styleUrl: './multi-select-chips.component.css',
})
export class MultiSelectChipsComponent {
  @Input() options: MappingOption[] = [];
  @Input() selectedIds: string[] = [];
  @Input() disabled = false;
  @Input() placeholder = 'Search and add…';

  @Output() selectedIdsChange = new EventEmitter<string[]>();

  searchTerm = '';

  get filteredOptions(): MappingOption[] {
    const term = this.searchTerm.trim().toLowerCase();
    return this.options.filter((o) => {
      if (this.selectedIds.includes(o.id)) return false;
      if (!term) return true;
      return o.name.toLowerCase().includes(term);
    });
  }

  getSelectedOptions(): MappingOption[] {
    return this.selectedIds
      .map((id) => this.options.find((o) => o.id === id))
      .filter((o): o is MappingOption => !!o);
  }

  add(id: string): void {
    if (this.disabled || !id || this.selectedIds.includes(id)) return;
    this.selectedIdsChange.emit([...this.selectedIds, id]);
    this.searchTerm = '';
  }

  remove(id: string): void {
    if (this.disabled) return;
    this.selectedIdsChange.emit(this.selectedIds.filter((x) => x !== id));
  }

  onPick(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const value = select.value;
    if (value) {
      this.add(value);
      select.value = '';
    }
  }
}
