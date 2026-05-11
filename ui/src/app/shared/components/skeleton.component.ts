import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  template: `
    @switch (variant) {
      @case ('card') {
        <div class="sk-card">
          <div class="sk-line sk-w60"></div>
          <div class="sk-line sk-w40"></div>
          <div class="sk-block"></div>
          <div class="sk-row"><div class="sk-line sk-w30"></div><div class="sk-line sk-w20"></div></div>
        </div>
      }
      @case ('stats') {
        <div class="sk-stats">
          @for (i of [1,2,3,4]; track i) {
            <div class="sk-stat-item"><div class="sk-circle"></div><div class="sk-line sk-w50"></div></div>
          }
        </div>
      }
      @case ('list') {
        <div class="sk-list">
          @for (i of rows; track i) {
            <div class="sk-list-row">
              <div class="sk-dot"></div>
              <div class="sk-line sk-flex"></div>
              <div class="sk-line sk-w20"></div>
            </div>
          }
        </div>
      }
      @case ('table') {
        <div class="sk-table">
          <div class="sk-table-header"><div class="sk-line sk-w30"></div><div class="sk-line sk-w20"></div><div class="sk-line sk-w20"></div></div>
          @for (i of rows; track i) {
            <div class="sk-table-row"><div class="sk-line sk-w40"></div><div class="sk-line sk-w15"></div><div class="sk-line sk-w15"></div></div>
          }
        </div>
      }
    }
  `,
  styles: [`
    :host { display: block; }
    .sk-card, .sk-stats, .sk-list, .sk-table {
      display: flex; flex-direction: column; gap: 10px;
      padding: 16px; background: var(--bg-card); border: 1px solid var(--border);
      border-radius: var(--radius); animation: skPulse 1.5s ease-in-out infinite;
    }
    @keyframes skPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
    .sk-line { height: 10px; border-radius: 4px; background: var(--bg-elevated); }
    .sk-block { height: 48px; border-radius: 8px; background: var(--bg-elevated); }
    .sk-circle { width: 32px; height: 32px; border-radius: 50%; background: var(--bg-elevated); flex-shrink: 0; }
    .sk-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--bg-elevated); flex-shrink: 0; }
    .sk-row { display: flex; gap: 10px; }
    .sk-w15 { width: 15%; }
    .sk-w20 { width: 20%; }
    .sk-w30 { width: 30%; }
    .sk-w40 { width: 40%; }
    .sk-w50 { width: 50%; }
    .sk-w60 { width: 60%; }
    .sk-flex { flex: 1; }
    .sk-stats { flex-direction: row; gap: 12px; padding: 14px 18px; }
    .sk-stat-item { display: flex; align-items: center; gap: 8px; flex: 1; }
    .sk-list { gap: 6px; }
    .sk-list-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; }
    .sk-table { gap: 0; }
    .sk-table-header, .sk-table-row { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
    .sk-table-header .sk-line { height: 8px; opacity: 0.5; }
  `],
})
export class SkeletonComponent {
  @Input() variant: 'card' | 'stats' | 'list' | 'table' = 'card';
  @Input() count = 3;
  get rows() { return Array.from({ length: this.count }, (_, i) => i); }
}
