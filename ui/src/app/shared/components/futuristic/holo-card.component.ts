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
      background: transparent;
      border: none;
      border-radius: 0;
      padding: 18px 20px;
      overflow: hidden;
      transition: box-shadow 0.25s, transform 0.25s;
    }

    /* Hairline rules — shared grid dividers */
    .holo::after {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 1px;
      background: rgba(94, 84, 75, 0.25);
      pointer-events: none;
    }
    .holo::before {
      content: '';
      position: absolute;
      top: 0; left: 0; bottom: 0;
      width: 1px;
      background: rgba(94, 84, 75, 0.15);
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
      transform: translateY(-1px);
      box-shadow: 0 8px 32px -12px rgba(0, 0, 0, 0.5);
    }

    .holo-compact { padding: 14px 16px; }
    .holo-flat { background: transparent; padding: 10px 12px; }

    /* Glow variants — accent the top hairline */
    [data-glow="cyan"]::after { background: rgba(208, 156, 96, 0.35); }
    [data-glow="cyan"] { }
    [data-glow="amber"]::after { background: rgba(245, 158, 11, 0.4); }
    [data-glow="amber"] { }
    [data-glow="red"]::after { background: rgba(244, 63, 94, 0.4); }
    [data-glow="red"] { }
    [data-glow="green"]::after { background: rgba(74, 222, 128, 0.35); }
    [data-glow="green"] { }
    [data-glow="purple"]::after { background: rgba(167, 139, 250, 0.35); }
    [data-glow="purple"] { }

    /* Header */
    .holo-head {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }
    .holo-ico { font-size: 12px; color: #d09c60; opacity: 0.7; }
    .holo-lbl {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: rgba(168, 158, 148, 0.5);
    }
    .holo-bdg {
      font-size: 9px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 8px;
      background: rgba(208, 156, 96, 0.1);
      color: #d09c60;
      font-family: 'JetBrains Mono', monospace;
    }
    .holo-head-slot { margin-left: auto; display: flex; gap: 4px; }
    .holo-content { position: relative; z-index: 1; }

    /* ─── Light Mode ─────────────────────────────────────────────── */
    :host-context([data-theme="light"]) .holo::after {
      background: rgba(0, 0, 0, 0.06);
    }
    :host-context([data-theme="light"]) .holo::before {
      background: rgba(0, 0, 0, 0.04);
    }
    :host-context([data-theme="light"]) .holo-interactive:hover {
      box-shadow: 0 4px 20px -8px rgba(0, 0, 0, 0.08);
    }
    :host-context([data-theme="light"]) [data-glow="cyan"]::after { background: rgba(180, 120, 60, 0.3); }
    :host-context([data-theme="light"]) [data-glow="amber"]::after { background: rgba(202, 138, 4, 0.35); }
    :host-context([data-theme="light"]) [data-glow="red"]::after { background: rgba(220, 38, 38, 0.35); }
    :host-context([data-theme="light"]) [data-glow="green"]::after { background: rgba(22, 163, 74, 0.3); }
    :host-context([data-theme="light"]) [data-glow="purple"]::after { background: rgba(124, 58, 237, 0.3); }
    :host-context([data-theme="light"]) .holo-ico { color: #9a5129; }
    :host-context([data-theme="light"]) .holo-lbl { color: rgba(0, 0, 0, 0.45); }
    :host-context([data-theme="light"]) .holo-bdg { background: rgba(154, 81, 41, 0.08); color: #9a5129; }
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
