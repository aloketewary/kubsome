import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-live-indicator',
  standalone: true,
  template: `
    <span class="li" [class.li-on]="active" [class.li-off]="!active" role="status" aria-live="polite">
      <span class="li-dot" aria-hidden="true"></span>
      <span class="li-txt">{{ active ? label : offLabel }}</span>
    </span>
  `,
  styles: [`
    .li {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-height: 28px;
      padding: 4px 8px;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 10px;
      font-weight: 650;
      letter-spacing: 0.03em;
    }

    .li-on { border-color: rgba(var(--success-rgb), 0.34); color: var(--success); }
    .li-off { color: var(--text-muted); }

    .li-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
    }

    .li-on .li-dot { animation: li-pulse 2s ease-in-out infinite; }

    @keyframes li-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.45; }
    }

    @media (prefers-reduced-motion: reduce) {
      .li-on .li-dot { animation: none; }
    }
  `],
})
export class LiveIndicatorComponent {
  @Input() active = false;
  @Input() label = 'LIVE';
  @Input() offLabel = 'OFFLINE';
}
