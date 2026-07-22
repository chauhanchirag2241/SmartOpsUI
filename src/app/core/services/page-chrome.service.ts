import { Injectable, inject, signal } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';

/**
 * Shared page title + description shown in the top navbar across all screens.
 * Feature headers (list-page-header, smart-data-table, forms) register here
 * instead of rendering large in-page titles.
 *
 * Add/edit/detail screens can also register a back handler so the navbar
 * shows a Back control next to the title (list pages omit this).
 */
@Injectable({ providedIn: 'root' })
export class PageChromeService {
  private readonly router = inject(Router);
  private owner: object | null = null;

  private readonly _title = signal('');
  private readonly _subtitle = signal('');
  private readonly _onBack = signal<(() => void) | null>(null);

  readonly title = this._title.asReadonly();
  readonly subtitle = this._subtitle.asReadonly();
  readonly onBack = this._onBack.asReadonly();

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationStart => event instanceof NavigationStart))
      .subscribe(() => this.reset());
  }

  set(
    title: string,
    subtitle = '',
    owner?: object,
    onBack: (() => void) | null = null,
  ): void {
    const nextTitle = (title ?? '').trim();
    const nextSubtitle = (subtitle ?? '').trim();
    if (owner) {
      this.owner = owner;
    }
    this._title.set(nextTitle);
    this._subtitle.set(nextSubtitle);
    this._onBack.set(onBack);
  }

  clear(owner?: object): void {
    if (owner && this.owner && this.owner !== owner) {
      return;
    }
    this.reset();
  }

  goBack(): void {
    this._onBack()?.();
  }

  private reset(): void {
    this.owner = null;
    this._title.set('');
    this._subtitle.set('');
    this._onBack.set(null);
  }
}
