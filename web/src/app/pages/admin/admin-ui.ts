import { Component, computed, input, output } from '@angular/core';

// Small building blocks shared by the admin tables.

// "Showing 11–20 of 37" + previous / next.
@Component({
  selector: 'app-pager',
  template: `
    @if (total() > 0) {
      <div class="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-ink-soft">
        <span class="font-mono text-xs">{{ from() }}–{{ to() }} of {{ total() }}</span>
        <div class="flex gap-2">
          <button class="btn-ghost !px-3 !py-1.5" [disabled]="page() <= 1" (click)="pageChange.emit(page() - 1)">← Previous</button>
          <button class="btn-ghost !px-3 !py-1.5" [disabled]="to() >= total()" (click)="pageChange.emit(page() + 1)">Next →</button>
        </div>
      </div>
    }
  `,
})
export class PagerComponent {
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly total = input.required<number>();
  readonly pageChange = output<number>();

  readonly from = computed(() => (this.page() - 1) * this.pageSize() + 1);
  readonly to = computed(() => Math.min(this.total(), this.page() * this.pageSize()));
}

// Page title + one-line description, the same on every admin page.
@Component({
  selector: 'app-admin-heading',
  template: `
    <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="eyebrow">Admin</p>
        <h1 class="text-3xl font-extrabold">{{ title() }}</h1>
        @if (subtitle()) { <p class="mt-1 text-sm text-ink-soft">{{ subtitle() }}</p> }
      </div>
      <ng-content />
    </div>
  `,
})
export class AdminHeadingComponent {
  readonly title = input.required<string>();
  readonly subtitle = input('');
}

// Search box + status filter, used above each table.
@Component({
  selector: 'app-admin-filters',
  template: `
    <div class="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
      <input class="input sm:max-w-xs" type="search" [placeholder]="placeholder()" [value]="search()"
             (input)="searchChange.emit($any($event.target).value)" aria-label="Search" />
      <div class="flex flex-wrap gap-1.5" role="group" aria-label="Filter">
        @for (s of statuses(); track s.value) {
          <button class="pill !py-1 !text-xs" [class.pill-active]="status() === s.value" [attr.aria-pressed]="status() === s.value"
                  (click)="statusChange.emit(s.value)">{{ s.label }}</button>
        }
      </div>
    </div>
  `,
})
export class AdminFiltersComponent {
  readonly placeholder = input('Search…');
  readonly search = input('');
  readonly status = input('');
  readonly statuses = input.required<{ value: string; label: string }[]>();
  readonly searchChange = output<string>();
  readonly statusChange = output<string>();
}
