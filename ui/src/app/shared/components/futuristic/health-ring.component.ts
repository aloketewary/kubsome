import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-health-ring',
  standalone: true,
  template: `
    <div class="hr" [attr.data-size]="size">
      <svg viewBox="0 0 36 36">
        <path class="hr-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
        <path class="hr-fill" [class.hr-ok]="status === 'ok'" [class.hr-warn]="status === 'warning'" [class.hr-crit]="status === 'critical'"
              [attr.stroke-dasharray]="pct + ', 100'" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
      </svg>
      <span class="hr-val">{{ label || (pct + '%') }}</span>
    </div>
  `,
  styles: [`
    .hr { position: relative; flex-shrink: 0; }
    [data-size="sm"] { width: 40px; height: 40px; }
    [data-size="md"] { width: 56px; height: 56px; }
    [data-size="lg"] { width: 80px; height: 80px; }

    svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    .hr-bg { fill: none; stroke: rgba(94, 84, 75, 0.12); stroke-width: 3; }
    .hr-fill { fill: none; stroke-width: 3.5; stroke-linecap: round; transition: stroke-dasharray 0.6s ease; }
    .hr-ok { stroke: #4ade80; filter: drop-shadow(0 0 3px rgba(74, 222, 128, 0.3)); }
    .hr-warn { stroke: #f59e0b; filter: drop-shadow(0 0 3px rgba(245, 158, 11, 0.3)); }
    .hr-crit { stroke: #f43f5e; filter: drop-shadow(0 0 3px rgba(244, 63, 94, 0.3)); }

    .hr-val {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 300; letter-spacing: -0.03em;
      color: var(--text);
    }
    [data-size="sm"] .hr-val { font-size: 10px; }
    [data-size="md"] .hr-val { font-size: 12px; }
    [data-size="lg"] .hr-val { font-size: 16px; }

    /* Light Mode */
    :host-context([data-theme="light"]) .hr-bg { stroke: rgba(0, 0, 0, 0.05); }
    :host-context([data-theme="light"]) .hr-ok { stroke: #16a34a; filter: none; }
    :host-context([data-theme="light"]) .hr-warn { stroke: #b45309; filter: none; }
    :host-context([data-theme="light"]) .hr-crit { stroke: #dc2626; filter: none; }
  `],
})
export class HealthRingComponent {
  @Input() pct = 0;
  @Input() label = '';
  @Input() status: 'ok' | 'warning' | 'critical' = 'ok';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
}
