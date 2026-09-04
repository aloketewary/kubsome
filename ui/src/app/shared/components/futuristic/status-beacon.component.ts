import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-status-beacon',
  standalone: true,
  template: `
    <span class="bk" [attr.data-status]="status" [attr.data-size]="size"
      [class.bk-pulse]="pulse || status === 'critical'" [attr.aria-label]="statusLabel" role="img"></span>
  `,
  styles: [`
    .bk {
      display: inline-block;
      flex-shrink: 0;
      border-radius: 50%;
    }

    [data-size="sm"] { width: 7px; height: 7px; }
    [data-size="md"] { width: 9px; height: 9px; }
    [data-size="lg"] { width: 12px; height: 12px; }

    [data-status="ok"] { background: var(--success); }
    [data-status="warning"] { background: var(--warning); }
    [data-status="critical"] { background: var(--danger); }
    [data-status="idle"] { background: var(--text-muted); }
    [data-status="info"] { background: var(--info); }

    .bk-pulse { animation: bk-pulse 2s ease-in-out infinite; }

    @keyframes bk-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.45; }
    }

    @media (prefers-reduced-motion: reduce) {
      .bk-pulse { animation: none; }
    }
  `],
})
export class StatusBeaconComponent {
  @Input() status: 'ok' | 'warning' | 'critical' | 'idle' | 'info' = 'idle';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() pulse = false;

  get statusLabel(): string {
    switch (this.status) {
      case 'ok': return 'Healthy';
      case 'warning': return 'Warning';
      case 'critical': return 'Critical';
      case 'info': return 'Information';
      default: return 'Inactive';
    }
  }
}
