import { Component, computed, input } from '@angular/core';
import { DailyCount } from '../core/models';

// Column chart for a daily series: one hue, columns <= 24px with a 4px rounded top and a square baseline,
// a recessive hairline baseline, sparse date labels, and a tooltip per column.
@Component({
  selector: 'app-column-chart',
  template: `
    <div class="relative">
      <div class="flex items-center justify-between font-mono text-[11px] text-ink-faint">
        <span>max {{ max() }}</span>
      </div>
      <div class="mt-2 flex h-40 items-end gap-[2px] border-b border-line">
        @for (d of data(); track d.date; let i = $index) {
          <div class="group relative flex h-full flex-1 items-end justify-center" [attr.aria-label]="label(d)">
            <div class="w-full max-w-[24px] rounded-t-[4px] bg-cobalt-500 group-hover:brightness-110"
                 [style.height.%]="d.count === 0 ? 0 : Math.max(3, (100 * d.count) / max())"></div>
            <span class="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-lg bg-ink px-2.5 py-1 font-mono text-xs text-white group-hover:block">
              {{ label(d) }}
            </span>
          </div>
        }
      </div>
      <!-- Sparse date labels: every 4th day + the last one, on one line, centred under their column. -->
      <div class="mt-1.5 flex h-4 gap-[2px] font-mono text-[10px] text-ink-faint">
        @for (d of data(); track d.date; let i = $index) {
          <span class="relative flex-1">
            @if ((i % 4 === 0 && i < data().length - 2) || i === data().length - 1) {
              <span class="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">{{ short(d.date) }}</span>
            }
          </span>
        }
      </div>
    </div>
  `,
})
export class ColumnChartComponent {
  readonly data = input.required<DailyCount[]>();
  readonly unit = input('reviews');
  protected readonly Math = Math;

  readonly max = computed(() => Math.max(1, ...this.data().map(d => d.count)));

  short(date: string): string {
    const d = new Date(date + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  label(d: DailyCount): string {
    return `${this.short(d.date)} · ${d.count} ${this.unit()}`;
  }
}
