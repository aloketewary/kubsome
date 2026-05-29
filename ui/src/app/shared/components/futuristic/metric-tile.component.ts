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
      border-radius: 10px;
      background: linear-gradient(180deg, rgba(13, 17, 28, 0.9) 0%, rgba(8, 11, 20, 0.95) 100%);
      border: 1px solid rgba(255, 255, 255, 0.04);
      min-width: 80px;
      overflow: hidden;
      position: relative;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .mt:hover {
      border-color: rgba(255, 255, 255, 0.08);
      box-shadow: 0 4px 16px -4px rgba(0, 0, 0, 0.4);
    }

    /* Left accent bar */
    .mt-bar {
      width: 3px;
      flex-shrink: 0;
      border-radius: 3px 0 0 3px;
    }

    .mt-body {
      display: flex;
      flex-direction: column;
      padding: 10px 14px;
      gap: 1px;
    }

    .mt-val {
      font-family: 'JetBrains Mono', monospace;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1.1;
    }

    .mt-lbl {
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: rgba(255, 255, 255, 0.35);
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
    .mt-down { color: #10b981; }

    /* Accent colors */
    [data-accent="cyan"] .mt-bar { background: #00d4ff; box-shadow: 0 0 6px rgba(0, 212, 255, 0.4); }
    [data-accent="cyan"] .mt-val { color: #00d4ff; }

    [data-accent="green"] .mt-bar { background: #10b981; box-shadow: 0 0 6px rgba(16, 185, 129, 0.4); }
    [data-accent="green"] .mt-val { color: #10b981; }

    [data-accent="amber"] .mt-bar { background: #f59e0b; box-shadow: 0 0 6px rgba(245, 158, 11, 0.4); }
    [data-accent="amber"] .mt-val { color: #f59e0b; }

    [data-accent="red"] .mt-bar { background: #f43f5e; box-shadow: 0 0 6px rgba(244, 63, 94, 0.4); }
    [data-accent="red"] .mt-val { color: #f43f5e; }

    [data-accent="purple"] .mt-bar { background: #8b5cf6; box-shadow: 0 0 6px rgba(139, 92, 246, 0.4); }
    [data-accent="purple"] .mt-val { color: #8b5cf6; }

    [data-accent="default"] .mt-bar { background: rgba(255, 255, 255, 0.15); }
    [data-accent="default"] .mt-val { color: var(--text); }
  `],
})
export class MetricTileComponent {
  @Input() label = '';
  @Input() value = '0';
  @Input() delta = '';
  @Input() deltaType: 'up' | 'down' | 'neutral' = 'neutral';
  @Input() accent: 'default' | 'cyan' | 'green' | 'amber' | 'red' | 'purple' = 'default';
}
