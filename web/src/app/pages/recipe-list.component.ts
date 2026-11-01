import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService, errorMessage, imageUrl } from '../core/api.service';
import { Category, DIFFICULTIES, Difficulty, PagedResult, PublicStats, RecipeListItem } from '../core/models';
import { IngredientInputComponent } from '../shared/ingredient-input.component';
import { RecipeCardComponent } from '../shared/recipe-card.component';

@Component({
  selector: 'app-recipe-list',
  imports: [FormsModule, RouterLink, RecipeCardComponent, IngredientInputComponent],
  template: `
    <!-- Hero: the product's main action, not a banner. -->
    <section class="relative mb-14 overflow-hidden rounded-[28px] bg-cobalt-600 px-6 py-12 text-white sm:px-12 sm:py-16">
      <div class="ceramic-strip absolute inset-x-0 bottom-0 opacity-60" aria-hidden="true"></div>
      <p class="font-mono text-xs uppercase tracking-[0.18em] text-cobalt-100">AI ingredient matching</p>
      <h1 class="mt-3 max-w-2xl text-4xl font-extrabold leading-[1.05] sm:text-6xl">
        Cook with what's <span class="text-saffron-400">already</span> in your kitchen.
      </h1>
      <p class="mt-4 max-w-xl text-cobalt-100">List what you have. We rank our recipes by how much of each you can cook right now, and show what's missing.</p>

      <div class="mt-8 max-w-2xl space-y-3">
        <app-ingredient-input #pantry [(ingredients)]="pantryItems" placeholder="tomato, garlic, pasta…" [onDark]="true" />
        <div class="flex flex-wrap items-center gap-2">
          <button class="btn-saffron" [disabled]="pantryItems().length === 0" (click)="match()">Match recipes</button>
          <span class="text-xs text-cobalt-100">or try:</span>
          @for (s of samples; track s) {
            <button type="button" class="rounded-full border border-white/25 px-3 py-1 text-xs text-white hover:bg-white/10" (click)="pantry.addValue(s)">+ {{ s }}</button>
          }
        </div>
      </div>
    </section>

    <!-- Live numbers from GET /api/stats -->
    @if (stats(); as s) {
      <dl class="mb-14 grid grid-cols-2 divide-line rounded-2xl border border-line bg-white sm:grid-cols-4 sm:divide-x">
        @for (item of [
          { n: s.recipes, label: 'recipes' }, { n: s.categories, label: 'categories' },
          { n: s.reviews, label: 'reviews' }, { n: s.members, label: 'cooks' }
        ]; track item.label) {
          <div class="px-6 py-5">
            <dd class="font-mono text-3xl font-semibold">{{ item.n }}</dd>
            <dt class="eyebrow mt-1">{{ item.label }}</dt>
          </div>
        }
      </dl>
    }

    @if (topRated().length) {
      <section class="mb-14">
        <p class="eyebrow">Loved by the community</p>
        <h2 class="mb-5 text-3xl font-bold">Top rated</h2>
        <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          @for (r of topRated(); track r.id) { <app-recipe-card [recipe]="r" /> }
        </div>
      </section>
    }

    <section class="mb-14 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <div class="card p-6">
        <p class="eyebrow">No time?</p>
        <h2 class="mb-4 text-2xl font-bold">Ready in 20 minutes</h2>
        <ul class="divide-y divide-line">
          @for (r of quick(); track r.id) {
            <li>
              <a [routerLink]="['/recipes', r.id]" class="group flex items-center gap-4 py-3">
                @if (img(r.imagePath); as src) {
                  <img [src]="src" [alt]="r.name" class="h-14 w-14 rounded-xl object-cover" />
                } @else {
                  <span class="photo-fallback h-14 w-14 rounded-xl p-0" aria-hidden="true"></span>
                }
                <span class="flex-1">
                  <span class="block font-semibold group-hover:text-cobalt-600">{{ r.name }}</span>
                  <span class="text-sm text-ink-soft">{{ r.categoryName }} · {{ r.difficulty }}</span>
                </span>
                <span class="font-mono text-lg">{{ r.prepMinutes + r.cookMinutes }}<span class="text-xs text-ink-faint">′</span></span>
              </a>
            </li>
          } @empty {
            <li class="py-3 text-sm text-ink-soft">No quick recipe yet.</li>
          }
        </ul>
      </div>
      <a routerLink="/calories" class="group relative flex flex-col justify-between overflow-hidden rounded-2xl bg-saffron-400 p-6 text-ink">
        <div>
          <p class="font-mono text-xs uppercase tracking-[0.16em] text-ink/70">Calorie calculator</p>
          <h2 class="mt-2 text-3xl font-extrabold leading-tight">How much should you eat today?</h2>
          <p class="mt-2 text-sm text-ink/80">Your daily target and a protein / carbs / fat split in four questions.</p>
        </div>
        <span class="mt-6 inline-flex items-center gap-2 font-semibold">Calculate my calories <span class="transition group-hover:translate-x-1">→</span></span>
        <div class="ceramic-strip absolute inset-x-0 bottom-0 opacity-40" aria-hidden="true"></div>
      </a>
    </section>

    <section class="mb-14">
      <p class="eyebrow">Explore</p>
      <h2 class="mb-5 text-3xl font-bold">Cook by category</h2>
      <div class="grid grid-cols-2 gap-4 md:grid-cols-3">
        @for (c of categories(); track c.id) {
          <button type="button" (click)="openCategory(c.id)"
                  class="group relative aspect-[16/10] overflow-hidden rounded-2xl bg-cobalt-600 text-left">
            @if (img(c.coverImage); as src) {
              <img [src]="src" alt="" class="absolute inset-0 h-full w-full object-cover opacity-80 transition duration-500 group-hover:scale-105" />
            }
            <span class="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/20 to-transparent"></span>
            <span class="absolute bottom-4 left-4 text-white">
              <span class="block font-display text-2xl font-bold">{{ c.name }}</span>
              <span class="font-mono text-xs text-white/80">{{ c.recipeCount }} {{ c.recipeCount === 1 ? 'recipe' : 'recipes' }}</span>
            </span>
          </button>
        }
      </div>
    </section>

    <section id="browse" class="scroll-mt-24">
      <div class="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="eyebrow">The cookbook</p>
          <h2 class="text-3xl font-bold">Browse recipes</h2>
        </div>
        <form class="flex w-full gap-2 sm:w-auto" (ngSubmit)="search(1)">
          <input class="input sm:w-72" name="search" placeholder="Search a dish or an ingredient" [(ngModel)]="term" />
          <select class="input w-auto" name="difficulty" [(ngModel)]="difficulty" (ngModelChange)="search(1)" aria-label="Difficulty">
            <option [ngValue]="null">Any level</option>
            @for (d of difficulties; track d) { <option [ngValue]="d">{{ d }}</option> }
          </select>
        </form>
      </div>

      <div class="mb-6 flex flex-wrap gap-2" role="group" aria-label="Categories">
        <button class="pill" [class.pill-active]="categoryId === null" (click)="pickCategory(null)">All</button>
        @for (c of categories(); track c.id) {
          <button class="pill" [class.pill-active]="categoryId === c.id" (click)="pickCategory(c.id)">
            {{ c.name }} <span class="ml-1.5 font-mono text-[11px] opacity-60">{{ c.recipeCount }}</span>
          </button>
        }
      </div>

      @if (error()) { <p class="error mb-4">{{ error() }}</p> }

      @if (result(); as page) {
        @if (page.items.length === 0) {
          <div class="card py-16 text-center">
            <p class="font-display text-xl font-bold">No recipe matches “{{ term || 'these filters' }}”.</p>
            <p class="mt-1 text-sm text-ink-soft">Clear the filters or search an ingredient instead.</p>
          </div>
        } @else {
          <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            @for (r of page.items; track r.id; let i = $index) {
              <app-recipe-card [recipe]="r" class="animate-rise" [style.animation-delay.ms]="i * 50" />
            }
          </div>
          @if (totalPages(page) > 1) {
            <div class="mt-10 flex items-center justify-center gap-4 text-sm">
              <button class="btn-ghost" [disabled]="page.page <= 1" (click)="search(page.page - 1)">Previous</button>
              <span class="font-mono text-ink-soft">{{ page.page }} / {{ totalPages(page) }}</span>
              <button class="btn-ghost" [disabled]="page.page >= totalPages(page)" (click)="search(page.page + 1)">Next</button>
            </div>
          }
        }
      } @else if (!error()) {
        <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          @for (s of [1, 2, 3]; track s) { <div class="aspect-[4/5] animate-pulse rounded-2xl bg-line/60"></div> }
        </div>
      }
    </section>
  `,
})
export class RecipeListComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly difficulties = DIFFICULTIES;
  readonly samples = ['tomato', 'egg', 'garlic', 'pasta', 'lentils'];
  readonly categories = signal<Category[]>([]);
  readonly result = signal<PagedResult<RecipeListItem> | null>(null);
  readonly error = signal('');
  readonly pantryItems = signal<string[]>([]);
  readonly stats = signal<PublicStats | null>(null);
  readonly topRated = signal<RecipeListItem[]>([]);
  readonly quick = signal<RecipeListItem[]>([]);

  term = '';
  categoryId: number | null = null;
  difficulty: Difficulty | null = null;

  ngOnInit(): void {
    this.api.getCategories().subscribe(c => this.categories.set(c));
    this.api.getStats().subscribe(s => this.stats.set(s));
    // Two small queries on the same endpoint, only the sort/filter differs.
    this.api.getRecipes({ sort: 'TopRated', pageSize: 3 }).subscribe(p => this.topRated.set(p.items));
    this.api.getRecipes({ sort: 'Quickest', maxMinutes: 20, pageSize: 4 }).subscribe(p => this.quick.set(p.items));
    this.search(1);
  }

  openCategory(id: number): void {
    this.pickCategory(id);
    document.getElementById('browse')?.scrollIntoView({ behavior: 'smooth' });
  }

  img(path: string | null) {
    return imageUrl(path);
  }

  match(): void {
    // The ingredients travel in the URL, so the results page can be bookmarked or shared.
    this.router.navigate(['/suggest'], { queryParams: { i: this.pantryItems().join(',') } });
  }

  pickCategory(id: number | null): void {
    this.categoryId = id;
    this.search(1);
  }

  search(page: number): void {
    this.error.set('');
    this.api.getRecipes({ search: this.term, categoryId: this.categoryId, difficulty: this.difficulty, page, pageSize: 9 })
      .subscribe({ next: r => this.result.set(r), error: e => this.error.set(errorMessage(e)) });
  }

  totalPages(page: PagedResult<RecipeListItem>): number {
    return Math.max(1, Math.ceil(page.totalCount / page.pageSize));
  }
}
