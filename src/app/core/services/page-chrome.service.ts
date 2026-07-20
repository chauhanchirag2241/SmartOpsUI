import { Injectable, inject, signal } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';

/**
 * Shared page title + description shown in the top navbar across all screens.
 * Feature headers (list-page-header, smart-data-table, forms) register here
 * instead of rendering large in-page titles.
 */
@Injectable({ providedIn: 'root' })
export class PageChromeService {
  private readonly router = inject(Router);
  private owner: object | null = null;

  private readonly _title = signal('');
  private readonly _subtitle = signal('');

  readonly title = this._title.asReadonly();
  readonly subtitle = this._subtitle.asReadonly();

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationStart => event instanceof NavigationStart))
      .subscribe(() => this.reset());
  }

  set(title: string, subtitle = '', owner?: object): void {
    const nextTitle = (title ?? '').trim();
    const nextSubtitle = (subtitle ?? '').trim();
    if (owner) {
      this.owner = owner;
    }
    this._title.set(nextTitle);
    this._subtitle.set(nextSubtitle);
  }

  clear(owner?: object): void {
    if (owner && this.owner && this.owner !== owner) {
      return;
    }
    this.reset();
  }

  private reset(): void {
    this.owner = null;
    this._title.set('');
    this._subtitle.set('');
  }
}
