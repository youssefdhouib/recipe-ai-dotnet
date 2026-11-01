import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { RecipeListItem } from '../core/models';
import { RecipeCardComponent } from '../shared/recipe-card.component';

@Component({
  selector: 'app-favorites',
  imports: [RouterLink, RecipeCardComponent],
  template: `
    <h1 class="mb-6 text-3xl font-extrabold">Saved recipes</h1>
    @if (favorites(); as list) {
      <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        @for (r of list; track r.id) { <app-recipe-card [recipe]="r" /> }
      </div>
      @if (list.length === 0) {
        <p class="py-12 text-center text-ink-faint">Nothing saved yet. Tap “Save recipe” on any recipe to keep it here. <a routerLink="/" class="text-cobalt-600">Browse recipes →</a></p>
      }
    }
  `,
})
export class FavoritesComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly favorites = signal<RecipeListItem[] | null>(null);

  ngOnInit(): void {
    this.api.getFavorites().subscribe(f => this.favorites.set(f));
  }
}
