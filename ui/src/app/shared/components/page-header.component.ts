import { Component, Input } from '@angular/core';

/**
 * Shared page header component — standardizes layout, typography,
 * and responsive behavior across all feature pages.
 *
 * Usage:
 *   <app-page-header title="Pods" [subtitle]="pods.length + ' pods'">
 *     <button pButton icon="pi pi-refresh" (click)="refresh()"></button>
 *   </app-page-header>
 *
 * Actions are projected via <ng-content> — supports any buttons,
 * search inputs, dropdowns, or custom controls.
 *
 * Exempted pages (custom headers due to specialized controls):
 *   - gateway-monitor: interval config, column config, fullscreen, live streaming
 *   - graph: canvas zoom/pan controls, layout toggles
 *   - custom-dashboard: drag-and-drop widget builder, layout mode switcher
 */

@Component({
  selector: 'app-page-header',
  standalone: true,
  template: `
    <div class="page-header">
      <div class="ph-left">
        <h1>{{ title }}</h1>
        @if (subtitle) { <p class="ph-subtitle">{{ subtitle }}</p> }
      </div>
      <div class="ph-actions">
        <ng-content />
      </div>
    </div>
  `,
  styles: [`
    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      margin-bottom: 20px; gap: 16px;
    }
    .ph-left { min-width: 0; }
    h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; margin: 0; }
    .ph-subtitle { font-size: 13px; color: var(--text-muted); margin: 4px 0 0; }
    .ph-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    @media (max-width: 768px) {
      .page-header { flex-direction: column; gap: 12px; }
      .ph-actions { width: 100%; }
    }
  `],
})
export class PageHeaderComponent {
  @Input() title = '';
  @Input() subtitle = '';
}
