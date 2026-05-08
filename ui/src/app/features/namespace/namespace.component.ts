import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TagModule } from 'primeng/tag';

@Component({
  selector: 'app-namespace',
  standalone: true,
  imports: [TagModule],
  template: `
    <div class="page-header">
      <h1>Namespace Overview</h1>
      <p class="subtitle">{{ data?.namespace || '...' }}</p>
    </div>

    @if (data) {
      <div class="resource-grid">
        @for (item of resourceList; track item.type) {
          <div class="resource-card">
            <span class="resource-count">{{ item.count }}</span>
            <span class="resource-type">{{ item.type }}</span>
          </div>
        }
      </div>

      @if (podStatuses.length > 0) {
        <h3 class="section-title">Pod Status Breakdown</h3>
        <div class="status-row">
          @for (s of podStatuses; track s.status) {
            <p-tag [value]="s.status + ': ' + s.count" [severity]="s.status === 'Running' ? 'success' : s.status === 'Pending' ? 'warn' : 'danger'" />
          }
        </div>
      }
    }
  `,
  styles: [`
    .page-header { margin-bottom: 24px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .resource-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 12px;
      margin-bottom: 32px;
    }
    .resource-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 16px;
      text-align: center;
      transition: border-color 0.15s;
    }
    .resource-card:hover { border-color: var(--border-hover); }
    .resource-count { display: block; font-size: 28px; font-weight: 700; letter-spacing: -0.03em; }
    .resource-type { display: block; font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; }
    .section-title { font-size: 14px; font-weight: 600; color: var(--text-secondary); margin-bottom: 12px; }
    .status-row { display: flex; gap: 8px; flex-wrap: wrap; }
  `],
})
export class NamespaceComponent implements OnInit {
  private http = inject(HttpClient);
  data: any = null;
  resourceList: { type: string; count: number }[] = [];
  podStatuses: { status: string; count: number }[] = [];

  ngOnInit() {
    this.http.get<any>('http://localhost:8000/api/ns-overview').subscribe(res => {
      this.data = res;
      this.resourceList = Object.entries(res.resources || {}).map(([type, count]) => ({ type, count: count as number }));
      this.podStatuses = Object.entries(res.pod_statuses || {}).map(([status, count]) => ({ status, count: count as number }));
    });
  }
}
