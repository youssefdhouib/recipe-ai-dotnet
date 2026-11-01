import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, errorMessage } from '../../core/api.service';
import { AdminStats, Trend } from '../../core/models';
import { BarListComponent } from '../../shared/bar-list.component';
import { ColumnChartComponent } from '../../shared/column-chart.component';
import { AdminHeadingComponent } from './admin-ui';

@Component({
  selector: 'app-admin-dashboard',
  imports: [RouterLink, DatePipe, DecimalPipe, BarListComponent, ColumnChartComponent, AdminHeadingComponent],
  template: `
    <app-admin-heading title="Dashboard" subtitle="How the community is doing, and what needs your attention." />

    @if (error()) { <p class="error mb-4">{{ error() }}</p> }

    @if (stats(); as s) {
      <!-- KPIs with their weekly trend -->
      <dl class="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        @for (t of s.trends; track t.label) {
          <div class="card p-5">
            <dt class="eyebrow">{{ t.label }}</dt>
            <dd class="mt-1 font-mono text-4xl font-semibold">{{ t.total }}</dd>
            <p class="mt-2 flex items-center gap-1.5 text-xs">
              <span class="rounded-full px-2 py-0.5 font-mono font-semibold" [class]="trendClass(t)">+{{ t.last7Days }}</span>
              <span class="text-ink-soft">this week · {{ trendText(t) }}</span>
            </p>
          </div>
        }
      </dl>

      <div class="mb-6 grid gap-6 xl:grid-cols-[1fr_20rem]">
        <!-- Activity charts -->
        <div class="grid gap-6 md:grid-cols-2">
          <section class="card p-6">
            <h2 class="text-lg font-bold">Reviews</h2>
            <p class="mb-5 text-sm text-ink-soft">Last 14 days · {{ sum(s.reviewsPerDay) }} in total</p>
            <app-column-chart [data]="s.reviewsPerDay" unit="reviews" />
          </section>
          <section class="card p-6">
            <h2 class="text-lg font-bold">New members</h2>
            <p class="mb-5 text-sm text-ink-soft">Last 14 days · {{ sum(s.signupsPerDay) }} in total</p>
            <app-column-chart [data]="s.signupsPerDay" unit="sign-ups" />
          </section>
        </div>

        <!-- Needs attention -->
        <section class="card p-6">
          <h2 class="mb-4 text-lg font-bold">Needs attention</h2>
          <ul class="divide-y divide-line text-sm">
            @for (a of attention(); track a.label) {
              <li>
                <a [routerLink]="a.link" [queryParams]="a.query" class="flex items-center justify-between py-2.5 hover:text-cobalt-600">
                  <span>{{ a.label }}</span>
                  <span class="min-w-[2rem] rounded-full px-2 py-0.5 text-center font-mono text-xs font-semibold"
                        [class]="a.count > 0 ? 'bg-saffron-100 text-saffron-600' : 'bg-line/60 text-ink-faint'">{{ a.count }}</span>
                </a>
              </li>
            }
          </ul>
        </section>
      </div>

      <div class="mb-6 grid gap-6 lg:grid-cols-2">
        <section class="card p-6">
          <h2 class="text-lg font-bold">Recipes per category</h2>
          <p class="mb-5 text-sm text-ink-soft">All recipes, hidden ones included.</p>
          <app-bar-list [items]="categoryBars()" unit="recipes" />
        </section>

        <section class="card p-6">
          <h2 class="mb-4 text-lg font-bold">Top rated recipes</h2>
          @if (s.topRecipes.length) {
            <table class="w-full text-sm">
              <thead><tr class="border-b border-line text-left"><th class="eyebrow pb-2">Recipe</th><th class="eyebrow pb-2 text-right">Rating</th><th class="eyebrow pb-2 text-right">Reviews</th></tr></thead>
              <tbody>
                @for (t of s.topRecipes; track t.id) {
                  <tr class="border-b border-line last:border-0">
                    <td class="py-2.5"><a [routerLink]="['/recipes', t.id]" class="font-medium hover:text-cobalt-600">{{ t.name }}</a></td>
                    <td class="text-right font-mono">★ {{ t.averageRating | number: '1.1-1' }}</td>
                    <td class="text-right font-mono text-ink-soft">{{ t.reviewCount }}</td>
                  </tr>
                }
              </tbody>
            </table>
          } @else {
            <p class="text-sm text-ink-soft">No reviews yet.</p>
          }
        </section>
      </div>

      <div class="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section class="card p-6">
          <h2 class="mb-4 text-lg font-bold">Recent activity</h2>
          <ol class="space-y-3">
            @for (a of s.recentActivity; track $index) {
              <li class="flex items-start gap-3 text-sm">
                <span class="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs" [class]="kindClass[a.kind]" aria-hidden="true">{{ kindIcon[a.kind] }}</span>
                <a [routerLink]="a.link" class="flex-1 hover:text-cobalt-600">{{ a.text }}</a>
                <time class="shrink-0 font-mono text-[11px] text-ink-faint">{{ a.createdOn + 'Z' | date: 'd MMM, HH:mm' }}</time>
              </li>
            } @empty {
              <li class="text-sm text-ink-soft">Nothing yet.</li>
            }
          </ol>
        </section>

        <section class="card p-6">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-lg font-bold">AI, last 7 days</h2>
            <a routerLink="/admin/ai" class="text-sm font-semibold text-cobalt-600 hover:underline">Open monitor →</a>
          </div>
          @if (s.aiUsage.calls === 0) {
            <p class="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-soft">No AI calls yet. Try “Match my fridge”.</p>
          } @else {
            <dl class="divide-y divide-line text-sm">
              <div class="flex justify-between py-2"><dt class="text-ink-soft">Calls</dt><dd class="font-mono font-semibold">{{ s.aiUsage.calls }}</dd></div>
              <div class="flex justify-between py-2"><dt class="text-ink-soft">Success rate</dt><dd class="font-mono font-semibold">{{ s.aiUsage.successRate | number: '1.0-1' }}%</dd></div>
              <div class="flex justify-between py-2"><dt class="text-ink-soft">Failed → keyword fallback</dt><dd class="font-mono font-semibold">{{ s.aiUsage.failed }}</dd></div>
              <div class="flex justify-between py-2"><dt class="text-ink-soft">Average latency</dt><dd class="font-mono font-semibold">{{ s.aiUsage.averageMs }} ms</dd></div>
            </dl>
          }
        </section>
      </div>
    } @else if (!error()) {
      <div class="grid gap-4 xl:grid-cols-4">@for (i of [1, 2, 3, 4]; track i) { <div class="h-28 animate-pulse rounded-2xl bg-line/60"></div> }</div>
    }
  `,
})
export class AdminDashboardComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly stats = signal<AdminStats | null>(null);
  readonly error = signal('');

  readonly kindIcon: Record<string, string> = { user: '☺', recipe: '✎', review: '★' };
  readonly kindClass: Record<string, string> = {
    user: 'bg-cobalt-50 text-cobalt-700',
    recipe: 'bg-olive-100 text-olive-700',
    review: 'bg-saffron-100 text-saffron-600',
  };

  readonly categoryBars = computed(() => (this.stats()?.recipesPerCategory ?? []).map(c => ({ label: c.label, value: c.count })));

  // Each line links to the admin table already filtered on that problem.
  readonly attention = computed(() => {
    const m = this.stats()?.moderation;
    if (!m) return [];
    return [
      { label: 'Low ratings this week', count: m.lowRatingsThisWeek, link: '/admin/reviews', query: { status: 'low' } },
      { label: 'Hidden reviews', count: m.hiddenReviews, link: '/admin/reviews', query: { status: 'hidden' } },
      { label: 'Hidden replies', count: m.hiddenReplies, link: '/admin/reviews', query: { status: 'hidden' } },
      { label: 'Hidden recipes', count: m.hiddenRecipes, link: '/admin/recipes', query: { status: 'hidden' } },
      { label: 'Banned users', count: m.bannedUsers, link: '/admin/users', query: { status: 'banned' } },
    ];
  });

  ngOnInit(): void {
    this.api.getAdminStats().subscribe({ next: s => this.stats.set(s), error: e => this.error.set(errorMessage(e)) });
  }

  sum(days: { count: number }[]): number {
    return days.reduce((total, d) => total + d.count, 0);
  }

  trendText(t: Trend): string {
    if (t.previous7Days === t.last7Days) return 'same as last week';
    return `${t.previous7Days} the week before`;
  }

  trendClass(t: Trend): string {
    if (t.last7Days > t.previous7Days) return 'bg-olive-100 text-olive-700';
    if (t.last7Days < t.previous7Days) return 'bg-harissa-100 text-harissa-600';
    return 'bg-line/60 text-ink-soft';
  }
}
