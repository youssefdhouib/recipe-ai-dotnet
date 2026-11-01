import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService, errorMessage } from '../core/api.service';
import { Category, DIFFICULTIES, Difficulty, PagedResult, RecipeListItem } from '../core/models';
import { IngredientInputComponent } from '../shared/ingredient-input.component';
import { RecipeCardComponent } from '../shared/recipe-card.component';

@Component({
  selector: 'app-recipe-list',
  imports: [FormsModule, RecipeCardComponent, IngredientInputComponent],
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

    <section>
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

  term = '';
  categoryId: number | null = null;
  difficulty: Difficulty | null = null;

  ngOnInit(): void {
    this.api.getCategories().subscribe(c => this.categories.set(c));
    this.search(1);
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
