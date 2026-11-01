import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { errorMessage } from '../core/api.service';
import { AuthService } from '../core/auth.service';

// Login and register share one component; "mode" comes from the route data.
@Component({
  selector: 'app-auth',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="mx-auto grid max-w-4xl overflow-hidden rounded-[28px] border border-line bg-white md:grid-cols-2">
      <div class="relative hidden bg-cobalt-600 p-10 text-white md:block">
        <p class="font-mono text-xs uppercase tracking-[0.18em] text-cobalt-100">recipe●ai</p>
        <p class="mt-6 font-display text-3xl font-extrabold leading-tight">Save recipes, rate what you cook, and get matches from your own pantry.</p>
        <div class="ceramic-strip absolute inset-x-0 bottom-0" aria-hidden="true"></div>
      </div>
      <form class="space-y-4 p-8 sm:p-10" (ngSubmit)="submit()">
        <h1 class="mb-2 text-3xl font-extrabold">{{ mode() === 'login' ? 'Welcome back' : 'Create your account' }}</h1>
        @if (mode() === 'register') {
          <div><label class="label" for="fullName">Full name</label><input id="fullName" class="input" name="fullName" [(ngModel)]="fullName" required /></div>
        }
        <div><label class="label" for="email">Email</label><input id="email" class="input" type="email" name="email" [(ngModel)]="email" required /></div>
        <div><label class="label" for="password">Password</label><input id="password" class="input" type="password" name="password" [(ngModel)]="password" required minlength="8" /></div>
        @if (error()) { <p class="error">{{ error() }}</p> }
        <button class="btn-primary w-full justify-center" type="submit" [disabled]="loading()">
          {{ mode() === 'login' ? 'Log in' : 'Create account' }}
        </button>
        <p class="text-center text-sm text-ink-soft">
          @if (mode() === 'login') { New here? <a routerLink="/register" class="font-semibold text-cobalt-600">Create an account</a> }
          @else { Already have an account? <a routerLink="/login" class="font-semibold text-cobalt-600">Log in</a> }
        </p>
      </form>
    </div>
  `,
})
export class AuthComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly mode = input<'login' | 'register'>('login');
  readonly returnUrl = input<string>('/');
  readonly error = signal('');
  readonly loading = signal(false);

  fullName = '';
  email = '';
  password = '';

  submit(): void {
    this.loading.set(true);
    this.error.set('');
    const call = this.mode() === 'login'
      ? this.auth.login(this.email, this.password)
      : this.auth.register(this.fullName, this.email, this.password);

    call.subscribe({
      next: () => this.router.navigateByUrl(this.returnUrl() || '/'),
      error: e => { this.error.set(errorMessage(e)); this.loading.set(false); },
    });
  }
}
