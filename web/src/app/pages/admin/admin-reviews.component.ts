import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, errorMessage } from '../../core/api.service';
import { AdminReview, AdminReviewDetails, PagedResult, Reply } from '../../core/models';
import { AdminFiltersComponent, AdminHeadingComponent, PagerComponent } from './admin-ui';

@Component({
  selector: 'app-admin-reviews',
  imports: [RouterLink, DatePipe, AdminHeadingComponent, AdminFiltersComponent, PagerComponent],
  template: `
    <app-admin-heading title="Reviews" subtitle="Open a review to read its discussion and moderate each reply." />

    @if (error()) { <p class="error mb-4">{{ error() }}</p> }

    <section class="card overflow-hidden">
      <app-admin-filters placeholder="Search title, text, recipe or author…" [search]="search()" [status]="status()" [statuses]="statuses"
                         (searchChange)="onSearch($event)" (statusChange)="onStatus($event)" />

      <ul>
        @for (r of result()?.items ?? []; track r.id) {
          <li class="border-b border-line last:border-0">
            <div class="grid gap-3 px-4 py-4 md:grid-cols-[1fr_auto] md:items-center" [class.opacity-60]="r.isHidden">
              <div class="min-w-0">
                <p class="flex flex-wrap items-center gap-x-2 text-sm">
                  <span class="tracking-wider text-saffron-400" [attr.aria-label]="r.rating + ' out of 5'">{{ stars(r.rating) }}</span>
                  <span class="font-semibold">{{ r.title || '(no title)' }}</span>
                  @if (r.isHidden) { <span class="rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold text-white">Hidden</span> }
                  @if (r.hiddenReplyCount) { <span class="rounded-full bg-saffron-100 px-2 py-0.5 text-[10px] font-semibold text-saffron-600">{{ r.hiddenReplyCount }} hidden {{ r.hiddenReplyCount === 1 ? 'reply' : 'replies' }}</span> }
                </p>
                @if (r.comment) { <p class="mt-1 truncate text-sm text-ink-soft">{{ r.comment }}</p> }
                <p class="mt-1 text-xs text-ink-faint">
                  {{ r.userName }} on <a [routerLink]="['/recipes', r.recipeId]" class="font-medium text-ink-soft hover:text-cobalt-600">{{ r.recipeName }}</a>
                  · {{ r.createdOn | date: 'd MMM y' }} · 👍 {{ r.helpfulCount }} · {{ r.replyCount }} {{ r.replyCount === 1 ? 'reply' : 'replies' }}
                </p>
              </div>
              <div class="flex gap-3 text-xs font-semibold">
                <button class="text-cobalt-600 hover:underline" [attr.aria-expanded]="openId() === r.id" (click)="toggleOpen(r)">{{ openId() === r.id ? 'Close' : 'Open' }}</button>
                <button class="text-ink-soft hover:text-ink" (click)="toggleReview(r)">{{ r.isHidden ? 'Unhide' : 'Hide' }}</button>
                <button class="text-harissa-600 hover:underline" (click)="deleteReview(r)">Delete</button>
              </div>
            </div>

            <!-- The discussion, inline under the row -->
            @if (openId() === r.id) {
              <div class="border-t border-line bg-paper/60 px-4 py-4">
                @if (details(); as d) {
                  @if (d.review.comment) { <p class="mb-4 whitespace-pre-line text-sm">{{ d.review.comment }}</p> }
                  @if (d.replies.length) {
                    <ul class="space-y-2">
                      @for (p of d.replies; track p.id) {
                        <li class="flex items-start justify-between gap-4 rounded-xl border border-line bg-white px-3 py-2.5 text-sm" [class.ml-6]="p.parentId" [class.opacity-60]="p.isHidden">
                          <div>
                            <p class="text-xs">
                              <span class="font-semibold">{{ p.userName }}</span>
                              @if (p.isRecipeAuthor) { <span class="ml-1 rounded-full bg-saffron-100 px-2 py-0.5 text-[10px] font-semibold text-saffron-600">Recipe author</span> }
                              @if (p.isHidden) { <span class="ml-1 rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold text-white">Hidden</span> }
                              <span class="ml-1 font-mono text-[11px] text-ink-faint">{{ p.createdOn | date: 'd MMM, HH:mm' }}</span>
                            </p>
                            <p class="mt-0.5 text-ink-soft">{{ p.content }}</p>
                          </div>
                          <div class="flex shrink-0 gap-3 text-xs font-semibold">
                            <button class="text-ink-soft hover:text-ink" (click)="toggleReply(p)">{{ p.isHidden ? 'Unhide' : 'Hide' }}</button>
                            <button class="text-harissa-600 hover:underline" (click)="deleteReply(p)">Delete</button>
                          </div>
                        </li>
                      }
                    </ul>
                  } @else {
                    <p class="text-sm text-ink-soft">No replies on this review.</p>
                  }
                } @else {
                  <p class="text-sm text-ink-soft">Loading the discussion…</p>
                }
              </div>
            }
          </li>
        } @empty {
          <li class="px-4 py-10 text-center text-sm text-ink-soft">{{ result() ? 'No review matches these filters.' : 'Loading…' }}</li>
        }
      </ul>

      @if (result(); as p) { <app-pager [page]="p.page" [pageSize]="p.pageSize" [total]="p.totalCount" (pageChange)="goTo($event)" /> }
    </section>
  `,
})
export class AdminReviewsComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly initialStatus = input('', { alias: 'status' });

  readonly statuses = [
    { value: '', label: 'All' },
    { value: 'visible', label: 'Visible' },
    { value: 'hidden', label: 'Hidden content' },
    { value: 'low', label: '1–2 stars' },
  ];
  readonly search = signal('');
  readonly status = signal('');
  readonly page = signal(1);
  readonly result = signal<PagedResult<AdminReview> | null>(null);
  readonly openId = signal<number | null>(null);
  readonly details = signal<AdminReviewDetails | null>(null);
  readonly error = signal('');
  private timer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.status.set(this.initialStatus() ?? '');
    this.load();
  }

  load(): void {
    this.api.getAdminReviews({ search: this.search(), status: this.status(), page: this.page(), pageSize: 10 }).subscribe({
      next: r => this.result.set(r),
      error: e => this.error.set(errorMessage(e)),
    });
  }

  onSearch(value: string): void {
    this.search.set(value);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.page.set(1); this.load(); }, 300);
  }

  onStatus(value: string): void {
    this.status.set(value);
    this.page.set(1);
    this.openId.set(null);
    this.load();
  }

  goTo(page: number): void {
    this.page.set(page);
    this.openId.set(null);
    this.load();
  }

  stars(rating: number): string {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  }

  toggleOpen(r: AdminReview): void {
    if (this.openId() === r.id) {
      this.openId.set(null);
      return;
    }
    this.openId.set(r.id);
    this.loadDetails(r.id);
  }

  toggleReview(r: AdminReview): void {
    this.api.setReviewHidden(r.id, !r.isHidden).subscribe({ next: () => this.load(), error: e => this.error.set(errorMessage(e)) });
  }

  deleteReview(r: AdminReview): void {
    if (!confirm(`Delete the review "${r.title || r.userName}" and its discussion?`)) return;
    this.api.deleteReview(r.id).subscribe({ next: () => { this.openId.set(null); this.load(); }, error: e => this.error.set(errorMessage(e)) });
  }

  toggleReply(p: Reply): void {
    this.api.setReplyHidden(p.id, !p.isHidden).subscribe({ next: () => this.refreshOpen(), error: e => this.error.set(errorMessage(e)) });
  }

  deleteReply(p: Reply): void {
    if (!confirm('Delete this reply and the answers under it?')) return;
    this.api.deleteReply(p.id).subscribe({ next: () => this.refreshOpen(), error: e => this.error.set(errorMessage(e)) });
  }

  private loadDetails(id: number): void {
    this.details.set(null);
    this.api.getAdminReview(id).subscribe({ next: d => this.details.set(d), error: e => this.error.set(errorMessage(e)) });
  }

  // Reload both the open discussion and the row counters.
  private refreshOpen(): void {
    const id = this.openId();
    if (id) this.loadDetails(id);
    this.load();
  }
}
