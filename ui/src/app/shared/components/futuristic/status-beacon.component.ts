import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-status-beacon',
  standalone: true,
  template: `
    <span class="bk" [attr.data-status]="status" [attr.data-size]="size" [class.bk-pulse]="pulse || status === 'critical'"></span>
  `,
  styles: [`
    .bk {
      position: relative;
      display: inline-block;
      border-radius: 50%;
      flex-shrink: 0;
    }

    /* Sizes */
    [data-size="sm"] { width: 6px; height: 6px; }
    [data-size="md"] { width: 8px; height: 8px; }
    [data-size="lg"] { width: 12px; height: 12px; }

    /* Colors with glow */
    [data-status="ok"] { background: #4ade80; box-shadow: 0 0 4px #4ade80, 0 0 8px rgba(74, 222, 128, 0.3); }
    [data-status="warning"] { background: #f59e0b; box-shadow: 0 0 4px #f59e0b, 0 0 8px rgba(245, 158, 11, 0.3); }
    [data-status="critical"] { background: #f43f5e; box-shadow: 0 0 4px #f43f5e, 0 0 8px rgba(244, 63, 94, 0.3); }
    [data-status="idle"] { background: rgba(94, 84, 75, 0.2); box-shadow: none; }
    [data-status="info"] { background: #d09c60; box-shadow: 0 0 4px #d09c60, 0 0 8px rgba(208, 156, 96, 0.3); }

    /* Pulse */
    .bk-pulse { animation: bkPulse 2s ease-in-out infinite; }
    @keyframes bkPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.35; }
    }

    /* Light Mode — no glow */
    :host-context([data-theme="light"]) [data-status="ok"] { background: #16a34a; box-shadow: none; }
    :host-context([data-theme="light"]) [data-status="warning"] { background: #b45309; box-shadow: none; }
    :host-context([data-theme="light"]) [data-status="critical"] { background: #dc2626; box-shadow: none; }
    :host-context([data-theme="light"]) [data-status="info"] { background: #9a5129; box-shadow: none; }
    :host-context([data-theme="light"]) [data-status="idle"] { background: rgba(0,0,0,0.15); }
  `],
})
export class StatusBeaconComponent {
  @Input() status: 'ok' | 'warning' | 'critical' | 'idle' | 'info' = 'idle';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() pulse = false;
}
