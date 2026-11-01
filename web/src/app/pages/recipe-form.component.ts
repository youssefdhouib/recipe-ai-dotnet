import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { switchMap, of } from 'rxjs';
import { ApiService, errorMessage, imageUrl } from '../core/api.service';
import { Category, DIFFICULTIES, SaveRecipe } from '../core/models';

// One form for create (/recipes/new) and edit (/recipes/:id/edit). Reactive forms mirror the API validators.
@Component({
  selector: 'app-recipe-form',
  imports: [ReactiveFormsModule],
  template: `
    <h1 class="mb-6 text-3xl font-extrabold">{{ id() ? 'Edit recipe' : 'New recipe' }}</h1>

    <form class="card grid gap-4 p-6 sm:grid-cols-2" [formGroup]="form" (ngSubmit)="save()">
      <div class="sm:col-span-2">
        <label class="label" for="name">Name</label>
        <input id="name" class="input" formControlName="name" maxlength="120" />
      </div>
      <div class="sm:col-span-2">
        <label class="label" for="description">Description</label>
        <textarea id="description" class="input" rows="3" formControlName="description"></textarea>
      </div>
      <div class="sm:col-span-2">
        <label class="label" for="ingredients">Ingredients (comma separated)</label>
        <textarea id="ingredients" class="input" rows="3" formControlName="ingredients" placeholder="200g spaghetti, 2 tomatoes, garlic, basil"></textarea>
      </div>
      <div>
        <label class="label" for="category">Category</label>
        <select id="category" class="input" formControlName="categoryId">
          @for (c of categories(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
        </select>
      </div>
      <div>
        <label class="label" for="difficulty">Difficulty</label>
        <select id="difficulty" class="input" formControlName="difficulty">
          @for (d of difficulties; track d) { <option [ngValue]="d">{{ d }}</option> }
        </select>
      </div>
      <div class="grid grid-cols-3 gap-3 sm:col-span-2">
        <div><label class="label" for="prep">Prep (min)</label><input id="prep" class="input" type="number" formControlName="prepMinutes" /></div>
        <div><label class="label" for="cook">Cook (min)</label><input id="cook" class="input" type="number" formControlName="cookMinutes" /></div>
        <div><label class="label" for="portions">Portions</label><input id="portions" class="input" type="number" formControlName="portions" /></div>
      </div>
      <div class="sm:col-span-2">
        <label class="label" for="image">Photo · jpg, png or webp, up to 2 MB</label>
        @if (currentImage()) { <img [src]="currentImage()" alt="Current photo" class="mb-2 h-32 rounded-lg object-cover" /> }
        <input id="image" type="file" accept=".jpg,.jpeg,.png,.webp" (change)="pickFile($event)" class="text-sm" />
      </div>

      @if (error()) { <p class="error sm:col-span-2">{{ error() }}</p> }
      <div class="sm:col-span-2">
        <button class="btn-primary" type="submit" [disabled]="form.invalid || saving()">{{ saving() ? 'Saving...' : 'Save recipe' }}</button>
      </div>
    </form>
  `,
})
export class RecipeFormComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  // Present only on /recipes/:id/edit.
  readonly id = input<string>();

  readonly difficulties = DIFFICULTIES;
  readonly categories = signal<Category[]>([]);
  readonly currentImage = signal<string | null>(null);
  readonly error = signal('');
  readonly saving = signal(false);
  private file: File | null = null;

  readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: ['', [Validators.required, Validators.maxLength(2000)]],
    ingredients: ['', [Validators.required, Validators.maxLength(2000)]],
    categoryId: [0, [Validators.required, Validators.min(1)]],
    difficulty: ['Easy' as SaveRecipe['difficulty'], Validators.required],
    prepMinutes: [10, [Validators.required, Validators.min(0), Validators.max(1440)]],
    cookMinutes: [20, [Validators.required, Validators.min(0), Validators.max(1440)]],
    portions: [2, [Validators.required, Validators.min(1), Validators.max(50)]],
  });

  ngOnInit(): void {
    this.api.getCategories().subscribe(c => {
      this.categories.set(c);
      if (!this.id() && c.length) this.form.patchValue({ categoryId: c[0].id });
    });

    const id = Number(this.id());
    if (id) {
      this.api.getRecipe(id).subscribe({
        next: r => {
          this.form.patchValue(r);
          this.currentImage.set(imageUrl(r.imagePath));
        },
        error: e => this.error.set(errorMessage(e)),
      });
    }
  }

  pickFile(event: Event): void {
    this.file = (event.target as HTMLInputElement).files?.[0] ?? null;
  }

  save(): void {
    this.saving.set(true);
    this.error.set('');
    const id = Number(this.id());
    const body = this.form.getRawValue();

    // 1) save the recipe, 2) then upload the photo if one was chosen.
    (id ? this.api.updateRecipe(id, body) : this.api.createRecipe(body))
      .pipe(switchMap(recipe => (this.file ? this.api.uploadImage(recipe.id, this.file) : of(recipe))))
      .subscribe({
        next: recipe => this.router.navigate(['/recipes', recipe.id]),
        error: e => { this.error.set(errorMessage(e)); this.saving.set(false); },
      });
  }
}
