import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-section-group',
  standalone: true,
  template: `
    <div class="sg" [class.sg-alert]="unhealthy > 0">
      <div class="sg-head" (click)="toggle.emit()" tabindex="0" role="button"
           (keydown.enter)="toggle.emit()" (keydown.space)="$event.preventDefault(); toggle.emit()">
        <i class="pi" [class.pi-chevron-down]="expanded" [class.pi-chevron-right]="!expanded"></i>
        <span class="sg-name">{{ title }}</span>
        <div class="sg-bar">
          <div class="sg-bar-fill" [class.sg-bar-ok]="unhealthy === 0" [class.sg-bar-bad]="unhealthy > 0"
               [style.width.%]="healthPct"></div>
        </div>
        <span class="sg-ratio">{{ total - unhealthy }}<span class="sg-sep">/</span>{{ total }}</span>
        @if (healthScore !== null) {
  <span class="sg-health" [class.sg-health-ok]="healthScore >= 80"
        [class.sg-health-warn]="healthScore >= 40 && healthScore < 80"
        [class.sg-health-crit]="healthScore < 40">
    {{ healthScore }}
  </span>
}
@if (healthTrend !== null && healthTrend !== 0) {
  <span class="sg-trend" [class.sg-trend-down]="healthTrend < 0"
        [class.sg-trend-up]="healthTrend > 0">
    {{ healthTrend > 0 ? '↑' : '↓' }}{{ Math.abs(healthTrend) }}
  </span>
}
@if (healthReason) {
  <span class="sg-reason">{{ healthReason }}</span>
}

        @if (unhealthy > 0) {
          <span class="sg-warn-badge">{{ unhealthy }}</span>
        }
        <div class="sg-slot" (click)="$event.stopPropagation()">
          <ng-content select="[group-actions]" />
        </div>
      </div>
      @if (expanded) {
        <div class="sg-body"><ng-content /></div>
      }
    </div>
  `,
  styles: [`
    .sg {
      position: relative;
      background: linear-gradient(180deg, transparent 0%, transparent 100%);
      border: 1px solid rgba(94, 84, 75, 0.08);
      border-radius: 12px;
      margin-bottom: 6px;
      overflow: hidden;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .sg::after {
      content: '';
      position: absolute;
      top: 0; left: 16px; right: 16px;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(94, 84, 75, 0.12), transparent);
      pointer-events: none;
    }
    .sg:hover {
      border-color: rgba(255, 255, 255, 0.07);
      box-shadow: 0 4px 20px -6px rgba(0, 0, 0, 0.5);
    }
    .sg-alert {
      border-left: 2px solid rgba(244, 63, 94, 0.5);
    }
    .sg-alert::after {
      background: linear-gradient(90deg, transparent, rgba(244, 63, 94, 0.2), transparent);
    }

    .sg-head {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      cursor: pointer;
      outline: none;
      transition: background 0.12s;
    }
    .sg-head:hover { background: rgba(94, 84, 75, 0.03); }
    .sg-head:focus-visible { box-shadow: inset 0 0 0 1px rgba(208, 156, 96, 0.4); }
    .sg-head > i { color: rgba(168, 158, 148, 0.4); font-size: 9px; width: 10px; }

    .sg-name {
      font-size: 12px;
      font-weight: 600;
      color: rgba(245, 240, 235, 0.85);
      letter-spacing: -0.01em;
    }

    .sg-bar {
      width: 40px; height: 2px; border-radius: 1px;
      background: rgba(94, 84, 75, 0.1); overflow: hidden;
    }
    .sg-bar-fill { height: 100%; border-radius: 1px; transition: width 0.4s; }
    .sg-bar-ok { background: #4ade80; box-shadow: 0 0 3px rgba(74, 222, 128, 0.5); }
    .sg-bar-bad { background: #f43f5e; box-shadow: 0 0 3px rgba(244, 63, 94, 0.5); }

    .sg-ratio {
      font-size: 10px;
      font-family: 'JetBrains Mono', monospace;
      color: rgba(168, 158, 148, 0.5);
    }
    .sg-sep { opacity: 0.3; margin: 0 1px; }

    .sg-warn-badge {
      font-size: 9px;
      font-weight: 700;
      width: 18px; height: 18px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      background: rgba(244, 63, 94, 0.15);
      color: #f43f5e;
      font-family: 'JetBrains Mono', monospace;
    }

    .sg-slot { margin-left: auto; }

    .sg-body {
      border-top: 1px solid rgba(94, 84, 75, 0.06);
      padding: 2px 6px 6px;
    }

    .sg-health {
  font-size: 11px; font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
  letter-spacing: -0.04em;
}
.sg-health-ok { color: #4ade80; }
.sg-health-warn { color: #f59e0b; }
.sg-health-crit { color: #f43f5e; }

.sg-trend {
  font-size: 9px; font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
}
.sg-trend-down { color: #f43f5e; }
.sg-trend-up { color: #4ade80; }

.sg-reason {
  font-size: 9px; font-weight: 500;
  color: rgba(168, 158, 148, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}


    /* Light Mode */
    :host-context([data-theme="light"]) .sg { background: transparent; border-color: rgba(0,0,0,0.04); }
    :host-context([data-theme="light"]) .sg::after { background: linear-gradient(90deg, transparent, rgba(0,0,0,0.04), transparent); }
    :host-context([data-theme="light"]) .sg:hover { border-color: rgba(0,0,0,0.06); box-shadow: none; }
    :host-context([data-theme="light"]) .sg-alert { border-left-color: rgba(220,38,38,0.3); }
    :host-context([data-theme="light"]) .sg-alert::after { background: linear-gradient(90deg, transparent, rgba(220,38,38,0.1), transparent); }
    :host-context([data-theme="light"]) .sg-head:hover { background: rgba(0,0,0,0.015); }
    :host-context([data-theme="light"]) .sg-head:focus-visible { box-shadow: inset 0 0 0 1px rgba(154,81,41,0.2); }
    :host-context([data-theme="light"]) .sg-name { color: rgba(0,0,0,0.75); }
    :host-context([data-theme="light"]) .sg-head > i { color: rgba(0,0,0,0.3); }
    :host-context([data-theme="light"]) .sg-bar { background: rgba(0,0,0,0.04); }
    :host-context([data-theme="light"]) .sg-bar-ok { background: #16a34a; box-shadow: none; }
    :host-context([data-theme="light"]) .sg-bar-bad { background: #dc2626; box-shadow: none; }
    :host-context([data-theme="light"]) .sg-ratio { color: rgba(0,0,0,0.4); }
    :host-context([data-theme="light"]) .sg-warn-badge { background: rgba(220,38,38,0.06); color: #dc2626; }
    :host-context([data-theme="light"]) .sg-body { border-top-color: rgba(0,0,0,0.04); }
    :host-context([data-theme="light"]) .sg-health-ok { color: #16a34a; }
:host-context([data-theme="light"]) .sg-health-warn { color: #b45309; }
:host-context([data-theme="light"]) .sg-health-crit { color: #dc2626; }
:host-context([data-theme="light"]) .sg-trend-down { color: #dc2626; }
:host-context([data-theme="light"]) .sg-trend-up { color: #16a34a; }
:host-context([data-theme="light"]) .sg-reason { color: rgba(0,0,0,0.45); }

  `],
})
export class SectionGroupComponent {
  Math = Math;
  @Input() title = '';
  @Input() healthPct = 100;
  @Input() total = 0;
  @Input() unhealthy = 0;
  @Input() expanded = true;
  @Output() toggle = new EventEmitter<void>();
  @Input() healthScore: number | null = null;  // from deployment_health_snapshot
  @Input() healthTrend: number | null = null;  // computed via LAG()
  @Input() healthReason = '';                   // top_reason
}
