import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-sparkline',
  standalone: true,
  template: `
    <div class="sp" [attr.data-height]="height">
      @if (label) { <span class="sp-label">{{ label }}</span> }
      <div class="sp-bars">
        @for (bar of bars; track $index) {
          <div class="sp-bar" [style.height.%]="bar" [class.sp-high]="bar > highThreshold" [class.sp-med]="bar > medThreshold && bar <= highThreshold"></div>
        }
      </div>
    </div>
  `,
  styles: [`
    .sp { display: flex; flex-direction: column; gap: 3px; }
    .sp-label { font-size: 9px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; }
    .sp-bars { display: flex; align-items: flex-end; gap: 1px; }
    [data-height="sm"] .sp-bars { height: 20px; }
    [data-height="md"] .sp-bars { height: 28px; }
    [data-height="lg"] .sp-bars { height: 48px; }

    .sp-bar {
      flex: 1; min-width: 3px; min-height: 2px;
      border-radius: 1px 1px 0 0;
      background: var(--accent); opacity: 0.35;
      transition: height 0.3s ease;
    }
    .sp-bar.sp-high { background: var(--danger); opacity: 0.5; }
    .sp-bar.sp-med { background: var(--warning); opacity: 0.45; }

    :host-context([data-theme="light"]) .sp-bar { background: #9a5129; opacity: 0.3; }
    :host-context([data-theme="light"]) .sp-bar.sp-high { background: #dc2626; opacity: 0.45; }
    :host-context([data-theme="light"]) .sp-bar.sp-med { background: #b45309; opacity: 0.4; }
  `],
})
export class SparklineComponent {
  @Input() bars: number[] = [];
  @Input() label = '';
  @Input() height: 'sm' | 'md' | 'lg' = 'md';
  @Input() highThreshold = 70;
  @Input() medThreshold = 40;
}
