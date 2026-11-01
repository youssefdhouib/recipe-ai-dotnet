import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, errorMessage } from '../../core/api.service';
import { Category } from '../../core/models';
import { AdminHeadingComponent } from './admin-ui';

@Component({
  selector: 'app-admin-categories',
  imports: [FormsModule, AdminHeadingComponent],
  template: `
    <app-admin-heading title="Categories" subtitle="A category that still has recipes cannot be deleted." />

    @if (error()) { <p class="error mb-4">{{ error() }}</p> }

    <section class="card overflow-hidden">
      <form class="grid gap-2 border-b border-line p-4 sm:grid-cols-[1fr_2fr_auto_auto]" (ngSubmit)="save()">
        <input class="input" name="name" placeholder="Name" [(ngModel)]="name" required maxlength="60" aria-label="Name" />
        <input class="input" name="description" placeholder="Description" [(ngModel)]="description" maxlength="300" aria-label="Description" />
        <button class="btn-primary" type="submit" [disabled]="!name.trim()">{{ editingId ? 'Save changes' : 'Add category' }}</button>
        @if (editingId) { <button class="btn-ghost" type="button" (click)="reset()">Cancel</button> }
      </form>

      <div class="overflow-x-auto">
        <table class="w-full min-w-[560px] text-sm">
          <thead>
            <tr class="border-b border-line bg-paper/60 text-left">
              <th class="eyebrow px-4 py-2.5">Name</th>
              <th class="eyebrow px-4 py-2.5">Description</th>
              <th class="eyebrow px-4 py-2.5 text-right">Recipes</th>
              <th class="px-4 py-2.5"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            @for (c of categories(); track c.id) {
              <tr class="border-b border-line last:border-0 hover:bg-paper/50" [class.bg-cobalt-50]="editingId === c.id">
                <td class="px-4 py-3 font-semibold">{{ c.name }}</td>
                <td class="px-4 py-3 text-ink-soft">{{ c.description }}</td>
                <td class="px-4 py-3 text-right font-mono">{{ c.recipeCount }}</td>
                <td class="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold">
                  <button class="mr-3 text-cobalt-600 hover:underline" (click)="edit(c)">Edit</button>
                  <button class="text-harissa-600 hover:underline disabled:cursor-not-allowed disabled:opacity-40" [disabled]="c.recipeCount > 0"
                          [title]="c.recipeCount > 0 ? 'Move or delete its recipes first' : ''" (click)="remove(c)">Delete</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class AdminCategoriesComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly categories = signal<Category[]>([]);
  readonly error = signal('');

  name = '';
  description = '';
  editingId: number | null = null;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.getCategories().subscribe({ next: c => this.categories.set(c), error: e => this.error.set(errorMessage(e)) });
  }

  edit(c: Category): void {
    this.editingId = c.id;
    this.name = c.name;
    this.description = c.description;
  }

  reset(): void {
    this.editingId = null;
    this.name = '';
    this.description = '';
  }

  save(): void {
    this.error.set('');
    const body = { name: this.name, description: this.description };
    const call = this.editingId ? this.api.updateCategory(this.editingId, body) : this.api.createCategory(body);
    call.subscribe({ next: () => { this.reset(); this.load(); }, error: e => this.error.set(errorMessage(e)) });
  }

  remove(c: Category): void {
    if (!confirm(`Delete category "${c.name}"?`)) return;
    this.api.deleteCategory(c.id).subscribe({ next: () => this.load(), error: e => this.error.set(errorMessage(e)) });
  }
}
