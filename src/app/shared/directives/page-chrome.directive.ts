import { Directive, OnDestroy, effect, inject, input } from '@angular/core';
import { PageChromeService } from '../../core/services/page-chrome.service';

/**
 * Registers page title/description into the top navbar chrome.
 * Use on form screens that previously rendered an in-page `.page-title`.
 *
 * @example
 * <span [appPageChrome]="pageTitle" [pageChromeSubtitle]="subtitle"></span>
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

  constructor() {
    effect(() => {
      this.pageChrome.set(this.appPageChrome(), this.pageChromeSubtitle(), this);
    });
  }

  ngOnDestroy(): void {
    this.pageChrome.clear(this);
  }
}
