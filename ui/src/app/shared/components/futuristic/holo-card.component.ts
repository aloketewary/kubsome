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
          @if (icon) { <i [class]="icon" class="holo-ico"></i> }
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
      background: linear-gradient(180deg, rgba(13, 17, 28, 0.92) 0%, rgba(8, 11, 20, 0.96) 100%);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 14px;
      padding: 18px 20px;
      overflow: hidden;
      transition: border-color 0.25s, box-shadow 0.25s, transform 0.25s;
    }

    /* Top-edge gradient shine */
    .holo::after {
      content: '';
      position: absolute;
      top: 0; left: 20px; right: 20px;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(0, 212, 255, 0.3), transparent);
      pointer-events: none;
    }

    /* Noise texture overlay */
    .holo::before {
      content: '';
      position: absolute;
      inset: 0;
      background: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.015'/%3E%3C/svg%3E");
      pointer-events: none;
      border-radius: 14px;
    }

    .holo-interactive:hover {
      border-color: rgba(0, 212, 255, 0.15);
      transform: translateY(-1px);
      box-shadow: 0 8px 32px -8px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(0, 212, 255, 0.05);
    }

    .holo-compact { padding: 12px 14px; }
    .holo-flat { background: rgba(10, 14, 26, 0.6); padding: 10px 12px; border-radius: 10px; }

    /* Glow variants — colored top-edge */
    [data-glow="cyan"]::after { background: linear-gradient(90deg, transparent, rgba(0, 212, 255, 0.5), transparent); }
    [data-glow="cyan"] { border-color: rgba(0, 212, 255, 0.12); }
    [data-glow="amber"]::after { background: linear-gradient(90deg, transparent, rgba(245, 158, 11, 0.5), transparent); }
    [data-glow="amber"] { border-color: rgba(245, 158, 11, 0.12); }
    [data-glow="red"]::after { background: linear-gradient(90deg, transparent, rgba(244, 63, 94, 0.5), transparent); }
    [data-glow="red"] { border-color: rgba(244, 63, 94, 0.12); }
    [data-glow="green"]::after { background: linear-gradient(90deg, transparent, rgba(16, 185, 129, 0.5), transparent); }
    [data-glow="green"] { border-color: rgba(16, 185, 129, 0.12); }
    [data-glow="purple"]::after { background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.5), transparent); }
    [data-glow="purple"] { border-color: rgba(139, 92, 246, 0.12); }

    /* Header */
    .holo-head {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }
    .holo-ico { font-size: 12px; color: #00d4ff; opacity: 0.7; }
    .holo-lbl {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: rgba(255, 255, 255, 0.4);
    }
    .holo-bdg {
      font-size: 9px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 8px;
      background: rgba(0, 212, 255, 0.1);
      color: #00d4ff;
      font-family: 'JetBrains Mono', monospace;
    }
    .holo-head-slot { margin-left: auto; display: flex; gap: 4px; }
    .holo-content { position: relative; z-index: 1; }
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
