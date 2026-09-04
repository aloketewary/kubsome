import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-section-group',
  standalone: true,
  template: `
    <section class="sg" [class.sg-warning]="status === 'warning'" [class.sg-alert]="status === 'critical'">
      <div class="sg-head">
        <button class="sg-toggle" type="button" (click)="toggle.emit()" [attr.aria-expanded]="expanded">
          <i class="pi" aria-hidden="true" [class.pi-chevron-down]="expanded" [class.pi-chevron-right]="!expanded"></i>
          <span class="sg-name">{{ title }}</span>
          <span class="sg-ratio"><strong>{{ total - unhealthy }}</strong> / {{ total }} healthy</span>
          <span class="sg-bar" aria-hidden="true"><span class="sg-bar-fill" [class.sg-bar-ok]="status === 'ok'" [class.sg-bar-warn]="status === 'warning'" [class.sg-bar-bad]="status === 'critical'" [style.width.%]="healthPct"></span></span>
          @if (healthScore !== null) {
            <span class="sg-health" [class.sg-health-ok]="healthScore >= 80" [class.sg-health-warn]="healthScore >= 40 && healthScore < 80" [class.sg-health-crit]="healthScore < 40">{{ healthScore }}</span>
          }
          @if (healthTrend !== null && healthTrend !== 0) {
            <span class="sg-trend" [class.sg-trend-down]="healthTrend < 0" [class.sg-trend-up]="healthTrend > 0">{{ healthTrend > 0 ? '+' : '' }}{{ healthTrend }}</span>
          }
          @if (healthReason) { <span class="sg-reason">{{ healthReason }}</span> }
          @if (unhealthy > 0) { <span class="sg-warn-badge" [class.sg-crit-badge]="status === 'critical'">{{ unhealthy }} {{ status === 'critical' ? 'unhealthy' : 'attention' }}</span> }
        </button>
        <div class="sg-slot" (click)="$event.stopPropagation()">
          <ng-content select="[group-actions]" />
        </div>
      </div>
      @if (expanded) { <div class="sg-body"><ng-content /></div> }
    </section>
  `,
  styles: [`
    .sg {
      margin: 0 0 10px;
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
    }

    .sg-warning { border-left: 2px solid var(--warning); }
    .sg-alert { border-left: 2px solid var(--danger); }

    .sg-head {
      display: flex;
      align-items: center;
      min-height: 48px;
      border-bottom: 1px solid var(--border);
    }

    .sg-toggle {
      display: flex;
      align-items: center;
      min-width: 0;
      flex: 1;
      gap: 10px;
      padding: 10px 12px;
      border: 0;
      background: transparent;
      color: var(--text);
      text-align: left;
      cursor: pointer;
    }

    .sg-toggle:focus-visible,
    .sg-slot button:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: -2px;
    }

    .sg-toggle:hover { background: var(--surface-hover); }
    .sg-toggle > i { width: 10px; color: var(--text-muted); font-size: 10px; }

    .sg-name {
      overflow: hidden;
      color: var(--text);
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .sg-ratio {
      color: var(--text-muted);
      font-size: 11px;
      white-space: nowrap;
    }

    .sg-ratio strong {
      color: var(--text-secondary);
      font-family: var(--font-mono);
      font-weight: 600;
    }

    .sg-bar {
      width: 48px;
      height: 3px;
      overflow: hidden;
      border-radius: 2px;
      background: var(--border-subtle);
    }

    .sg-bar-fill { display: block; height: 100%; border-radius: inherit; }
    .sg-bar-ok { background: var(--success); }
    .sg-bar-warn { background: var(--warning); }
    .sg-bar-bad { background: var(--danger); }

    .sg-health,
    .sg-trend {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 650;
      white-space: nowrap;
    }

    .sg-health-ok, .sg-trend-up { color: var(--success); }
    .sg-health-warn { color: var(--warning); }
    .sg-health-crit, .sg-trend-down { color: var(--danger); }

    .sg-reason {
      max-width: 130px;
      overflow: hidden;
      color: var(--text-muted);
      font-size: 10px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .sg-warn-badge {
      color: var(--warning);
      font-family: var(--font-mono);
      font-size: 10px;
      white-space: nowrap;
    }

    .sg-crit-badge { color: var(--danger); }

    .sg-slot {
      display: flex;
      flex: 0 0 auto;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 4px;
      padding: 0 8px 0 4px;
    }

    .sg-body { background: var(--surface); }

    @media (max-width: 768px) {
      .sg-head { align-items: flex-start; }
      .sg-toggle { flex-wrap: wrap; gap: 7px; }
      .sg-ratio { order: 5; width: 100%; padding-left: 20px; }
      .sg-bar { display: none; }
      .sg-reason { display: none; }
      .sg-slot { padding-top: 9px; }
    }
  `],
})
export class SectionGroupComponent {
  Math = Math;
  @Input() title = '';
  @Input() healthPct = 100;
  @Input() total = 0;
  @Input() unhealthy = 0;
  @Input() status: 'ok' | 'warning' | 'critical' = 'ok';
  @Input() expanded = true;
  @Output() toggle = new EventEmitter<void>();
  @Input() healthScore: number | null = null;
  @Input() healthTrend: number | null = null;
  @Input() healthReason = '';
}
