import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, errorMessage } from '../core/api.service';
import { AdminStats, Category, RecipeListItem } from '../core/models';
import { BarListComponent } from '../shared/bar-list.component';
import { ColumnChartComponent } from '../shared/column-chart.component';

type Tab = 'overview' | 'categories' | 'moderation';

// Admin area. Protected by adminGuard here and [Authorize(Roles = "Admin")] in the API.
@Component({
  selector: 'app-admin',
  imports: [FormsModule, RouterLink, DecimalPipe, BarListComponent, ColumnChartComponent],
  template: `
    <p class="eyebrow">Admin</p>
    <h1 class="mb-6 text-4xl font-extrabold">Dashboard</h1>

    <div class="mb-8 flex gap-2" role="tablist">
      @for (t of tabs; track t.id) {
        <button role="tab" class="pill" [class.pill-active]="tab() === t.id" [attr.aria-selected]="tab() === t.id" (click)="tab.set(t.id)">{{ t.label }}</button>
      }
    </div>

    @if (error()) { <p class="error mb-4">{{ error() }}</p> }

    <!-- ===== Overview ===== -->
    @if (tab() === 'overview') {
      @if (stats(); as s) {
        <dl class="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          @for (k of kpis(); track k.label) {
            <div class="card p-5">
              <dt class="eyebrow">{{ k.label }}</dt>
              <dd class="mt-1 font-mono text-4xl font-semibold">{{ k.value }}</dd>
              @if (k.note) { <p class="mt-1 text-xs text-ink-soft">{{ k.note }}</p> }
            </div>
          }
        </dl>

        <div class="mb-8 grid gap-6 lg:grid-cols-2">
          <section class="card p-6">
            <h2 class="text-lg font-bold">Recipes per category</h2>
            <p class="mb-5 text-sm text-ink-soft">All recipes, hidden ones included.</p>
            <app-bar-list [items]="categoryBars()" unit="recipes" />
          </section>

          <section class="card p-6">
            <h2 class="text-lg font-bold">Reviews, last 14 days</h2>
            <p class="mb-5 text-sm text-ink-soft">{{ reviewsInPeriod() }} reviews in the period.</p>
            <app-column-chart [data]="s.reviewsPerDay" />
            <details class="mt-4 text-sm">
              <summary class="cursor-pointer text-ink-soft">Show as table</summary>
              <table class="mt-2 w-full font-mono text-xs">
                <tbody>
                  @for (d of s.reviewsPerDay; track d.date) {
                    <tr class="border-b border-line"><td class="py-1">{{ d.date }}</td><td class="text-right">{{ d.count }}</td></tr>
                  }
                </tbody>
              </table>
            </details>
          </section>
        </div>

        <div class="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <section class="card p-6">
            <h2 class="text-lg font-bold">AI usage, last 7 days</h2>
            <p class="mb-5 text-sm text-ink-soft">From the AI call log written by the suggestion pipeline.</p>
            @if (s.aiUsage.calls === 0) {
              <p class="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-soft">No AI calls yet. Try “Match my fridge”.</p>
            } @else {
              <dl class="mb-6 grid grid-cols-3 gap-3">
                <div class="rounded-xl border border-line p-3">
                  <dt class="eyebrow">Calls</dt>
                  <dd class="font-mono text-2xl">{{ s.aiUsage.calls }}</dd>
                </div>
                <div class="rounded-xl border border-line p-3">
                  <dt class="eyebrow">Success</dt>
                  <dd class="flex items-center gap-1.5 font-mono text-2xl">
                    <span aria-hidden="true" [class]="s.aiUsage.successRate >= 95 ? 'text-olive-600' : 'text-harissa-600'">{{ s.aiUsage.successRate >= 95 ? '✓' : '!' }}</span>
                    {{ s.aiUsage.successRate | number: '1.0-1' }}%
                  </dd>
                  <p class="text-xs text-ink-soft">{{ s.aiUsage.failed }} failed → keyword fallback</p>
                </div>
                <div class="rounded-xl border border-line p-3">
                  <dt class="eyebrow">Avg latency</dt>
                  <dd class="font-mono text-2xl">{{ s.aiUsage.averageMs }}<span class="text-sm text-ink-faint"> ms</span></dd>
                </div>
              </dl>
              <h3 class="mb-3 text-sm font-semibold">Average latency per step (ms)</h3>
              <app-bar-list [items]="latencyBars()" unit="ms" />
            }
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
      } @else if (!error()) {
        <div class="grid gap-4 lg:grid-cols-4">@for (i of [1, 2, 3, 4]; track i) { <div class="h-28 animate-pulse rounded-2xl bg-line/60"></div> }</div>
      }
    }

    <!-- ===== Categories ===== -->
    @if (tab() === 'categories') {
      <section class="card p-6">
        <form class="mb-5 grid gap-2 sm:grid-cols-[1fr_2fr_auto]" (ngSubmit)="save()">
          <input class="input" name="name" placeholder="Name" [(ngModel)]="name" required maxlength="60" />
          <input class="input" name="description" placeholder="Description" [(ngModel)]="description" maxlength="300" />
          <button class="btn-primary" type="submit">{{ editingId ? 'Save changes' : 'Add category' }}</button>
        </form>
        <table class="w-full text-sm">
          <thead><tr class="border-b border-line text-left"><th class="eyebrow pb-2">Name</th><th class="eyebrow pb-2">Description</th><th class="eyebrow pb-2 text-right">Recipes</th><th></th></tr></thead>
          <tbody>
            @for (c of categories(); track c.id) {
              <tr class="border-b border-line last:border-0">
                <td class="py-2.5 font-medium">{{ c.name }}</td>
                <td class="text-ink-soft">{{ c.description }}</td>
                <td class="text-right font-mono">{{ c.recipeCount }}</td>
                <td class="space-x-3 text-right">
                  <button class="text-cobalt-600" (click)="edit(c)">Edit</button>
                  <button class="text-harissa-600" (click)="remove(c)">Delete</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </section>
    }

    <!-- ===== Moderation ===== -->
    @if (tab() === 'moderation') {
      <section class="card p-6">
        <h2 class="mb-1 text-lg font-bold">Hidden recipes</h2>
        <p class="mb-4 text-sm text-ink-soft">Hidden recipes disappear from public lists; they stay visible here and to their author.</p>
        @for (r of hidden(); track r.id) {
          <div class="flex items-center justify-between border-b border-line py-3 text-sm last:border-0">
            <a [routerLink]="['/recipes', r.id]" class="hover:text-cobalt-600">{{ r.name }} <span class="text-ink-faint">by {{ r.authorName }}</span></a>
            <button class="btn-ghost !py-1.5" (click)="unhide(r)">Unhide</button>
          </div>
        } @empty {
          <p class="text-sm text-ink-soft">No hidden recipe.</p>
        }
      </section>
    }
  `,
})
export class AdminComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'categories', label: 'Categories' },
    { id: 'moderation', label: 'Moderation' },
  ];
  readonly tab = signal<Tab>('overview');
  readonly stats = signal<AdminStats | null>(null);
  readonly categories = signal<Category[]>([]);
  readonly hidden = signal<RecipeListItem[]>([]);
  readonly error = signal('');

  readonly kpis = computed(() => {
    const s = this.stats();
    if (!s) return [];
    return [
      { label: 'Members', value: s.users, note: '' },
      { label: 'Recipes', value: s.recipes, note: s.hiddenRecipes ? `${s.hiddenRecipes} hidden` : '' },
      { label: 'Reviews', value: s.reviews, note: '' },
      { label: 'Saved', value: s.favorites, note: 'favorites' },
    ];
  });
  readonly categoryBars = computed(() => (this.stats()?.recipesPerCategory ?? []).map(c => ({ label: c.label, value: c.count })));
  readonly latencyBars = computed(() => (this.stats()?.aiUsage.steps ?? []).map(s => ({ label: `${s.step} · ${s.calls} calls`, value: s.averageMs })));
  readonly reviewsInPeriod = computed(() => (this.stats()?.reviewsPerDay ?? []).reduce((sum, d) => sum + d.count, 0));

  name = '';
  description = '';
  editingId: number | null = null;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.getAdminStats().subscribe({ next: s => this.stats.set(s), error: e => this.error.set(errorMessage(e)) });
    this.api.getCategories().subscribe(c => this.categories.set(c));
    this.api.getRecipes({ pageSize: 50 }).subscribe(p => this.hidden.set(p.items.filter(r => r.isHidden)));
  }

  edit(c: Category): void {
    this.editingId = c.id;
    this.name = c.name;
    this.description = c.description;
  }

  save(): void {
    this.error.set('');
    const body = { name: this.name, description: this.description };
    const call = this.editingId ? this.api.updateCategory(this.editingId, body) : this.api.createCategory(body);
    call.subscribe({
      next: () => { this.name = ''; this.description = ''; this.editingId = null; this.load(); },
      error: e => this.error.set(errorMessage(e)),
    });
  }

  remove(c: Category): void {
    if (!confirm(`Delete category "${c.name}"?`)) return;
    this.api.deleteCategory(c.id).subscribe({ next: () => this.load(), error: e => this.error.set(errorMessage(e)) });
  }

  unhide(r: RecipeListItem): void {
    this.api.setRecipeHidden(r.id, false).subscribe({ next: () => this.load(), error: e => this.error.set(errorMessage(e)) });
  }
}
