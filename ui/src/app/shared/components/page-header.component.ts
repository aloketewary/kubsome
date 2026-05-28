import { Component, Input } from '@angular/core';

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
