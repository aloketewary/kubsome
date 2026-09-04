import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-holo-card',
  standalone: true,
  template: `
    <div class="holo" [class.holo-compact]="compact" [class.holo-flat]="flat"
         [class.holo-interactive]="interactive"
         [attr.data-glow]="glow">
      @if (title) {
        <div class="holo-head">
          @if (icon) { <i [class]="icon" class="holo-ico" aria-hidden="true"></i> }
          <span class="holo-lbl">{{ title }}</span>
          @if (badge) { <span class="holo-bdg">{{ badge }}</span> }
          <div class="holo-head-slot"><ng-content select="[header-actions]" /></div>
        </div>
      }
      <div class="holo-content"><ng-content /></div>
    </div>
  `,
  styles: [`
    .holo {
      position: relative;
      overflow: hidden;
      padding: 18px 20px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface-card);
      transition: border-color 0.2s var(--transition-smooth), box-shadow 0.2s var(--transition-smooth), transform 0.2s var(--transition-smooth);
    }

    .holo::before {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.012'/%3E%3C/svg%3E");
      opacity: 0.55;
    }

    .holo-interactive:hover {
      border-color: var(--border-hover);
      box-shadow: var(--shadow);
      transform: translateY(-1px);
    }

    .holo-compact { padding: 14px 16px; }
    .holo-flat {
      border-color: transparent;
      border-radius: 0;
      background: transparent;
      padding: 10px 12px;
    }

    [data-glow="cyan"] { border-top-color: var(--info); }
    [data-glow="amber"] { border-top-color: var(--warning); }
    [data-glow="red"] { border-top-color: var(--danger); }
    [data-glow="green"] { border-top-color: var(--success); }
    [data-glow="purple"] { border-top-color: var(--purple); }

    .holo-head {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }

    .holo-ico {
      color: var(--accent);
      font-size: 12px;
      opacity: 0.9;
    }

    .holo-lbl {
      color: var(--text-secondary);
      font-size: 10px;
      font-weight: 750;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .holo-bdg {
      padding: 2px 7px;
      border: 1px solid rgba(var(--accent-rgb), 0.2);
      border-radius: var(--radius-pill);
      background: var(--accent-subtle);
      color: var(--accent);
      font-family: var(--font-mono);
      font-size: 9px;
      font-weight: 700;
    }

    .holo-head-slot {
      display: flex;
      gap: 4px;
      margin-left: auto;
    }

    .holo-content {
      position: relative;
      z-index: 1;
    }

    @media (prefers-reduced-motion: reduce) {
      .holo { transition: none; }
      .holo-interactive:hover { transform: none; }
    }
  `],
})
export class HoloCardComponent {
  @Input() title = '';
  @Input() icon = '';
  @Input() badge = '';
  @Input() glow: 'none' | 'cyan' | 'amber' | 'red' | 'green' | 'purple' = 'none';
  @Input() compact = false;
  @Input() flat = false;
  @Input() interactive = false;
}
