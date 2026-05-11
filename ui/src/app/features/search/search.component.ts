import { Component, inject } from '@angular/core';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { SpotlightComponent } from '../../shared/components/spotlight.component';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CardModule, InputTextModule, TagModule, TableModule, FormsModule, SpotlightComponent],
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
      <p-card>
        <div class="empty">No results for "{{ lastQuery }}"</div>
      </p-card>
    }
  `,
  styles: [`
    .header { margin-bottom: 24px; }
    .header h2 { margin: 0; font-size: 22px; font-weight: 600; }
    .search-bar { margin-bottom: 16px; }
    .results-card { margin-top: 16px; }
    .empty { text-align: center; padding: 32px; opacity: 0.5; }
  `],
})
export class SearchComponent {
  private api = inject(ApiService);
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
}
