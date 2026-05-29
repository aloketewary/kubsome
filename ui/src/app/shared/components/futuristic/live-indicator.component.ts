import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-live-indicator',
  standalone: true,
  template: `
    <button class="li" [class.li-on]="active" [class.li-off]="!active">
      <span class="li-dot"></span>
      <span class="li-txt">{{ active ? label : offLabel }}</span>
    </button>
  `,
  styles: [`
    .li {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      border: 1px solid transparent;
      cursor: pointer;
      transition: all 0.15s;
    }
    .li-on {
      background: rgba(244, 63, 94, 0.1);
      border-color: rgba(244, 63, 94, 0.25);
      color: #f43f5e;
    }
    .li-off {
      background: rgba(94, 84, 75, 0.04);
      border-color: rgba(94, 84, 75, 0.12);
      color: rgba(168, 158, 148, 0.45);
    }
    .li-off:hover {
      border-color: rgba(208, 156, 96, 0.25);
      color: #d09c60;
      background: rgba(208, 156, 96, 0.04);
    }
    .li-dot {
      width: 5px; height: 5px;
      border-radius: 50%;
      background: currentColor;
    }
    .li-on .li-dot {
      box-shadow: 0 0 4px currentColor;
      animation: liPulse 1.4s ease-in-out infinite;
    }
    @keyframes liPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }

    /* Light Mode */
    :host-context([data-theme="light"]) .li-on { background: rgba(220,38,38,0.06); border-color: rgba(220,38,38,0.15); color: #dc2626; }
    :host-context([data-theme="light"]) .li-off { background: transparent; border-color: rgba(0,0,0,0.06); color: rgba(0,0,0,0.4); }
    :host-context([data-theme="light"]) .li-off:hover { border-color: rgba(154,81,41,0.2); color: #9a5129; background: rgba(154,81,41,0.03); }
  `],
})
export class LiveIndicatorComponent {
  @Input() active = false;
  @Input() label = 'LIVE';
  @Input() offLabel = 'WATCH';
}
