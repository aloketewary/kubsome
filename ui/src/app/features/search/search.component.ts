import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { SpotlightComponent } from '../../shared/components/spotlight.component';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CardModule, InputTextModule, TagModule, TableModule, ButtonModule, FormsModule, SpotlightComponent],
  template: `
    <app-spotlight id="search" title="Search" icon="pi pi-search"
      description="Search across all resource types with fuzzy matching."
      [capabilities]="['Cross-resource search', 'Fuzzy matching', 'Quick navigation']" [compact]="true" />

        <div class="header">
      <h2>Search</h2>
    </div>

    <div class="search-bar">
      <span class="p-input-icon-left" style="width: 100%;">
        <i class="pi pi-search"></i>
        <input pInputText [(ngModel)]="query" placeholder="Search pods, deployments, services..." style="width: 100%;"
               (keyup.enter)="doSearch()" />
      </span>
    </div>

    @if (results.length > 0) {
      <p-card styleClass="results-card">
        <p-table [value]="results" [rowHover]="true">
          <ng-template pTemplate="header">
            <tr>
              <th>Kind</th>
              <th>Name</th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-r>
            <tr>
              <td><p-tag [value]="r.kind" severity="info" /></td>
              <td><code class="mono">{{ r.name }}</code></td>
            </tr>
          </ng-template>
        </p-table>
      </p-card>
    } @else if (searched) {
      <p-card styleClass="empty-search-card">
        <div class="empty-search-content">
          <div class="empty-icon"><i class="pi pi-search-minus"></i></div>
          <h3>No results for "{{ lastQuery }}"</h3>
          <p>We couldn't find any resources matching your query in the current namespace. Try broadening your search or use AI for more complex discovery.</p>
          <div class="empty-actions">
            <button pButton label="Ask AI Assistant" icon="pi pi-sparkles" class="p-button-sm p-button-warning"
                    (click)="askAiAboutSearch()"></button>
            <button pButton label="Switch Namespace" icon="pi pi-map-marker" class="p-button-sm p-button-outlined"
                    (click)="router.navigate(['/namespace'])"></button>
          </div>
        </div>
      </p-card>
    }
  `,
  styles: [`
    .header { margin-bottom: 24px; }
    .header h2 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.03em; }
    .search-bar { margin-bottom: 16px; }
    .search-bar :deep(input) { transition: border-color 0.2s, box-shadow 0.2s; }
    .search-bar :deep(input:focus) { box-shadow: 0 0 0 2px var(--accent-subtle); }
    .results-card { margin-top: 16px; }
    .mono { font-family: 'JetBrains Mono', monospace; font-size: 12px; }
    .empty { text-align: center; padding: 48px; color: var(--text-muted); font-size: 13px; }

    .empty-search-card { margin-top: 24px; border: 1px dashed var(--border); }
    .empty-search-content {
      display: flex; flex-direction: column; align-items: center; text-align: center;
      padding: 48px 24px;
    }
    .empty-icon {
      width: 64px; height: 64px; border-radius: 50%;
      background: var(--bg-elevated); color: var(--text-muted);
      display: flex; align-items: center; justify-content: center;
      font-size: 24px; margin-bottom: 16px;
    }
    .empty-search-content h3 { margin: 0 0 8px; font-size: 18px; font-weight: 700; }
    .empty-search-content p { margin: 0 0 24px; color: var(--text-muted); font-size: 14px; max-width: 480px; line-height: 1.5; }
    .empty-actions { display: flex; gap: 12px; }
  `],
})
export class SearchComponent {
  private api = inject(ApiService);
  router = inject(Router);
  query = '';
  lastQuery = '';
  results: any[] = [];
  searched = false;

  doSearch() {
    if (!this.query.trim()) return;
    this.lastQuery = this.query;
    this.api.search(this.query).subscribe(res => {
      this.results = res.results || [];
      this.searched = true;
    });
  }

  askAiAboutSearch() {
    const q = `Where is the resource named "${this.lastQuery}"?`;
    this.router.navigate(['/ai'], { queryParams: { q } });
  }
}
