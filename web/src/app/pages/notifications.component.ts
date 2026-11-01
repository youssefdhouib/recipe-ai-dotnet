import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AppNotification } from '../core/models';
import { NotificationBadgeService } from '../core/notification-badge.service';

@Component({
  selector: 'app-notifications',
  imports: [DatePipe],
  template: `
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-3xl font-extrabold">Notifications</h1>
      <button class="btn-ghost" (click)="markAll()">Mark all as read</button>
    </div>
    <div class="space-y-2">
      @for (n of notifications(); track n.id) {
        <div class="card flex items-center gap-3 p-4" [class.border-cobalt-500]="!n.isRead">
          <button class="flex-1 text-left" (click)="open(n)">
            <p class="text-sm" [class.font-semibold]="!n.isRead">{{ n.text }}</p>
            <p class="text-xs text-ink-faint">{{ n.createdOn | date: 'medium' }}</p>
          </button>
          <button class="text-sm text-ink-faint hover:text-harissa-600" (click)="remove(n)" aria-label="Delete">✕</button>
        </div>
      } @empty {
        <p class="py-12 text-center text-ink-faint">No notifications. You'll hear here when someone reviews or saves your recipes.</p>
      }
    </div>
  `,
})
export class NotificationsComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly badge = inject(NotificationBadgeService);
  readonly notifications = signal<AppNotification[]>([]);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.getNotifications().subscribe(n => this.notifications.set(n));
    this.badge.refresh();
  }

  open(n: AppNotification): void {
    this.api.markRead(n.id).subscribe(() => this.router.navigateByUrl(n.link));
  }

  markAll(): void {
    this.api.markAllRead().subscribe(() => this.load());
  }

  remove(n: AppNotification): void {
    this.api.deleteNotification(n.id).subscribe(() => this.load());
  }
}
