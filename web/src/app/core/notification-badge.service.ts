import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

// Unread notifications counter shown on the bell in the navbar.
@Injectable({ providedIn: 'root' })
export class NotificationBadgeService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  readonly unread = signal(0);

  refresh(): void {
    if (!this.auth.isLoggedIn()) {
      this.unread.set(0);
      return;
    }
    this.api.getUnreadCount().subscribe({ next: r => this.unread.set(r.count), error: () => this.unread.set(0) });
  }
}
