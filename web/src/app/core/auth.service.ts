import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthResponse, User } from './models';

const STORAGE_KEY = 'recipe-ai-auth';

// Holds the logged-in user with Angular signals. Components read user(), isLoggedIn(), isAdmin().
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly session = signal<AuthResponse | null>(this.load());

  readonly user = computed<User | null>(() => this.session()?.user ?? null);
  readonly isLoggedIn = computed(() => this.session() !== null);
  readonly isAdmin = computed(() => this.user()?.roles.includes('Admin') ?? false);

  get token(): string | null {
    return this.session()?.token ?? null;
  }

  login(email: string, password: string) {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, { email, password })
      .pipe(tap(res => this.save(res)));
  }

  register(fullName: string, email: string, password: string) {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/register`, { fullName, email, password })
      .pipe(tap(res => this.save(res)));
  }

  logout(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.session.set(null);
    this.router.navigateByUrl('/login');
  }

  private save(res: AuthResponse): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(res));
    this.session.set(res);
  }

  // Restores the session after a page refresh, unless the token has expired.
  private load(): AuthResponse | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const res = JSON.parse(raw) as AuthResponse;
      return new Date(res.expiresAt) > new Date() ? res : null;
    } catch {
      return null;
    }
  }
}
