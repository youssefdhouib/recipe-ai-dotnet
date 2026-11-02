import { DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiService, errorMessage } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { RatingSummary, Reply, Review, ReviewSort, SaveReview } from '../core/models';

// A top-level reply with its answers (threads are two levels deep, like the API).
interface Thread { reply: Reply; answers: Reply[]; }

@Component({
  selector: 'app-review-section',
  imports: [FormsModule, RouterLink, DatePipe, DecimalPipe, NgTemplateOutlet],
  template: `
    <div class="flex flex-wrap items-end justify-between gap-3">
      <h2 class="text-2xl font-bold">Reviews</h2>
      @if (reviews().length > 1) {
        <label class="flex items-center gap-2 text-sm text-ink-soft">
          Sort by
          <select class="input !w-auto !py-1.5" [ngModel]="sort()" (ngModelChange)="changeSort($event)">
            @for (s of sorts; track s.value) { <option [value]="s.value">{{ s.label }}</option> }
          </select>
        </label>
      }
    </div>

    <!-- Summary: average + how the ratings are spread -->
    @if (summary(); as s) {
      @if (s.count > 0) {
        <div class="card mt-4 grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:items-center">
          <div class="text-center sm:border-r sm:border-line sm:pr-6">
            <p class="font-display text-5xl font-extrabold leading-none">{{ s.average | number: '1.1-1' }}</p>
            <p class="mt-1 text-lg tracking-wider text-saffron-400" [attr.aria-label]="s.average + ' out of 5'">{{ stars(s.average) }}</p>
            <p class="font-mono text-[11px] text-ink-faint">{{ s.count }} {{ s.count === 1 ? 'review' : 'reviews' }}</p>
          </div>
          <ul class="space-y-1.5">
            @for (n of s.distribution; track $index) {
              <li class="grid grid-cols-[2.5rem_1fr_2rem] items-center gap-2 text-xs">
                <span class="font-mono text-ink-soft">{{ 5 - $index }} ★</span>
                <span class="h-2 overflow-hidden rounded-full bg-line/70">
                  <span class="block h-full rounded-full bg-saffron-400" [style.width.%]="s.count ? (n / s.count) * 100 : 0"></span>
                </span>
                <span class="text-right font-mono text-ink-faint">{{ n }}</span>
              </li>
            }
          </ul>
        </div>
      }
    }

    <!-- Write or edit a review -->
    @if (showForm()) {
      <form class="card mt-4 space-y-3 p-5" (ngSubmit)="saveReview()">
        <p class="font-display text-lg font-bold">{{ editingId() ? 'Edit your review' : 'Write a review' }}</p>
        <div class="flex items-center gap-1 text-2xl text-saffron-400" role="radiogroup" aria-label="Rating">
          @for (star of [1, 2, 3, 4, 5]; track star) {
            <button type="button" role="radio" class="transition hover:scale-110" [attr.aria-checked]="star === draft.rating"
                    (click)="draft.rating = star" [attr.aria-label]="star + ' stars'">{{ star <= draft.rating ? '★' : '☆' }}</button>
          }
          <span class="ml-2 font-mono text-xs text-ink-faint">{{ ratingWords[draft.rating] }}</span>
        </div>
        <input class="input" name="title" placeholder="Sum it up in a few words" maxlength="120" required [(ngModel)]="draft.title" />
        <textarea class="input" name="comment" rows="3" placeholder="How did it turn out? Any tips for the next cook?" maxlength="1000" [(ngModel)]="draft.comment"></textarea>
        @if (formError()) { <p class="error">{{ formError() }}</p> }
        <div class="flex gap-2">
          <button class="btn-primary" type="submit" [disabled]="!draft.title.trim()">{{ editingId() ? 'Save changes' : 'Post review' }}</button>
          @if (editingId()) { <button class="btn-ghost" type="button" (click)="cancelEdit()">Cancel</button> }
        </div>
      </form>
    } @else if (!auth.isLoggedIn()) {
      <p class="mt-4 text-sm text-ink-soft"><a routerLink="/login" class="font-semibold text-cobalt-600 underline">Sign in</a> to rate this recipe or join the discussion.</p>
    }

    @if (error()) { <p class="error mt-4">{{ error() }}</p> }

    <!-- The reviews -->
    <div class="mt-4 space-y-3">
      @for (rev of reviews(); track rev.id) {
        <article class="card p-5" [class.opacity-60]="rev.isHidden">
          <header class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-2.5">
              <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cobalt-50 font-display text-sm font-bold text-cobalt-700">{{ rev.userName.charAt(0) }}</span>
              <div>
                <p class="text-sm font-semibold leading-tight">
                  {{ rev.userName }}
                  @if (rev.userId === me()) { <span class="ml-1 rounded-full bg-cobalt-50 px-2 py-0.5 text-[10px] font-semibold text-cobalt-700">You</span> }
                </p>
                <p class="font-mono text-[11px] text-ink-faint">
                  {{ rev.createdOn | date: 'd MMM y' }}@if (rev.editedOn) { · edited }@if (rev.isHidden) { · hidden }
                </p>
              </div>
            </div>
            <span class="shrink-0 tracking-wider text-saffron-400" [attr.aria-label]="rev.rating + ' out of 5'">{{ stars(rev.rating) }}</span>
          </header>

          @if (rev.title) { <h3 class="mt-3 font-display text-base font-bold">{{ rev.title }}</h3> }
          @if (rev.comment) { <p class="mt-1 whitespace-pre-line text-sm text-ink-soft">{{ rev.comment }}</p> }

          <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium">
            @if (canVote(rev)) {
              <button class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 transition"
                      [class]="rev.votedByMe ? 'border-olive-600 bg-olive-100 text-olive-700' : 'border-line text-ink-soft hover:border-ink-faint'"
                      [attr.aria-pressed]="rev.votedByMe" (click)="toggleHelpful(rev)">
                👍 Helpful · {{ rev.helpfulCount }}
              </button>
            } @else if (rev.helpfulCount > 0) {
              <span class="text-ink-faint">👍 {{ rev.helpfulCount }} found this helpful</span>
            }
            @if (auth.isLoggedIn() && !rev.isHidden) {
              <button class="text-ink-soft hover:text-ink" (click)="openReply(rev.id, null, null)">Reply</button>
            }
            @if (rev.userId === me()) {
              <button class="text-ink-soft hover:text-ink" (click)="startEdit(rev)">Edit</button>
            }
            @if (rev.userId === me() || auth.isAdmin()) {
              <button class="text-harissa-600 hover:underline" (click)="deleteReview(rev)">Delete</button>
            }
            @if (auth.isAdmin()) {
              <button class="text-ink-faint underline hover:text-ink" (click)="toggleReviewHidden(rev)">{{ rev.isHidden ? 'Unhide' : 'Hide' }}</button>
            }
          </div>

          <!-- Discussion -->
          @if (rev.replies.length || replyTarget()?.reviewId === rev.id) {
            <div class="mt-4 space-y-3 border-l-2 border-line pl-4">
              @for (t of threads(rev); track t.reply.id) {
                <ng-container *ngTemplateOutlet="replyTpl; context: { $implicit: t.reply, review: rev }" />
                @if (t.answers.length) {
                  <div class="ml-5 space-y-3 border-l-2 border-cobalt-100 pl-4">
                    @for (a of t.answers; track a.id) {
                      <ng-container *ngTemplateOutlet="replyTpl; context: { $implicit: a, review: rev }" />
                    }
                  </div>
                }
                @if (replyTarget()?.reviewId === rev.id && replyTarget()?.threadId === t.reply.id) { <ng-container *ngTemplateOutlet="replyForm; context: { $implicit: rev }" /> }
              }
              @if (replyTarget()?.reviewId === rev.id && replyTarget()?.threadId === null) {
                <ng-container *ngTemplateOutlet="replyForm; context: { $implicit: rev }" />
              }
            </div>
          }
        </article>
      } @empty {
        <p class="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-ink-soft">
          No reviews yet. {{ canReview() ? 'Cooked it? Be the first to rate it.' : '' }}
        </p>
      }
    </div>

    <ng-template #replyTpl let-p let-rev="review">
      <div [class.opacity-60]="p.isHidden">
        <p class="text-xs">
          <span class="font-semibold text-ink">{{ p.userName }}</span>
          @if (p.isRecipeAuthor) { <span class="ml-1 rounded-full bg-saffron-100 px-2 py-0.5 text-[10px] font-semibold text-saffron-600">Recipe author</span> }
          <span class="ml-1 font-mono text-[11px] text-ink-faint">{{ p.createdOn | date: 'd MMM, HH:mm' }}@if (p.isHidden) { · hidden }</span>
        </p>
        <p class="mt-0.5 whitespace-pre-line text-sm text-ink-soft">{{ p.content }}</p>
        <div class="mt-1 flex gap-3 text-[11px] font-medium">
          @if (auth.isLoggedIn() && !rev.isHidden) { <button class="text-ink-faint hover:text-ink" (click)="openReply(rev.id, p.id, p.parentId ?? p.id, p.userName)">Reply</button> }
          @if (p.userId === me() || auth.isAdmin()) { <button class="text-harissa-600 hover:underline" (click)="deleteReply(p)">Delete</button> }
          @if (auth.isAdmin()) { <button class="text-ink-faint underline hover:text-ink" (click)="toggleReplyHidden(p)">{{ p.isHidden ? 'Unhide' : 'Hide' }}</button> }
        </div>
      </div>
    </ng-template>

    <ng-template #replyForm let-rev>
      <form class="flex flex-col gap-2 sm:flex-row" (ngSubmit)="sendReply(rev)">
        <input class="input" name="reply" [placeholder]="replyTarget()?.to ? 'Answer ' + replyTarget()?.to + '…' : 'Add to the discussion…'"
               maxlength="1000" [(ngModel)]="replyText" />
        <div class="flex gap-2">
          <button class="btn-primary !px-4" type="submit" [disabled]="!replyText.trim()">Send</button>
          <button class="btn-ghost !px-4" type="button" (click)="replyTarget.set(null)">Cancel</button>
        </div>
      </form>
    </ng-template>
  `,
})
export class ReviewSectionComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);

  readonly recipeId = input.required<number>();
  readonly recipeAuthorId = input.required<string>();
  // Tells the page to reload the recipe (its average rating changed).
  readonly changed = output<void>();

  readonly sorts: { value: ReviewSort; label: string }[] = [
    { value: 'Newest', label: 'Newest' },
    { value: 'Helpful', label: 'Most helpful' },
    { value: 'Highest', label: 'Highest rated' },
    { value: 'Lowest', label: 'Lowest rated' },
  ];
  readonly ratingWords = ['', 'Not for me', 'Could be better', 'Good', 'Very good', 'Loved it'];

  readonly reviews = signal<Review[]>([]);
  readonly summary = signal<RatingSummary | null>(null);
  readonly sort = signal<ReviewSort>('Newest');
  readonly editingId = signal<number | null>(null);
  // parentId = the reply being answered (sent to the API); threadId = where the form is shown.
  readonly replyTarget = signal<{ reviewId: number; parentId: number | null; threadId: number | null; to?: string } | null>(null);
  readonly error = signal('');
  readonly formError = signal('');

  readonly me = computed(() => this.auth.user()?.id ?? null);
  readonly canReview = computed(() => {
    const me = this.me();
    return !!me && this.recipeAuthorId() !== me && !this.reviews().some(r => r.userId === me);
  });
  readonly showForm = computed(() => this.canReview() || this.editingId() !== null);

  draft: SaveReview = { title: '', rating: 5, comment: '' };
  replyText = '';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.getReviews(this.recipeId(), this.sort()).subscribe({
      next: r => { this.reviews.set(r.reviews); this.summary.set(r.summary); },
      error: e => this.error.set(errorMessage(e)),
    });
  }

  changeSort(sort: ReviewSort): void {
    this.sort.set(sort);
    this.load();
  }

  stars(value: number): string {
    const full = Math.round(value);
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  }

  canVote(rev: Review): boolean {
    return this.auth.isLoggedIn() && rev.userId !== this.me() && !rev.isHidden;
  }

  threads(rev: Review): Thread[] {
    const top = rev.replies.filter(p => p.parentId === null);
    return top.map(reply => ({ reply, answers: rev.replies.filter(p => p.parentId === reply.id) }));
  }

  // ----- Write / edit -----

  saveReview(): void {
    this.formError.set('');
    const id = this.editingId();
    const call: Observable<unknown> = id ? this.api.updateReview(id, this.draft) : this.api.addReview(this.recipeId(), this.draft);
    call.subscribe({
      next: () => { this.cancelEdit(); this.refresh(); },
      error: e => this.formError.set(errorMessage(e)),
    });
  }

  startEdit(rev: Review): void {
    this.editingId.set(rev.id);
    this.draft = { title: rev.title, rating: rev.rating, comment: rev.comment };
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.draft = { title: '', rating: 5, comment: '' };
    this.formError.set('');
  }

  deleteReview(rev: Review): void {
    if (!confirm('Delete this review and its discussion?')) return;
    this.api.deleteReview(rev.id).subscribe({ next: () => this.refresh(), error: e => this.error.set(errorMessage(e)) });
  }

  // ----- Helpful -----

  toggleHelpful(rev: Review): void {
    this.api.toggleHelpful(rev.id).subscribe({
      next: h => this.reviews.update(list => list.map(r => r.id === rev.id ? { ...r, ...h } : r)),
      error: e => this.error.set(errorMessage(e)),
    });
  }

  // ----- Replies -----

  openReply(reviewId: number, parentId: number | null, threadId: number | null, to?: string): void {
    this.replyText = '';
    this.replyTarget.set({ reviewId, parentId, threadId, to });
    // The input only exists after Angular renders it, so focus it on the next tick.
    setTimeout(() => document.querySelector<HTMLInputElement>('app-review-section input[name=reply]')?.focus());
  }

  sendReply(rev: Review): void {
    const target = this.replyTarget();
    if (!target || !this.replyText.trim()) return;
    this.api.addReply(rev.id, { content: this.replyText, parentId: target.parentId }).subscribe({
      next: reply => {
        this.reviews.update(list => list.map(r => r.id === rev.id ? { ...r, replies: [...r.replies, reply] } : r));
        this.replyTarget.set(null);
        this.replyText = '';
      },
      error: e => this.error.set(errorMessage(e)),
    });
  }

  deleteReply(reply: Reply): void {
    if (!confirm('Delete this reply?')) return;
    this.api.deleteReply(reply.id).subscribe({ next: () => this.load(), error: e => this.error.set(errorMessage(e)) });
  }

  // ----- Moderation (admin) -----

  toggleReviewHidden(rev: Review): void {
    this.api.setReviewHidden(rev.id, !rev.isHidden).subscribe({ next: () => this.refresh() });
  }

  toggleReplyHidden(reply: Reply): void {
    this.api.setReplyHidden(reply.id, !reply.isHidden).subscribe({ next: () => this.load() });
  }

  private refresh(): void {
    this.load();
    this.changed.emit();
  }
}
