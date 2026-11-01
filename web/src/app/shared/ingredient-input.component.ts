import { Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';

// The "pantry" input: type ingredients, they become tiles. Two-way bound with [(ingredients)].
@Component({
  selector: 'app-ingredient-input',
  imports: [FormsModule],
  template: `
    <div class="rounded-2xl border border-line bg-white p-3 focus-within:border-cobalt-500 focus-within:ring-4 focus-within:ring-cobalt-100" [class.border-transparent]="onDark()">
      <div class="flex flex-wrap items-center gap-2">
        @for (i of ingredients(); track i) {
          <span class="tile-plain animate-rise">
            {{ i }}
            <button type="button" class="ml-0.5 text-cobalt-500 hover:text-harissa-600" (click)="remove(i)" [attr.aria-label]="'Remove ' + i">×</button>
          </span>
        }
        <input
          class="min-w-[12rem] flex-1 border-0 bg-transparent px-1 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-0"
          [placeholder]="ingredients().length ? 'Add another…' : placeholder()"
          [(ngModel)]="draft"
          (keydown.enter)="add($event)"
          (keydown.backspace)="removeLastIfEmpty()"
          (blur)="add()"
          maxlength="50"
          aria-label="Add an ingredient" />
      </div>
    </div>
  `,
})
export class IngredientInputComponent {
  readonly ingredients = model<string[]>([]);
  readonly placeholder = input('Type an ingredient, press Enter');
  readonly onDark = input(false);

  draft = '';

  add(event?: Event): void {
    event?.preventDefault();
    // "tomato, garlic" adds two tiles at once; duplicates are ignored.
    const fresh = this.draft.split(',').map(i => i.trim().toLowerCase()).filter(i => i.length > 0);
    if (fresh.length === 0) return;
    const current = this.ingredients();
    this.ingredients.set([...current, ...fresh.filter(f => !current.includes(f))].slice(0, 20));
    this.draft = '';
  }

  addValue(value: string): void {
    this.draft = value;
    this.add();
  }

  remove(item: string): void {
    this.ingredients.update(list => list.filter(i => i !== item));
  }

  removeLastIfEmpty(): void {
    if (this.draft === '' && this.ingredients().length) {
      this.ingredients.update(list => list.slice(0, -1));
    }
  }
}
