import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { ApiService, errorMessage } from '../../core/api.service';
import { AdminUser, PagedResult } from '../../core/models';
import { AdminFiltersComponent, AdminHeadingComponent, PagerComponent } from './admin-ui';

type UserAction = 'ban' | 'unban' | 'make-admin' | 'remove-admin';

@Component({
  selector: 'app-admin-users',
  imports: [DatePipe, AdminHeadingComponent, AdminFiltersComponent, PagerComponent],
  template: `
    <app-admin-heading title="Users" subtitle="A ban blocks login and ends the user's current session at once." />

    @if (error()) { <p class="error mb-4">{{ error() }}</p> }
    @if (notice()) { <p class="mb-4 rounded-xl border border-olive-600/30 bg-olive-100 px-4 py-2.5 text-sm text-olive-700" role="status">{{ notice() }}</p> }

    <section class="card overflow-hidden">
      <app-admin-filters placeholder="Search name or email…" [search]="search()" [status]="status()" [statuses]="statuses"
                         (searchChange)="onSearch($event)" (statusChange)="onStatus($event)" />

      <div class="overflow-x-auto">
        <table class="w-full min-w-[760px] text-sm">
          <thead>
            <tr class="border-b border-line bg-paper/60 text-left">
              <th class="eyebrow px-4 py-2.5">User</th>
              <th class="eyebrow px-4 py-2.5">Role</th>
              <th class="eyebrow px-4 py-2.5">Status</th>
              <th class="eyebrow px-4 py-2.5 text-right" title="Recipes / reviews / replies">Activity</th>
              <th class="eyebrow px-4 py-2.5">Joined</th>
              <th class="px-4 py-2.5"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            @for (u of result()?.items ?? []; track u.id) {
              <tr class="border-b border-line last:border-0 hover:bg-paper/50">
                <td class="px-4 py-3">
                  <div class="flex items-center gap-3">
                    <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-sm font-bold"
                          [class]="u.isBanned ? 'bg-harissa-100 text-harissa-600' : 'bg-cobalt-50 text-cobalt-700'">{{ u.fullName.charAt(0) }}</span>
                    <div>
                      <p class="font-semibold">{{ u.fullName }} @if (u.isMe) { <span class="ml-1 rounded-full bg-cobalt-50 px-2 py-0.5 text-[10px] font-semibold text-cobalt-700">You</span> }</p>
                      <p class="text-xs text-ink-faint">{{ u.email }}</p>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3">
                  <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold" [class]="u.isAdmin ? 'bg-cobalt-600 text-white' : 'bg-line/70 text-ink-soft'">{{ u.isAdmin ? 'Admin' : 'User' }}</span>
                </td>
                <td class="px-4 py-3">
                  <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold" [class]="u.isBanned ? 'bg-harissa-100 text-harissa-600' : 'bg-olive-100 text-olive-700'">{{ u.isBanned ? 'Banned' : 'Active' }}</span>
                </td>
                <td class="px-4 py-3 text-right font-mono text-xs text-ink-soft">
                  <span title="Recipes">{{ u.recipes }} ✎</span> · <span title="Reviews">{{ u.reviews }} ★</span> · <span title="Replies">{{ u.replies }} ↩</span>
                </td>
                <td class="px-4 py-3 font-mono text-xs text-ink-soft">{{ u.createdOn | date: 'd MMM y' }}</td>
                <td class="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold">
                  @if (u.isMe) {
                    <span class="text-ink-faint">—</span>
                  } @else {
                    @if (!u.isBanned) {
                      <button class="mr-3 text-cobalt-600 hover:underline" (click)="act(u, u.isAdmin ? 'remove-admin' : 'make-admin')">{{ u.isAdmin ? 'Remove admin' : 'Make admin' }}</button>
                    }
                    @if (u.isBanned) {
                      <button class="text-olive-700 hover:underline" (click)="act(u, 'unban')">Unban</button>
                    } @else if (!u.isAdmin) {
                      <button class="text-harissa-600 hover:underline" (click)="act(u, 'ban')">Ban</button>
                    }
                  }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="6" class="px-4 py-10 text-center text-ink-soft">{{ result() ? 'No user matches these filters.' : 'Loading…' }}</td></tr>
            }
          </tbody>
        </table>
      </div>

      @if (result(); as p) { <app-pager [page]="p.page" [pageSize]="p.pageSize" [total]="p.totalCount" (pageChange)="goTo($event)" /> }
    </section>
  `,
})
export class AdminUsersComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly initialStatus = input('', { alias: 'status' });

  readonly statuses = [
    { value: '', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'banned', label: 'Banned' },
    { value: 'admins', label: 'Admins' },
  ];
  readonly search = signal('');
  readonly status = signal('');
  readonly page = signal(1);
  readonly result = signal<PagedResult<AdminUser> | null>(null);
  readonly error = signal('');
  readonly notice = signal('');
  private timer?: ReturnType<typeof setTimeout>;

  private readonly confirmText: Record<UserAction, (name: string) => string> = {
    'ban': n => `Ban ${n}? They are signed out and can no longer log in.`,
    'unban': n => `Unban ${n}?`,
    'make-admin': n => `Give ${n} full admin access?`,
    'remove-admin': n => `Remove admin access from ${n}?`,
  };
  private readonly doneText: Record<UserAction, (name: string) => string> = {
    'ban': n => `${n} is banned.`,
    'unban': n => `${n} can log in again.`,
    'make-admin': n => `${n} is now an admin.`,
    'remove-admin': n => `${n} is no longer an admin.`,
  };

  ngOnInit(): void {
    this.status.set(this.initialStatus() ?? '');
    this.load();
  }

  load(): void {
    this.api.getAdminUsers({ search: this.search(), status: this.status(), page: this.page(), pageSize: 10 }).subscribe({
      next: r => this.result.set(r),
      error: e => this.error.set(errorMessage(e)),
    });
  }

  onSearch(value: string): void {
    this.search.set(value);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.page.set(1); this.load(); }, 300);
  }

  onStatus(value: string): void {
    this.status.set(value);
    this.page.set(1);
    this.load();
  }

  goTo(page: number): void {
    this.page.set(page);
    this.load();
  }

  act(u: AdminUser, action: UserAction): void {
    if (!confirm(this.confirmText[action](u.fullName))) return;
    this.error.set('');
    this.api.userAction(u.id, action).subscribe({
      next: () => { this.notice.set(this.doneText[action](u.fullName)); this.load(); },
      error: e => { this.notice.set(''); this.error.set(errorMessage(e)); },
    });
  }
}
