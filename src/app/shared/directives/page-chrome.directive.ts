import { Directive, OnDestroy, effect, inject, input, output } from '@angular/core';
import { PageChromeService } from '../../core/services/page-chrome.service';

/**
 * Registers page title/description into the top navbar chrome.
 * Use on form screens that previously rendered an in-page `.page-title`.
 *
 * Set `[pageChromeShowBack]="true"` on add/edit/detail screens so Back
 * appears next to the title in the global header (not on list pages).
 *
 * @example
 * <span
 *   [appPageChrome]="pageTitle"
 *   [pageChromeSubtitle]="subtitle"
 *   [pageChromeShowBack]="true"
 *   (pageChromeBack)="cancel.emit()"
 * ></span>
 */
@Directive({
  selector: '[appPageChrome]',
  standalone: true,
  host: {
    class: 'page-chrome-anchor',
    'aria-hidden': 'true',
  },
})
export class PageChromeDirective implements OnDestroy {
  private readonly pageChrome = inject(PageChromeService);

  readonly appPageChrome = input.required<string>();
  readonly pageChromeSubtitle = input('');
  readonly pageChromeShowBack = input(false);
  readonly pageChromeBack = output<void>();

  private readonly invokeBack = (): void => {
    this.pageChromeBack.emit();
  };

  constructor() {
    effect(() => {
      this.pageChrome.set(
        this.appPageChrome(),
        this.pageChromeSubtitle(),
        this,
        this.pageChromeShowBack() ? this.invokeBack : null,
      );
    });
  }

  ngOnDestroy(): void {
    this.pageChrome.clear(this);
  }
}
