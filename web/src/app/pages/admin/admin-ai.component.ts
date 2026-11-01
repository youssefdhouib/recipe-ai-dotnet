import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ApiService, errorMessage } from '../../core/api.service';
import { AiDay, AiMonitor } from '../../core/models';
import { BarListComponent } from '../../shared/bar-list.component';
import { AdminHeadingComponent } from './admin-ui';

// Reads the AiCallLog table: every call the suggestion pipeline made to the AI provider.
@Component({
  selector: 'app-admin-ai',
  imports: [DatePipe, DecimalPipe, BarListComponent, AdminHeadingComponent],
  template: `
    <app-admin-heading title="AI monitor" subtitle="Every call the suggestion pipeline made to the AI provider. Failed calls fall back to keyword matching.">
      <div class="flex gap-1.5" role="group" aria-label="Period">
        @for (d of periods; track d) {
          <button class="seg !py-1.5" [class.seg-on]="days() === d" [attr.aria-pressed]="days() === d" (click)="setDays(d)">{{ d }} days</button>
        }
      </div>
    </app-admin-heading>

    @if (error()) { <p class="error mb-4">{{ error() }}</p> }

    @if (data(); as m) {
      <dl class="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <div class="card p-5"><dt class="eyebrow">Calls</dt><dd class="mt-1 font-mono text-4xl font-semibold">{{ m.usage.calls }}</dd></div>
        <div class="card p-5">
          <dt class="eyebrow">Success rate</dt>
          <dd class="mt-1 flex items-center gap-2 font-mono text-4xl font-semibold">
            {{ m.usage.calls ? (m.usage.successRate | number: '1.0-1') + '%' : '—' }}
            @if (m.usage.calls) {
              <span class="text-lg" aria-hidden="true" [class]="m.usage.successRate >= 95 ? 'text-olive-600' : 'text-harissa-600'">{{ m.usage.successRate >= 95 ? '✓' : '!' }}</span>
            }
          </dd>
        </div>
        <div class="card p-5"><dt class="eyebrow">Failed → fallback</dt><dd class="mt-1 font-mono text-4xl font-semibold">{{ m.usage.failed }}</dd></div>
        <div class="card p-5"><dt class="eyebrow">Avg latency</dt><dd class="mt-1 font-mono text-4xl font-semibold">{{ m.usage.averageMs }}<span class="text-base text-ink-faint"> ms</span></dd></div>
      </dl>

      <div class="mb-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <!-- Calls per day: succeeded stacked with failed -->
        <section class="card p-6">
          <div class="mb-5 flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-lg font-bold">Calls per day</h2>
            <p class="flex gap-4 text-xs text-ink-soft">
              <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-cobalt-500"></span>Succeeded</span>
              <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-harissa-600"></span>Failed</span>
            </p>
          </div>
          <div class="flex h-44 items-end gap-[2px] border-b border-line">
            @for (d of m.perDay; track d.date) {
              <div class="group relative flex h-full flex-1 items-end justify-center" [attr.aria-label]="dayLabel(d)">
                <div class="flex w-full max-w-[24px] flex-col-reverse overflow-hidden rounded-t-[4px]" [style.height.%]="barHeight(d)">
                  <div class="bg-cobalt-500" [style.flex-grow]="d.succeeded"></div>
                  @if (d.failed) { <div class="border-b-2 border-white bg-harissa-600" [style.flex-grow]="d.failed"></div> }
                </div>
                <span class="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-lg bg-ink px-2.5 py-1 font-mono text-xs text-white group-hover:block">{{ dayLabel(d) }}</span>
              </div>
            }
          </div>
          <div class="mt-1.5 flex justify-between font-mono text-[10px] text-ink-faint">
            <span>{{ m.perDay[0].date | date: 'd MMM' }}</span><span>{{ m.perDay[m.perDay.length - 1].date | date: 'd MMM' }}</span>
          </div>
        </section>

        <section class="card p-6">
          <h2 class="text-lg font-bold">Latency per step</h2>
          <p class="mb-5 text-sm text-ink-soft">Average of successful calls (ms).</p>
          @if (stepBars().length) { <app-bar-list [items]="stepBars()" unit="ms" /> } @else { <p class="text-sm text-ink-soft">No successful call in this period.</p> }
        </section>
      </div>

      <section class="card overflow-hidden">
        <h2 class="border-b border-line px-4 py-3 text-lg font-bold">Latest calls</h2>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[560px] text-sm">
            <thead>
              <tr class="border-b border-line bg-paper/60 text-left">
                <th class="eyebrow px-4 py-2.5">When</th>
                <th class="eyebrow px-4 py-2.5">Step</th>
                <th class="eyebrow px-4 py-2.5">Provider</th>
                <th class="eyebrow px-4 py-2.5 text-right">Duration</th>
                <th class="eyebrow px-4 py-2.5">Result</th>
              </tr>
            </thead>
            <tbody>
              @for (c of m.recent; track c.id) {
                <tr class="border-b border-line last:border-0">
                  <td class="px-4 py-2.5 font-mono text-xs text-ink-soft">{{ c.createdOn + 'Z' | date: 'd MMM, HH:mm:ss' }}</td>
                  <td class="px-4 py-2.5"><span class="tile-plain">{{ c.step }}</span></td>
                  <td class="px-4 py-2.5 text-ink-soft">{{ c.provider }}</td>
                  <td class="px-4 py-2.5 text-right font-mono">{{ c.durationMs }} ms</td>
                  <td class="px-4 py-2.5">
                    <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold" [class]="c.success ? 'bg-olive-100 text-olive-700' : 'bg-harissa-100 text-harissa-600'">{{ c.success ? '✓ OK' : '! Failed' }}</span>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="px-4 py-10 text-center text-ink-soft">No AI calls yet. Try “Match my fridge”.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    } @else if (!error()) {
      <div class="grid gap-4 xl:grid-cols-4">@for (i of [1, 2, 3, 4]; track i) { <div class="h-28 animate-pulse rounded-2xl bg-line/60"></div> }</div>
    }
  `,
})
export class AdminAiComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly periods = [7, 14, 30];
  readonly days = signal(14);
  readonly data = signal<AiMonitor | null>(null);
  readonly error = signal('');

  readonly stepBars = computed(() => (this.data()?.usage.steps ?? []).map(s => ({ label: `${s.step} · ${s.calls}`, value: s.averageMs })));
  private readonly max = computed(() => Math.max(1, ...(this.data()?.perDay ?? []).map(d => d.succeeded + d.failed)));

  ngOnInit(): void {
    this.load();
  }

  setDays(days: number): void {
    this.days.set(days);
    this.load();
  }

  load(): void {
    this.api.getAiMonitor(this.days()).subscribe({ next: m => this.data.set(m), error: e => this.error.set(errorMessage(e)) });
  }

  barHeight(d: AiDay): number {
    const total = d.succeeded + d.failed;
    return total === 0 ? 0 : Math.max(3, (100 * total) / this.max());
  }

  dayLabel(d: AiDay): string {
    const date = new Date(d.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return `${date} · ${d.succeeded} ok, ${d.failed} failed`;
  }
}
