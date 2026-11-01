import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, errorMessage } from '../core/api.service';
import { ActivityLevel, CalorieRequest, CalorieResult, Goal, Sex } from '../core/models';

@Component({
  selector: 'app-calories',
  imports: [FormsModule, RouterLink],
  template: `
    <p class="eyebrow">Daily energy</p>
    <h1 class="mb-2 text-4xl font-extrabold">Calorie calculator</h1>
    <p class="mb-8 max-w-2xl text-ink-soft">How much should you eat in a day? Enter a few numbers and get your target calories and a protein / carbs / fat split.</p>

    <div class="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
      <form class="card space-y-6 p-6" (ngSubmit)="calculate()">
        <fieldset>
          <legend class="label">Sex</legend>
          <div class="grid grid-cols-2 gap-2">
            @for (s of sexes; track s) {
              <button type="button" class="seg" [class.seg-on]="form.sex === s" (click)="form.sex = s">{{ s }}</button>
            }
          </div>
        </fieldset>

        <div class="grid grid-cols-3 gap-3">
          <div><label class="label" for="age">Age</label><input id="age" class="input font-mono" type="number" name="age" [(ngModel)]="form.age" min="15" max="100" required /></div>
          <div><label class="label" for="w">Weight · kg</label><input id="w" class="input font-mono" type="number" name="weight" [(ngModel)]="form.weightKg" min="30" max="300" required /></div>
          <div><label class="label" for="h">Height · cm</label><input id="h" class="input font-mono" type="number" name="height" [(ngModel)]="form.heightCm" min="120" max="230" required /></div>
        </div>

        <fieldset>
          <legend class="label">Activity</legend>
          <div class="space-y-2">
            @for (a of activities; track a.value) {
              <button type="button" class="flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-left text-sm transition"
                      [class]="form.activity === a.value ? 'border-cobalt-600 bg-cobalt-50' : 'border-line bg-white hover:border-ink-faint'"
                      (click)="form.activity = a.value">
                <span><span class="font-semibold">{{ a.label }}</span> <span class="text-ink-soft">· {{ a.hint }}</span></span>
                <span class="font-mono text-xs text-ink-faint">×{{ a.factor }}</span>
              </button>
            }
          </div>
        </fieldset>

        <fieldset>
          <legend class="label">Goal</legend>
          <div class="grid grid-cols-3 gap-2">
            @for (g of goals; track g.value) {
              <button type="button" class="seg" [class.seg-on]="form.goal === g.value" (click)="form.goal = g.value">{{ g.label }}</button>
            }
          </div>
        </fieldset>

        @if (error()) { <p class="error">{{ error() }}</p> }
        <button class="btn-primary w-full" type="submit" [disabled]="loading()">{{ loading() ? 'Calculating…' : 'Calculate my calories' }}</button>
      </form>

      <section aria-live="polite">
        @if (result(); as r) {
          <div class="card overflow-hidden">
            <div class="bg-cobalt-600 p-6 text-white">
              <p class="font-mono text-xs uppercase tracking-[0.18em] text-cobalt-100">Your daily target</p>
              <p class="mt-1 font-mono text-6xl font-semibold leading-none">{{ r.target }}<span class="ml-2 text-2xl text-cobalt-100">kcal</span></p>
              <p class="mt-3 text-sm text-cobalt-100">≈ {{ r.perMeal }} kcal per meal over 3 meals</p>
            </div>

            <dl class="grid grid-cols-2 divide-x divide-line border-b border-line text-center">
              <div class="p-4"><dt class="eyebrow">At rest (BMR)</dt><dd class="font-mono text-xl">{{ r.bmr }}</dd></div>
              <div class="p-4"><dt class="eyebrow">Maintenance</dt><dd class="font-mono text-xl">{{ r.maintenance }}</dd></div>
            </dl>

            <div class="space-y-4 p-6">
              <h2 class="text-lg font-bold">Macros</h2>
              <div class="flex h-4 overflow-hidden rounded-full" role="img" [attr.aria-label]="macroLabel(r)">
                @for (m of r.macros; track m.name) {
                  <div [class]="macroColor(m.name)" [style.width.%]="m.percent"></div>
                }
              </div>
              <div class="grid grid-cols-3 gap-3">
                @for (m of r.macros; track m.name) {
                  <div class="rounded-xl border border-line p-3">
                    <p class="flex items-center gap-2 text-sm font-semibold"><span class="h-2.5 w-2.5 rounded-full" [class]="macroColor(m.name)"></span>{{ m.name }}</p>
                    <p class="mt-1 font-mono text-2xl">{{ m.grams }}<span class="text-sm text-ink-faint"> g</span></p>
                    <p class="font-mono text-xs text-ink-faint">{{ m.calories }} kcal · {{ m.percent }}%</p>
                  </div>
                }
              </div>
              <p class="text-sm text-ink-soft">{{ r.explanation }}</p>
              <a routerLink="/suggest" class="btn-ghost">Find recipes with what I have →</a>
              <p class="text-xs text-ink-faint">An estimate for healthy adults, not medical advice.</p>
            </div>
          </div>
        } @else {
          <div class="grid h-full min-h-[360px] place-items-center rounded-2xl border border-dashed border-line p-10 text-center">
            <div>
              <p class="font-display text-2xl font-bold">Your numbers will appear here</p>
              <p class="mt-2 text-sm text-ink-soft">Calculated with the Mifflin-St Jeor equation, the formula most dietitians use.</p>
            </div>
          </div>
        }
      </section>
    </div>
  `,
})
export class CaloriesComponent {
  private readonly api = inject(ApiService);

  readonly sexes: Sex[] = ['Male', 'Female'];
  readonly activities: { value: ActivityLevel; label: string; hint: string; factor: string }[] = [
    { value: 'Sedentary', label: 'Sedentary', hint: 'desk job, little exercise', factor: '1.2' },
    { value: 'Light', label: 'Light', hint: 'exercise 1–3 days a week', factor: '1.375' },
    { value: 'Moderate', label: 'Moderate', hint: 'exercise 3–5 days a week', factor: '1.55' },
    { value: 'Active', label: 'Active', hint: 'exercise 6–7 days a week', factor: '1.725' },
    { value: 'VeryActive', label: 'Very active', hint: 'physical job + training', factor: '1.9' },
  ];
  readonly goals: { value: Goal; label: string }[] = [
    { value: 'Lose', label: 'Lose weight' },
    { value: 'Maintain', label: 'Maintain' },
    { value: 'Gain', label: 'Gain weight' },
  ];

  readonly result = signal<CalorieResult | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  form: CalorieRequest = { sex: 'Male', age: 23, weightKg: 75, heightCm: 178, activity: 'Moderate', goal: 'Maintain' };

  calculate(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.calculateCalories(this.form).subscribe({
      next: r => { this.result.set(r); this.loading.set(false); },
      error: e => { this.error.set(errorMessage(e)); this.loading.set(false); },
    });
  }

  macroColor(name: string): string {
    return name === 'Protein' ? 'bg-olive-600' : name === 'Carbs' ? 'bg-saffron-400' : 'bg-cobalt-500';
  }

  macroLabel(r: CalorieResult): string {
    return r.macros.map(m => `${m.name} ${m.percent}%`).join(', ');
  }
}
