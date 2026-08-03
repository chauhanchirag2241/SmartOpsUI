import { CommonModule } from '@angular/common';
import {
  CdkConnectedOverlay,
  CdkOverlayOrigin,
  ConnectedPosition,
} from '@angular/cdk/overlay';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  Input,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MappingOption } from '../../mapping/mapping.types';

@Component({
  selector: 'app-multi-select-chips',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCheckboxModule,
    MatIconModule,
    CdkConnectedOverlay,
    CdkOverlayOrigin,
  ],
  templateUrl: './multi-select-chips.component.html',
  styleUrl: './multi-select-chips.component.css',
})
export class MultiSelectChipsComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild('origin', { read: CdkOverlayOrigin }) origin?: CdkOverlayOrigin;
  @ViewChild('controlEl') controlEl?: ElementRef<HTMLElement>;

  @Input() options: MappingOption[] = [];
  @Input() selectedIds: string[] = [];
  /** IDs that stay selected and cannot be removed (e.g. existing fee master classes). */
  @Input() lockedIds: string[] = [];
  @Input() disabled = false;
  @Input() placeholder = 'Select…';
  @Input() searchPlaceholder = 'Search';
  @Input() maxVisibleChips = 3;
  @Input() singleSelect = false;
  @Input() compact = false;

  @Output() selectedIdsChange = new EventEmitter<string[]>();

  panelOpen = false;
  searchTerm = '';
  overlayWidth: number | string = '100%';

  readonly overlayPositions: ConnectedPosition[] = [
    {
      originX: 'start',
      originY: 'bottom',
      overlayX: 'start',
      overlayY: 'top',
      offsetY: 6,
    },
    {
      originX: 'start',
      originY: 'top',
      overlayX: 'start',
      overlayY: 'bottom',
      offsetY: -6,
    },
  ];

  @HostBinding('class.compact')
  get compactHostClass(): boolean {
    return this.compact;
  }

  get filteredOptions(): MappingOption[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return this.options;
    return this.options.filter((o) => o.name.toLowerCase().includes(term));
  }

  /** Selectable options in the current (filtered) list — excludes locked. */
  get selectableFilteredOptions(): MappingOption[] {
    return this.filteredOptions.filter((o) => !this.isLocked(o.id));
  }

  get allFilteredSelected(): boolean {
    const selectable = this.selectableFilteredOptions;
    return selectable.length > 0 && selectable.every((o) => this.isSelected(o.id));
  }

  get someFilteredSelected(): boolean {
    const selectable = this.selectableFilteredOptions;
    return selectable.some((o) => this.isSelected(o.id)) && !this.allFilteredSelected;
  }

  get selectAllLabel(): string {
    return this.allFilteredSelected ? 'Unselect all' : 'Select all';
  }

  get selectedOptions(): MappingOption[] {
    return this.selectedIds
      .map((id) => this.options.find((o) => o.id === id))
      .filter((o): o is MappingOption => !!o);
  }

  get selectionSummary(): string {
    const n = this.selectedOptions.length;
    if (n === 0) return '';
    if (n === 1) return this.selectedOptions[0].name;
    return `${n} selected`;
  }

  get visibleChips(): MappingOption[] {
    return this.selectedOptions.slice(0, this.maxVisibleChips);
  }

  get overflowCount(): number {
    return Math.max(0, this.selectedOptions.length - this.maxVisibleChips);
  }

  get showBulkActions(): boolean {
    return !this.singleSelect && this.filteredOptions.length > 0;
  }

  isSelected(id: string): boolean {
    return this.selectedIds.includes(id);
  }

  isLocked(id: string): boolean {
    return this.lockedIds.includes(id);
  }

  togglePanel(event: Event): void {
    if (this.disabled) return;
    event.stopPropagation();
    if (this.panelOpen) {
      this.closePanel();
      return;
    }
    this.openPanel();
  }

  openPanel(): void {
    if (this.disabled) return;
    this.syncOverlayWidth();
    this.searchTerm = '';
    this.panelOpen = true;
    this.cdr.markForCheck();
  }

  closePanel(): void {
    if (!this.panelOpen) return;
    this.panelOpen = false;
    this.searchTerm = '';
    this.cdr.markForCheck();
  }

  toggleOption(id: string, checked: boolean): void {
    if (this.disabled || !id || this.isLocked(id)) return;
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
    this.closePanel();
  }

  remove(id: string, event: Event): void {
    event.stopPropagation();
    if (this.disabled || this.isLocked(id)) return;
    this.selectedIdsChange.emit(this.selectedIds.filter((x) => x !== id));
  }

  /** Select / unselect all currently visible (filtered) options. */
  toggleSelectAll(event?: Event): void {
    event?.stopPropagation();
    if (this.disabled || this.singleSelect) return;

    const selectableIds = this.selectableFilteredOptions.map((o) => o.id);
    if (!selectableIds.length) return;

    if (this.allFilteredSelected) {
      const drop = new Set(selectableIds);
      const next = this.selectedIds.filter((id) => !drop.has(id) || this.isLocked(id));
      this.selectedIdsChange.emit(next);
    } else {
      const next = new Set(this.selectedIds);
      for (const id of selectableIds) next.add(id);
      this.selectedIdsChange.emit([...next]);
    }
    this.cdr.markForCheck();
  }

  clearAll(event: Event): void {
    event.stopPropagation();
    if (this.disabled) return;
    const locked = this.lockedIds.filter((id) => this.selectedIds.includes(id));
    if (!this.selectedIds.length && !locked.length) return;
    this.selectedIdsChange.emit(locked);
    this.cdr.markForCheck();
  }

  clearAllFromPanel(event: Event): void {
    this.clearAll(event);
  }

  private syncOverlayWidth(): void {
    const width =
      this.controlEl?.nativeElement.getBoundingClientRect().width ??
      this.host.nativeElement.getBoundingClientRect().width;
    this.overlayWidth = width > 0 ? width : '100%';
  }
}
