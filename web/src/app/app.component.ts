import { Component, effect, inject } from '@angular/core';
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

  constructor() {
    // Refresh the bell on login/logout and after every page change.
    effect(() => {
      this.auth.isLoggedIn();
      this.badge.refresh();
    });
    inject(Router).events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => this.badge.refresh());
  }
}
