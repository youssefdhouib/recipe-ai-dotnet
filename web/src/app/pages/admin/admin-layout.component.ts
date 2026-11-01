import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth.service';

interface NavItem { path: string; label: string; icon: string; exact?: boolean; }

// The admin space: its own sidebar + top bar, the public header is hidden (see AppComponent).
// Protected by adminGuard here and [Authorize(Roles = "Admin")] in the API.
@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-screen lg:grid lg:grid-cols-[15rem_1fr]">
      <!-- Sidebar (a top bar on small screens) -->
      <aside class="bg-ink text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div class="ceramic-strip" aria-hidden="true"></div>
        <div class="flex items-center justify-between px-5 py-4 lg:block">
          <a routerLink="/admin" class="font-display text-xl font-extrabold tracking-tight">recipe<span class="text-saffron-400">●</span>ai</a>
          <p class="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50 lg:mt-1">Admin space</p>
        </div>

        <nav class="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible lg:pb-0" aria-label="Admin">
          @for (item of nav; track item.path) {
            <a [routerLink]="item.path" routerLinkActive="!bg-white/10 !text-white" [routerLinkActiveOptions]="{ exact: !!item.exact }"
               class="group relative flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/65 transition hover:bg-white/5 hover:text-white">
              <svg viewBox="0 0 24 24" class="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path [attr.d]="item.icon" />
              </svg>
              {{ item.label }}
            </a>
          }
        </nav>

        <div class="hidden border-t border-white/10 p-3 lg:block">
          <a routerLink="/" class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/65 hover:bg-white/5 hover:text-white">
            <span aria-hidden="true">←</span> Back to the site
          </a>
        </div>
      </aside>

      <!-- Content -->
      <div class="min-w-0 bg-paper">
        <header class="flex items-center justify-end gap-3 border-b border-line bg-white px-5 py-3 text-sm lg:px-8">
          <a routerLink="/" class="btn-ghost !px-4 !py-1.5 lg:hidden">View site</a>
          @if (auth.user(); as user) {
            <span class="flex items-center gap-2">
              <span class="grid h-8 w-8 place-items-center rounded-full bg-cobalt-50 font-display text-sm font-bold text-cobalt-700">{{ user.fullName.charAt(0) }}</span>
              <span class="hidden text-ink-soft sm:inline">{{ user.fullName }}</span>
            </span>
          }
          <button class="btn-ghost !px-4 !py-1.5" (click)="auth.logout()">Log out</button>
        </header>
        <main class="px-5 py-8 lg:px-8">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class AdminLayoutComponent {
  readonly auth = inject(AuthService);

  // Icon paths are simple 24px strokes (Lucide-style), drawn inline: no icon library needed.
  readonly nav: NavItem[] = [
    { path: '/admin', label: 'Dashboard', exact: true, icon: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z' },
    { path: '/admin/recipes', label: 'Recipes', icon: 'M4 19.5V5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-1.5zM4 19.5A2 2 0 0 1 6 18h12M9 7h6M9 11h4' },
    { path: '/admin/reviews', label: 'Reviews', icon: 'M12 2l3 6.3 7 1-5 4.8 1.2 6.9L12 17.8 5.8 21l1.2-6.9-5-4.8 7-1z' },
    { path: '/admin/users', label: 'Users', icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8' },
    { path: '/admin/categories', label: 'Categories', icon: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z' },
    { path: '/admin/ai', label: 'AI monitor', icon: 'M12 3v3M12 18v3M3 12h3M18 12h3M6.3 6.3l2.1 2.1M15.6 15.6l2.1 2.1M6.3 17.7l2.1-2.1M15.6 8.4l2.1-2.1M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z' },
  ];
}
