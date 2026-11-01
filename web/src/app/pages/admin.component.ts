import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, errorMessage } from '../core/api.service';
import { Category, RecipeListItem } from '../core/models';

// Admin area: manage categories and see hidden recipes. Protected by adminGuard here and [Authorize(Roles = "Admin")] in the API.
@Component({
  selector: 'app-admin',
  imports: [FormsModule],
  template: `
    <h1 class="mb-6 text-3xl font-extrabold">Admin</h1>
    @if (error()) { <p class="error mb-4">{{ error() }}</p> }

    <section class="card mb-8 p-5">
      <h2 class="mb-4 font-semibold">Categories</h2>
      <form class="mb-4 grid gap-2 sm:grid-cols-[1fr_2fr_auto]" (ngSubmit)="save()">
        <input class="input" name="name" placeholder="Name" [(ngModel)]="name" required maxlength="60" />
        <input class="input" name="description" placeholder="Description" [(ngModel)]="description" maxlength="300" />
        <button class="btn-primary" type="submit">{{ editingId ? 'Update' : 'Add' }}</button>
      </form>
      <table class="w-full text-sm">
        <thead><tr class="border-b text-left text-ink-faint"><th class="py-2">Name</th><th>Description</th><th>Recipes</th><th></th></tr></thead>
        <tbody>
          @for (c of categories(); track c.id) {
            <tr class="border-b last:border-0">
              <td class="py-2 font-medium">{{ c.name }}</td>
              <td class="text-ink-soft">{{ c.description }}</td>
              <td>{{ c.recipeCount }}</td>
              <td class="space-x-2 text-right">
                <button class="text-cobalt-600" (click)="edit(c)">Edit</button>
                <button class="text-harissa-600" (click)="remove(c)">Delete</button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </section>

    <section class="card p-5">
      <h2 class="mb-4 font-semibold">Hidden recipes</h2>
      @for (r of hidden(); track r.id) {
        <div class="flex items-center justify-between border-b py-2 text-sm last:border-0">
          <span>{{ r.name }} <span class="text-ink-faint">by {{ r.authorName }}</span></span>
          <button class="btn-ghost" (click)="unhide(r)">Unhide</button>
        </div>
      } @empty {
        <p class="text-sm text-ink-faint">No hidden recipe.</p>
      }
    </section>
  `,
})
export class AdminComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly categories = signal<Category[]>([]);
  readonly hidden = signal<RecipeListItem[]>([]);
  readonly error = signal('');

  name = '';
  description = '';
  editingId: number | null = null;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
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
