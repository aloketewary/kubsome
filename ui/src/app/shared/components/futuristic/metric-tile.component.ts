import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-metric-tile',
  standalone: true,
  template: `
    <div class="mt" [attr.data-accent]="accent">
      <div class="mt-bar"></div>
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
      gap: 0;
      padding: 0;
      border-radius: 0;
      background: transparent;
      border: none;
      border-left: 1px solid rgba(94, 84, 75, 0.2);
      min-width: 80px;
      overflow: hidden;
      position: relative;
      transition: box-shadow 0.2s;
    }
    .mt:first-child { border-left: none; }
    .mt:hover {
      box-shadow: none;
    }

    /* Left accent bar */
    .mt-bar {
      width: 2px;
      flex-shrink: 0;
    }

    .mt-body {
      display: flex;
      flex-direction: column;
      padding: 10px 14px;
      gap: 1px;
    }

    .mt-val {
      font-family: 'JetBrains Mono', monospace;
      font-size: 20px;
      font-weight: 300;
      letter-spacing: -0.04em;
      line-height: 1.1;
    }

    .mt-lbl {
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: rgba(168, 158, 148, 0.5);
      margin-top: 2px;
    }

    .mt-delta {
      position: absolute;
      top: 8px;
      right: 10px;
      font-size: 9px;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 600;
    }
    .mt-up { color: #f43f5e; }
    .mt-down { color: #4ade80; }

    /* Accent colors */
    [data-accent="cyan"] .mt-bar { background: #d09c60; box-shadow: 0 0 6px rgba(208, 156, 96, 0.4); }
    [data-accent="cyan"] .mt-val { color: #d09c60; }

    [data-accent="green"] .mt-bar { background: #4ade80; box-shadow: 0 0 6px rgba(74, 222, 128, 0.4); }
    [data-accent="green"] .mt-val { color: #4ade80; }

    [data-accent="amber"] .mt-bar { background: #f59e0b; box-shadow: 0 0 6px rgba(245, 158, 11, 0.4); }
    [data-accent="amber"] .mt-val { color: #f59e0b; }

    [data-accent="red"] .mt-bar { background: #f43f5e; box-shadow: 0 0 6px rgba(244, 63, 94, 0.4); }
    [data-accent="red"] .mt-val { color: #f43f5e; }

    [data-accent="purple"] .mt-bar { background: #a78bfa; box-shadow: 0 0 6px rgba(167, 139, 250, 0.4); }
    [data-accent="purple"] .mt-val { color: #a78bfa; }

    [data-accent="default"] .mt-bar { background: rgba(255, 255, 255, 0.15); }
    [data-accent="default"] .mt-val { color: var(--text); }

    /* ─── Light Mode ─────────────────────────────────────────────── */
    :host-context([data-theme="light"]) .mt {
      border-left-color: rgba(0, 0, 0, 0.06);
    }
    :host-context([data-theme="light"]) .mt-val { color: var(--text); }
    :host-context([data-theme="light"]) .mt-lbl { color: rgba(0, 0, 0, 0.4); }
    :host-context([data-theme="light"]) .mt-delta.mt-up { color: #dc2626; }
    :host-context([data-theme="light"]) .mt-delta.mt-down { color: #16a34a; }
    :host-context([data-theme="light"]) [data-accent="cyan"] .mt-bar { background: #9a5129; box-shadow: none; }
    :host-context([data-theme="light"]) [data-accent="cyan"] .mt-val { color: #9a5129; }
    :host-context([data-theme="light"]) [data-accent="green"] .mt-bar { background: #16a34a; box-shadow: none; }
    :host-context([data-theme="light"]) [data-accent="green"] .mt-val { color: #16a34a; }
    :host-context([data-theme="light"]) [data-accent="amber"] .mt-bar { background: #b45309; box-shadow: none; }
    :host-context([data-theme="light"]) [data-accent="amber"] .mt-val { color: #b45309; }
    :host-context([data-theme="light"]) [data-accent="red"] .mt-bar { background: #dc2626; box-shadow: none; }
    :host-context([data-theme="light"]) [data-accent="red"] .mt-val { color: #dc2626; }
    :host-context([data-theme="light"]) [data-accent="purple"] .mt-bar { background: #7c3aed; box-shadow: none; }
    :host-context([data-theme="light"]) [data-accent="purple"] .mt-val { color: #7c3aed; }
    :host-context([data-theme="light"]) [data-accent="default"] .mt-bar { background: rgba(0, 0, 0, 0.1); }
  `],
})
export class MetricTileComponent {
  @Input() label = '';
  @Input() value = '0';
  @Input() delta = '';
  @Input() deltaType: 'up' | 'down' | 'neutral' = 'neutral';
  @Input() accent: 'default' | 'cyan' | 'green' | 'amber' | 'red' | 'purple' = 'default';
}
