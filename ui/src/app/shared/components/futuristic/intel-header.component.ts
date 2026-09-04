import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-intel-header',
  standalone: true,
  template: `
    <div class="intel-header">
      <div class="intel-title-block">
        <h1 class="intel-title">
          @if (icon) { <i [class]="icon" class="title-icon" aria-hidden="true"></i> }
          {{ title }}
        </h1>
        @if (subtitle) { <p class="intel-subtitle">{{ subtitle }}</p> }
      </div>
      <div class="intel-controls">
        <ng-content />
      </div>
    </div>
  `,
  styles: [`
    .intel-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 18px;
    }

    .intel-title-block { min-width: 0; }

    .intel-title {
      display: flex;
      align-items: center;
      gap: 9px;
      margin: 0;
      color: var(--text);
      font-size: 22px;
      font-weight: 650;
      letter-spacing: -0.03em;
      line-height: 1.15;
    }

    .title-icon {
      color: var(--accent);
      font-size: 15px;
    }

    .intel-subtitle {
      margin: 5px 0 0;
      color: var(--text-muted);
      font-family: var(--font-mono);
      font-size: 11px;
      line-height: 1.4;
    }

    .intel-controls {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
      flex-wrap: wrap;
    }

    @media (max-width: 640px) {
      .intel-header { align-items: stretch; flex-direction: column; gap: 12px; }
      .intel-controls { justify-content: flex-start; }
      .intel-title { font-size: 20px; }
    }
  `],
})
export class IntelHeaderComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() icon = '';
}
