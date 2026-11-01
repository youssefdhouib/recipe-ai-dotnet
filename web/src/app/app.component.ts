import { Component, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from './core/auth.service';
import { NotificationBadgeService } from './core/notification-badge.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
})
export class AppComponent {
  readonly auth = inject(AuthService);
  readonly badge = inject(NotificationBadgeService);

  // The admin space has its own layout, so the public header and footer are hidden there.
  readonly inAdmin = signal(false);

  constructor() {
    // Refresh the bell on login/logout and after every page change.
    effect(() => {
      this.auth.isLoggedIn();
      this.badge.refresh();
    });
    inject(Router).events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(e => {
      this.inAdmin.set(e.urlAfterRedirects.startsWith('/admin'));
      this.badge.refresh();
    });
  }
}
