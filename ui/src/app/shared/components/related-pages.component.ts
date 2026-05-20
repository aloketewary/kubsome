import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface RelatedPage {
  path: string;
  icon: string;
  label: string;
  description: string;
}

@Component({
  selector: 'app-related-pages',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (pages.length) {
      <div class="related-section">
        <span class="related-label">{{ label }}</span>
        <div class="related-grid">
          @for (page of pages; track page.path) {
            <a [routerLink]="page.path" class="related-card">
              <i [class]="page.icon"></i>
              <div class="related-info">
                <strong>{{ page.label }}</strong>
                <span>{{ page.description }}</span>
              </div>
              <i class="pi pi-arrow-right related-arrow"></i>
            </a>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .related-section { margin-top: 32px; padding-top: 20px; border-top: 1px solid var(--border); }
    .related-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 12px; display: block; }
    .related-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }
    .related-card {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 16px; border-radius: var(--radius);
      background: var(--bg-card); border: 1px solid var(--border);
      text-decoration: none; color: var(--text-secondary);
      transition: all 0.2s;
    }
    .related-card:hover { border-color: var(--accent); background: var(--bg-elevated); transform: translateY(-1px); }
    .related-card:hover .related-arrow { opacity: 1; transform: translateX(2px); }
    .related-card > i:first-child { font-size: 16px; color: var(--accent); min-width: 20px; text-align: center; }
    .related-info { flex: 1; display: flex; flex-direction: column; }
    .related-info strong { font-size: 13px; color: var(--text-primary); }
    .related-info span { font-size: 11px; color: var(--text-muted); }
    .related-arrow { font-size: 12px; color: var(--accent); opacity: 0; transition: all 0.2s; }
  `],
})
export class RelatedPagesComponent {
  @Input() pages: RelatedPage[] = [];
  @Input() label = 'Related';
}
