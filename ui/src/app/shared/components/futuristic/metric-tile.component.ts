import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-metric-tile',
  standalone: true,
  template: `
    <div class="mt" [attr.data-accent]="accent">
      <div class="mt-bar" aria-hidden="true"></div>
      <div class="mt-body">
        <span class="mt-val">{{ value }}</span>
        <span class="mt-lbl">{{ label }}</span>
      </div>
      @if (delta) {
        <span class="mt-delta" [class.mt-up]="deltaType === 'up'" [class.mt-down]="deltaType === 'down'">{{ delta }}</span>
      }
    </div>
  `,
  styles: [`
    .mt {
      display: flex;
      align-items: stretch;
      min-width: 0;
      min-height: 68px;
      overflow: hidden;
      position: relative;
      border-left: 1px solid var(--border);
      background: transparent;
    }

    .mt:first-child { border-left: none; }

    .mt-bar {
      width: 2px;
      flex: 0 0 2px;
      background: var(--accent);
    }

    .mt-body {
      display: flex;
      min-width: 0;
      flex-direction: column;
      justify-content: center;
      gap: 3px;
      padding: 10px 14px;
    }

    .mt-val {
      overflow: hidden;
      color: var(--text);
      font-family: var(--font-mono);
      font-size: 20px;
      font-weight: 500;
      letter-spacing: -0.04em;
      line-height: 1.1;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .mt-lbl {
      overflow: hidden;
      color: var(--text-muted);
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-overflow: ellipsis;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .mt-delta {
      position: absolute;
      top: 9px;
      right: 10px;
      font-family: var(--font-mono);
      font-size: 9px;
      font-weight: 700;
    }

    .mt-up { color: var(--danger); }
    .mt-down { color: var(--success); }

    [data-accent="default"] .mt-bar { background: var(--accent); }
    [data-accent="default"] .mt-val { color: var(--text); }
    [data-accent="cyan"] .mt-bar { background: var(--info); }
    [data-accent="cyan"] .mt-val { color: var(--info); }
    [data-accent="green"] .mt-bar { background: var(--success); }
    [data-accent="green"] .mt-val { color: var(--success); }
    [data-accent="amber"] .mt-bar { background: var(--warning); }
    [data-accent="amber"] .mt-val { color: var(--warning); }
    [data-accent="red"] .mt-bar { background: var(--danger); }
    [data-accent="red"] .mt-val { color: var(--danger); }
    [data-accent="purple"] .mt-bar { background: var(--purple); }
    [data-accent="purple"] .mt-val { color: var(--purple); }

    @media (max-width: 640px) {
      .mt-body { padding: 9px 10px; }
      .mt-val { font-size: 17px; }
      .mt-lbl { font-size: 8px; }
    }
  `],
})
export class MetricTileComponent {
  @Input() label = '';
  @Input() value = '0';
  @Input() delta = '';
  @Input() deltaType: 'up' | 'down' | 'neutral' = 'neutral';
  @Input() accent: 'default' | 'cyan' | 'green' | 'amber' | 'red' | 'purple' = 'default';
}
