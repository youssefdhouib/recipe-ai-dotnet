import { Component, computed, input } from '@angular/core';

export interface BarItem {
  label: string;
  value: number;
}

// Horizontal bar chart in plain HTML: one series, one validated hue (cobalt-500),
// bars <= 24px thick with a rounded data end, value label at the end, hover tooltip.
@Component({
  selector: 'app-bar-list',
  template: `
    <ul class="space-y-3" role="list">
      @for (item of items(); track item.label) {
        <li class="grid grid-cols-[minmax(6rem,9rem)_1fr] items-center gap-3 text-sm">
          <span class="truncate text-ink-soft">{{ item.label }}</span>
          <span class="group relative flex items-center gap-2" [attr.aria-label]="item.label + ': ' + item.value + ' ' + unit()">
            <span class="h-5 min-w-[2px] rounded-r-[4px] bg-cobalt-500 transition-[filter] group-hover:brightness-110"
                  [style.width.%]="percent(item.value)"></span>
            <span class="font-mono text-xs text-ink-soft">{{ item.value }}</span>
            <span class="pointer-events-none absolute -top-8 left-0 z-10 hidden whitespace-nowrap rounded-lg bg-ink px-2.5 py-1 font-mono text-xs text-white group-hover:block">
              {{ item.label }} · {{ item.value }} {{ unit() }}
            </span>
          </span>
        </li>
      }
    </ul>
  `,
})
export class BarListComponent {
  readonly items = input.required<BarItem[]>();
  readonly unit = input('');

  private readonly max = computed(() => Math.max(1, ...this.items().map(i => i.value)));

  // The longest bar takes 85% of the row, so its value label always fits after it.
  percent(value: number): number {
    return (85 * value) / this.max();
  }
}
