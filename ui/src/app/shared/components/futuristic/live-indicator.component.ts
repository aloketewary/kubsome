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
      background: rgba(255, 255, 255, 0.02);
      border-color: rgba(255, 255, 255, 0.06);
      color: rgba(255, 255, 255, 0.35);
    }
    .li-off:hover {
      border-color: rgba(0, 212, 255, 0.25);
      color: #00d4ff;
      background: rgba(0, 212, 255, 0.04);
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
  `],
})
export class LiveIndicatorComponent {
  @Input() active = false;
  @Input() label = 'LIVE';
  @Input() offLabel = 'WATCH';
}
