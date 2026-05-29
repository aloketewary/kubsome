import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-intel-header',
  standalone: true,
  template: `
    <div class="intel-header">
      <div class="intel-title-block">
        <h1 class="intel-title">
          @if (icon) { <i [class]="icon" class="title-icon"></i> }
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
      display: flex; align-items: flex-start; justify-content: space-between;
      margin-bottom: 16px;
    }
    .intel-title {
      font-size: 20px; font-weight: 800; letter-spacing: -0.04em;
      margin: 0; display: flex; align-items: center; gap: 8px;
      color: var(--text);
    }
    .title-icon { font-size: 14px; color: #d09c60; opacity: 0.7; }
    .intel-subtitle {
      font-size: 11px; color: var(--text-muted); margin: 3px 0 0;
      font-family: 'JetBrains Mono', monospace; letter-spacing: 0.01em;
    }
    .intel-controls { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

    :host-context([data-theme="light"]) .intel-title { color: var(--text); }
    :host-context([data-theme="light"]) .title-icon { color: #9a5129; opacity: 0.7; }
    :host-context([data-theme="light"]) .intel-subtitle { color: var(--text-muted); }
  `],
})
export class IntelHeaderComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() icon = '';
}
