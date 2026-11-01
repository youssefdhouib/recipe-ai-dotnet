import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, errorMessage, imageUrl } from '../../core/api.service';
import { AdminRecipe, PagedResult } from '../../core/models';
import { AdminFiltersComponent, AdminHeadingComponent, PagerComponent } from './admin-ui';

@Component({
  selector: 'app-admin-recipes',
  imports: [RouterLink, DatePipe, DecimalPipe, AdminHeadingComponent, AdminFiltersComponent, PagerComponent],
  template: `
    <app-admin-heading title="Recipes" subtitle="Every recipe, hidden ones included. Hidden recipes stay visible to their author.">
      <a routerLink="/recipes/new" class="btn-primary">+ New recipe</a>
    </app-admin-heading>

    @if (error()) { <p class="error mb-4">{{ error() }}</p> }

    <section class="card overflow-hidden">
      <app-admin-filters placeholder="Search name, author or category…" [search]="search()" [status]="status()" [statuses]="statuses"
                         (searchChange)="onSearch($event)" (statusChange)="onStatus($event)" />

      <div class="overflow-x-auto">
        <table class="w-full min-w-[760px] text-sm">
          <thead>
            <tr class="border-b border-line bg-paper/60 text-left">
              <th class="eyebrow px-4 py-2.5">Recipe</th>
              <th class="eyebrow px-4 py-2.5">Author</th>
              <th class="eyebrow px-4 py-2.5 text-right">Rating</th>
              <th class="eyebrow px-4 py-2.5 text-right">Saves</th>
              <th class="eyebrow px-4 py-2.5">Added</th>
              <th class="eyebrow px-4 py-2.5">Status</th>
              <th class="px-4 py-2.5"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            @for (r of result()?.items ?? []; track r.id) {
              <tr class="border-b border-line last:border-0 hover:bg-paper/50">
                <td class="px-4 py-3">
                  <div class="flex items-center gap-3">
                    @if (image(r); as src) {
                      <img [src]="src" alt="" class="h-10 w-14 shrink-0 rounded-lg object-cover" />
                    } @else {
                      <span class="h-10 w-14 shrink-0 rounded-lg bg-cobalt-600"></span>
                    }
                    <div>
                      <a [routerLink]="['/recipes', r.id]" class="font-semibold hover:text-cobalt-600">{{ r.name }}</a>
                      <p class="text-xs text-ink-faint">{{ r.categoryName }}</p>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3 text-ink-soft">{{ r.authorName }}</td>
                <td class="px-4 py-3 text-right font-mono">
                  @if (r.averageRating !== null) { ★ {{ r.averageRating | number: '1.1-1' }} <span class="text-ink-faint">({{ r.reviewCount }})</span> } @else { <span class="text-ink-faint">—</span> }
                </td>
                <td class="px-4 py-3 text-right font-mono">{{ r.favorites }}</td>
                <td class="px-4 py-3 font-mono text-xs text-ink-soft">{{ r.createdOn | date: 'd MMM y' }}</td>
                <td class="px-4 py-3">
                  <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold" [class]="r.isHidden ? 'bg-ink text-white' : 'bg-olive-100 text-olive-700'">{{ r.isHidden ? 'Hidden' : 'Visible' }}</span>
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold">
                  <a [routerLink]="['/recipes', r.id, 'edit']" class="mr-3 text-cobalt-600 hover:underline">Edit</a>
                  <button class="mr-3 text-ink-soft hover:text-ink" (click)="toggleHidden(r)">{{ r.isHidden ? 'Unhide' : 'Hide' }}</button>
                  <button class="text-harissa-600 hover:underline" (click)="remove(r)">Delete</button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="7" class="px-4 py-10 text-center text-ink-soft">{{ result() ? 'No recipe matches these filters.' : 'Loading…' }}</td></tr>
            }
          </tbody>
        </table>
      </div>

      @if (result(); as p) { <app-pager [page]="p.page" [pageSize]="p.pageSize" [total]="p.totalCount" (pageChange)="goTo($event)" /> }
    </section>
  `,
})
export class AdminRecipesComponent implements OnInit {
  private readonly api = inject(ApiService);

  // ?status=hidden from the dashboard's "Needs attention" links (withComponentInputBinding).
  readonly initialStatus = input('', { alias: 'status' });

  readonly statuses = [
    { value: '', label: 'All' },
    { value: 'visible', label: 'Visible' },
    { value: 'hidden', label: 'Hidden' },
  ];
  readonly search = signal('');
  readonly status = signal('');
  readonly page = signal(1);
  readonly result = signal<PagedResult<AdminRecipe> | null>(null);
  readonly error = signal('');
  private timer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.status.set(this.initialStatus() ?? '');
    this.load();
  }

  load(): void {
    this.api.getAdminRecipes({ search: this.search(), status: this.status(), page: this.page(), pageSize: 10 }).subscribe({
      next: r => this.result.set(r),
      error: e => this.error.set(errorMessage(e)),
    });
  }

  // Wait until typing pauses (300 ms) before asking the API.
  onSearch(value: string): void {
    this.search.set(value);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.page.set(1); this.load(); }, 300);
  }

  onStatus(value: string): void {
    this.status.set(value);
    this.page.set(1);
    this.load();
  }

  goTo(page: number): void {
    this.page.set(page);
    this.load();
  }

  image(r: AdminRecipe): string | null {
    return imageUrl(r.imagePath);
  }

  toggleHidden(r: AdminRecipe): void {
    this.api.setRecipeHidden(r.id, !r.isHidden).subscribe({ next: () => this.load(), error: e => this.error.set(errorMessage(e)) });
  }

  remove(r: AdminRecipe): void {
    if (!confirm(`Delete "${r.name}"? Its reviews are deleted too.`)) return;
    this.api.deleteRecipe(r.id).subscribe({ next: () => this.load(), error: e => this.error.set(errorMessage(e)) });
  }
}
