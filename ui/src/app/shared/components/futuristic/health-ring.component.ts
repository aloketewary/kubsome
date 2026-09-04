import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-health-ring',
  standalone: true,
  template: `
    <div class="hr" [attr.data-size]="size" role="img" [attr.aria-label]="(label || (pct + '%')) + ' health'">
      <svg viewBox="0 0 36 36" aria-hidden="true">
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
    .hr-bg { fill: none; stroke: var(--border); stroke-width: 3; }
    .hr-fill { fill: none; stroke-width: 3.5; stroke-linecap: round; transition: stroke-dasharray 0.6s ease; }
    .hr-ok { stroke: var(--success); filter: drop-shadow(0 0 3px rgba(var(--success-rgb), 0.3)); }
    .hr-warn { stroke: var(--warning); filter: drop-shadow(0 0 3px rgba(var(--warning-rgb), 0.3)); }
    .hr-crit { stroke: var(--danger); filter: drop-shadow(0 0 3px rgba(var(--danger-rgb), 0.3)); }

    .hr-val {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text);
      font-family: var(--font-mono);
      font-weight: 600;
      letter-spacing: -0.03em;
    }

    [data-size="sm"] .hr-val { font-size: 10px; }
    [data-size="md"] .hr-val { font-size: 12px; }
    [data-size="lg"] .hr-val { font-size: 16px; }

    :host-context([data-theme="light"]) .hr-ok,
    :host-context([data-theme="light"]) .hr-warn,
    :host-context([data-theme="light"]) .hr-crit {
      filter: none;
    }

    @media (prefers-reduced-motion: reduce) {
      .hr-fill { transition: none; }
    }
  `],
})
export class HealthRingComponent {
  @Input() pct = 0;
  @Input() label = '';
  @Input() status: 'ok' | 'warning' | 'critical' = 'ok';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
}
