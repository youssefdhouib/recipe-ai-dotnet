import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService, errorMessage, imageUrl } from '../core/api.service';
import { Category, DIFFICULTIES, Difficulty, SuggestionResponse } from '../core/models';
import { IngredientInputComponent } from '../shared/ingredient-input.component';

// The AI page: pantry -> POST /api/suggestions -> ranked recipes shown as "pantry shelves" + AI ideas.
@Component({
  selector: 'app-suggest',
  imports: [FormsModule, RouterLink, IngredientInputComponent],
  template: `
    <div class="grid gap-10 lg:grid-cols-[360px_1fr]">
      <!-- Left: the pantry -->
      <aside class="lg:sticky lg:top-24 lg:self-start">
        <p class="eyebrow">Your pantry</p>
        <h1 class="mb-5 text-3xl font-extrabold">What do you have?</h1>
        <div class="card space-y-4 p-5">
          <app-ingredient-input [(ingredients)]="ingredients" />
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label" for="cat">Category</label>
              <select id="cat" class="input" [(ngModel)]="categoryId">
                <option [ngValue]="null">Any</option>
                @for (c of categories(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
              </select>
            </div>
            <div>
              <label class="label" for="lvl">Level</label>
              <select id="lvl" class="input" [(ngModel)]="difficulty">
                <option [ngValue]="null">Any</option>
                @for (d of difficulties; track d) { <option [ngValue]="d">{{ d }}</option> }
              </select>
            </div>
          </div>
          <button class="btn-primary w-full" [disabled]="ingredients().length === 0 || loading()" (click)="suggest()">
            {{ loading() ? 'Matching…' : 'Match recipes' }}
          </button>
          <p class="text-xs text-ink-faint">Salt, pepper, oil and water are assumed to be in every kitchen.</p>
        </div>
      </aside>

      <!-- Right: the results -->
      <section aria-live="polite">
        @if (error()) { <p class="error mb-4">{{ error() }}</p> }

        @if (loading()) {
          <div class="space-y-4">
            @for (s of [1, 2, 3]; track s) { <div class="h-40 animate-pulse rounded-2xl bg-line/60"></div> }
          </div>
        } @else {
        @if (result(); as r) {
          <div class="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span class="eyebrow">Read as</span>
            @for (n of r.normalizedIngredients; track n) { <span class="tile-plain">{{ n }}</span> }
            <span class="ml-auto font-mono text-[11px] text-ink-faint">engine · {{ r.provider }}</span>
          </div>

          @if (!r.aiAvailable) {
            <p class="mb-4 rounded-xl border border-saffron-400/40 bg-saffron-100 px-4 py-2.5 text-sm text-ink">
              The AI isn't responding, so these results use keyword matching. Try again in a minute for a smarter ranking.
            </p>
          }

          <ol class="space-y-4">
            @for (s of r.recipes; track s.id; let i = $index) {
              <li class="animate-rise" [style.animation-delay.ms]="i * 70">
                <a [routerLink]="['/recipes', s.id]" class="card group grid gap-5 p-5 transition hover:shadow-lift sm:grid-cols-[auto_1fr_auto]">
                  <span class="font-mono text-sm text-ink-faint">#{{ i + 1 }}</span>
                  <div class="min-w-0 space-y-3">
                    <div>
                      <h3 class="text-xl font-bold group-hover:text-cobalt-600">{{ s.name }}</h3>
                      <p class="text-sm text-ink-soft">{{ s.reason }}</p>
                    </div>
                    <!-- Pantry shelf: what you have vs what is missing -->
                    <div class="flex flex-wrap gap-1.5">
                      @for (m of s.matched; track m) { <span class="tile-have">✓ {{ m }}</span> }
                      @for (m of s.missing; track m) { <span class="tile-missing">{{ m }}</span> }
                    </div>
                    <p class="font-mono text-[11px] text-ink-faint">{{ s.categoryName }} · {{ s.difficulty }}</p>
                  </div>
                  <div class="flex items-center gap-4 sm:flex-col sm:items-end">
                    <span class="font-mono text-4xl font-semibold leading-none" [class]="scoreColor(s.score)">{{ s.score }}<span class="text-lg">%</span></span>
                    <div class="h-1.5 w-24 overflow-hidden rounded-full bg-line" role="img" [attr.aria-label]="s.score + ' percent match'">
                      <div class="h-full rounded-full bg-current" [class]="scoreColor(s.score)" [style.width.%]="s.score"></div>
                    </div>
                    @if (img(s.imagePath); as src) {
                      <img [src]="src" [alt]="s.name" class="hidden h-16 w-24 rounded-lg object-cover sm:block" />
                    }
                  </div>
                </a>
              </li>
            }
          </ol>

          @if (r.ideas.length > 0) {
            <div class="mt-10">
              <p class="eyebrow">Generated by the AI</p>
              <h2 class="mb-4 text-2xl font-bold">Nothing fits well? Try one of these</h2>
              <div class="grid gap-4 md:grid-cols-3">
                @for (idea of r.ideas; track idea.name) {
                  <div class="card space-y-3 border-dashed p-5">
                    <h3 class="text-lg font-bold">{{ idea.name }}</h3>
                    <p class="text-sm text-ink-soft">{{ idea.description }}</p>
                    <div class="flex flex-wrap gap-1">
                      @for (g of idea.ingredients; track g) { <span class="tile-plain">{{ g }}</span> }
                    </div>
                    <p class="text-sm">{{ idea.steps }}</p>
                  </div>
                }
              </div>
            </div>
          }

          @if (r.recipes.length === 0 && r.ideas.length === 0) {
            <div class="card py-16 text-center">
              <p class="font-display text-xl font-bold">No recipe uses these ingredients yet.</p>
              <p class="mt-1 text-sm text-ink-soft">Add a staple like egg, onion or rice, or remove the filters.</p>
            </div>
          }
        } @else {
          <div class="grid h-full min-h-[320px] place-items-center rounded-2xl border border-dashed border-line p-10 text-center">
            <div>
              <p class="font-display text-2xl font-bold">Your matches will appear here</p>
              <p class="mt-2 text-sm text-ink-soft">Each recipe shows the ingredients you have <span class="tile-have">✓ like this</span> and the ones you'd need to buy <span class="tile-missing">like this</span>.</p>
            </div>
          </div>
        }
        }
      </section>
    </div>
  `,
})
export class SuggestComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  // ?i=tomato,garlic from the home page hero (query params bound as inputs).
  readonly i = input<string>();

  readonly difficulties = DIFFICULTIES;
  readonly categories = signal<Category[]>([]);
  readonly ingredients = signal<string[]>([]);
  readonly result = signal<SuggestionResponse | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  categoryId: number | null = null;
  difficulty: Difficulty | null = null;

  ngOnInit(): void {
    this.api.getCategories().subscribe(c => this.categories.set(c));
    const fromUrl = (this.i() ?? '').split(',').map(x => x.trim()).filter(Boolean);
    if (fromUrl.length) {
      this.ingredients.set(fromUrl);
      this.suggest();
    }
  }

  suggest(): void {
    this.loading.set(true);
    this.error.set('');
    this.router.navigate([], { queryParams: { i: this.ingredients().join(',') }, replaceUrl: true });
    this.api.suggest({ ingredients: this.ingredients(), categoryId: this.categoryId, difficulty: this.difficulty }).subscribe({
      next: r => { this.result.set(r); this.loading.set(false); },
      error: e => { this.error.set(errorMessage(e)); this.loading.set(false); },
    });
  }

  img(path: string | null) {
    return imageUrl(path);
  }

  scoreColor(score: number): string {
    return score >= 70 ? 'text-olive-600' : score >= 40 ? 'text-saffron-600' : 'text-ink-faint';
  }
}
