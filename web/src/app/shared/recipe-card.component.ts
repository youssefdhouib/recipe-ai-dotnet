import { DecimalPipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { imageUrl } from '../core/api.service';
import { RecipeListItem } from '../core/models';

// Reusable card used on the recipe list and favorites pages.
@Component({
  selector: 'app-recipe-card',
  imports: [RouterLink, DecimalPipe],
  host: { class: 'block' },
  template: `
    <a [routerLink]="['/recipes', recipe().id]"
       class="group block overflow-hidden rounded-2xl border border-line bg-white transition duration-300 hover:-translate-y-1 hover:shadow-lift">
      <div class="relative aspect-[4/3] overflow-hidden bg-cobalt-50">
        @if (image(); as src) {
          <img [src]="src" [alt]="recipe().name" loading="lazy" class="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        } @else {
          <div class="photo-fallback"><span class="photo-fallback-label">{{ recipe().name }}</span></div>
        }
        <span class="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-ink">{{ recipe().categoryName }}</span>
        @if (recipe().isHidden) {
          <span class="absolute right-3 top-3 rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-white">Hidden</span>
        }
      </div>
      <div class="space-y-2 p-5">
        <h3 class="text-lg font-bold leading-snug">{{ recipe().name }}</h3>
        <p class="line-clamp-2 text-sm text-ink-soft">{{ recipe().description }}</p>
        <div class="flex items-center gap-4 pt-1 font-mono text-xs text-ink-faint">
          <span>{{ recipe().prepMinutes + recipe().cookMinutes }} min</span>
          <span>{{ recipe().difficulty }}</span>
          <span class="ml-auto text-ink-soft">
            @if (recipe().reviewCount > 0) { ★ {{ recipe().averageRating | number: '1.1-1' }} · {{ recipe().reviewCount }} }
            @else { no reviews yet }
          </span>
        </div>
      </div>
    </a>
  `,
})
export class RecipeCardComponent {
  readonly recipe = input.required<RecipeListItem>();

  image() {
    return imageUrl(this.recipe().imagePath);
  }
}
