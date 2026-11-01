import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, numberAttribute, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiService, errorMessage, imageUrl } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { RecipeDetails } from '../core/models';
import { ReviewSectionComponent } from '../shared/review-section.component';

@Component({
  selector: 'app-recipe-detail',
  imports: [RouterLink, DecimalPipe, ReviewSectionComponent],
  template: `
    @if (error()) { <p class="error mb-4">{{ error() }}</p> }

    @if (recipe(); as r) {
      <a routerLink="/" class="mb-5 inline-block text-sm text-ink-soft hover:text-ink">← All recipes</a>

      <header class="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-end">
        <div class="relative aspect-[16/10] overflow-hidden rounded-[28px] bg-cobalt-50">
          @if (image(); as src) {
            <img [src]="src" [alt]="r.name" class="h-full w-full object-cover" />
          } @else {
            <div class="photo-fallback"><span class="photo-fallback-label !text-2xl">{{ r.name }}</span></div>
          }
          @if (r.isHidden) {
            <span class="absolute left-4 top-4 rounded-full bg-ink px-3 py-1 text-xs font-semibold text-white">Hidden by moderation</span>
          }
        </div>

        <div class="space-y-5">
          <p class="eyebrow">{{ r.categoryName }} · {{ r.difficulty }}</p>
          <h1 class="text-4xl font-extrabold leading-tight sm:text-5xl">{{ r.name }}</h1>
          <p class="text-ink-soft">{{ r.description }}</p>

          <dl class="grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-white text-center">
            <div class="p-3"><dt class="eyebrow">Prep</dt><dd class="font-mono text-lg">{{ r.prepMinutes }}′</dd></div>
            <div class="p-3"><dt class="eyebrow">Cook</dt><dd class="font-mono text-lg">{{ r.cookMinutes }}′</dd></div>
            <div class="p-3"><dt class="eyebrow">Serves</dt><dd class="font-mono text-lg">{{ r.portions }}</dd></div>
          </dl>

          <p class="text-sm text-ink-soft">
            By <span class="font-semibold text-ink">{{ r.authorName }}</span>
            @if (r.reviewCount > 0) { · ★ {{ r.averageRating | number: '1.1-1' }} from {{ r.reviewCount }} {{ r.reviewCount === 1 ? 'review' : 'reviews' }} }
          </p>

          <div class="flex flex-wrap gap-2">
            @if (auth.isLoggedIn()) {
              <button class="btn" [class]="isFavorite() ? 'btn-saffron' : 'btn-ghost'" (click)="toggleFavorite()">
                {{ isFavorite() ? '★ Saved' : '☆ Save recipe' }}
              </button>
            }
            @if (canEdit()) {
              <a class="btn-ghost" [routerLink]="['/recipes', r.id, 'edit']">Edit</a>
              <button class="btn-danger" (click)="remove()">Delete</button>
            }
            @if (auth.isAdmin()) {
              <button class="btn-ghost" (click)="toggleHidden()">{{ r.isHidden ? 'Unhide' : 'Hide' }}</button>
            }
          </div>
        </div>
      </header>

      <div class="mt-12 grid gap-10 lg:grid-cols-[1fr_1.4fr]">
        <section>
          <h2 class="mb-4 text-2xl font-bold">Ingredients</h2>
          <ul class="divide-y divide-line rounded-2xl border border-line bg-white">
            @for (i of ingredientList(); track $index) {
              <li>
                <label class="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm">
                  <input type="checkbox" class="peer h-4 w-4 accent-olive-600" />
                  <span class="peer-checked:text-ink-faint peer-checked:line-through">{{ i }}</span>
                </label>
              </li>
            }
          </ul>
          <a class="btn-ghost mt-4" routerLink="/suggest" [queryParams]="{ i: ingredientList().slice(0, 4).join(',') }">Find similar recipes</a>
        </section>

        <section>
          <app-review-section [recipeId]="r.id" [recipeAuthorId]="r.authorId" (changed)="reloadRecipe()" />
        </section>
      </div>
    } @else if (!error()) {
      <div class="grid gap-8 lg:grid-cols-[1.2fr_1fr]" aria-busy="true">
        <div class="aspect-[16/10] animate-pulse rounded-[28px] bg-line/60"></div>
        <div class="space-y-4">
          <div class="h-4 w-32 animate-pulse rounded bg-line/60"></div>
          <div class="h-12 w-3/4 animate-pulse rounded bg-line/60"></div>
          <div class="h-20 animate-pulse rounded-2xl bg-line/60"></div>
        </div>
      </div>
    }
  `,
})
export class RecipeDetailComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  // Filled from the ":id" route parameter (withComponentInputBinding).
  readonly id = input.required({ transform: numberAttribute });

  readonly recipe = signal<RecipeDetails | null>(null);
  readonly isFavorite = signal(false);
  readonly error = signal('');

  readonly image = computed(() => imageUrl(this.recipe()?.imagePath));
  readonly ingredientList = computed(() => (this.recipe()?.ingredients ?? '').split(',').map(i => i.trim()).filter(Boolean));
  readonly canEdit = computed(() => this.auth.isAdmin() || this.recipe()?.authorId === this.auth.user()?.id);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.reloadRecipe();
    if (this.auth.isLoggedIn()) {
      this.api.getFavorites().subscribe(f => this.isFavorite.set(f.some(x => x.id === this.id())));
    }
  }

  toggleFavorite(): void {
    const call = this.isFavorite() ? this.api.removeFavorite(this.id()) : this.api.addFavorite(this.id());
    call.subscribe({ next: () => this.isFavorite.update(v => !v), error: e => this.error.set(errorMessage(e)) });
  }

  // Also called by the review section: a new review changes the average rating.
  reloadRecipe(): void {
    this.api.getRecipe(this.id()).subscribe({ next: r => this.recipe.set(r), error: e => this.error.set(errorMessage(e)) });
  }

  remove(): void {
    if (!confirm('Delete this recipe? This also removes its reviews.')) return;
    this.api.deleteRecipe(this.id()).subscribe({ next: () => this.router.navigateByUrl('/'), error: e => this.error.set(errorMessage(e)) });
  }

  toggleHidden(): void {
    const r = this.recipe();
    if (!r) return;
    this.api.setRecipeHidden(r.id, !r.isHidden).subscribe({ next: () => this.load(), error: e => this.error.set(errorMessage(e)) });
  }
}
