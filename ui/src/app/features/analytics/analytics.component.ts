import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TabsModule } from 'primeng/tabs';
import { PageInfoComponent } from '../../shared/components/page-info.component';
import { SpotlightComponent } from '../../shared/components/spotlight.component';
import { RelatedPagesComponent } from '../../shared/components/related-pages.component';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [ButtonModule, TagModule, TabsModule, FormsModule, PageInfoComponent, SpotlightComponent, RelatedPagesComponent],
  template: `
    <app-spotlight id="analytics" title="Analytics" icon="pi pi-chart-bar"
      description="DuckDB-powered cluster analytics — cost attribution, usage trends, alerts, and custom SQL queries."
      [capabilities]="['Cost per deployment', 'Usage trends', 'Custom SQL', 'CSV/Parquet export', 'Anomaly alerts']" [compact]="true" />

    <div class="page-header">
      <div>
        <h1>Analytics</h1>
        <p class="subtitle">
          @if (stats) { {{ stats.total_rows?.toLocaleString() }} rows · {{ stats.db_size_mb }}MB · Last: {{ stats.last_collection || '—' }} }
        </p>
      </div>
      <div class="header-actions">
        <button pButton icon="pi pi-database" label="Collect Now" class="p-button-outlined p-button-sm" (click)="collectNow()" [loading]="collecting"></button>
        <button pButton icon="pi pi-refresh" class="p-button-outlined p-button-sm p-button-rounded" (click)="refresh()" [loading]="loading"></button>
        <app-page-info title="Analytics" description="DuckDB-backed analytics engine collecting pod/node metrics every 5 minutes. Supports cost attribution, right-sizing, and custom SQL."
          [tips]="['Auto-collects every 5 min', 'SQL tab for ad-hoc queries', 'Export to CSV or Parquet']"
          [commands]="['analytics', 'collect', 'cost-query', 'sql <query>', 'analytics-export hourly csv']" />
      </div>
    </div>

    @if (loading && !stats) {
      <div class="loading"><div class="spin"></div> Loading analytics...</div>
    }

    @if (stats) {
      <!-- Summary Cards -->
      <div class="summary-grid">
        <div class="summary-card">
          <span class="summary-value">{{ stats.total_rows?.toLocaleString() }}</span>
          <span class="summary-label">Total Rows</span>
        </div>
        <div class="summary-card">
          <span class="summary-value">{{ stats.db_size_mb }}MB</span>
          <span class="summary-label">DB Size</span>
        </div>
        <div class="summary-card">
          <span class="summary-value">{{ stats.collections_today || 0 }}</span>
          <span class="summary-label">Collections Today</span>
        </div>
        <div class="summary-card" [class.warn]="alerts.length > 0">
          <span class="summary-value">{{ alerts.length }}</span>
          <span class="summary-label">Active Alerts</span>
        </div>
      </div>

      <!-- Tabs -->
      <p-tabs [value]="activeTab" (valueChange)="activeTab = '' + $event">
        <p-tablist>
          <p-tab value="0">Cost ({{ costData.length }})</p-tab>
          <p-tab value="1">Alerts ({{ alerts.length }})</p-tab>
          <p-tab value="2">SQL Query</p-tab>
          <p-tab value="3">Export</p-tab>
        </p-tablist>

        <p-tabpanels>
          <!-- Cost Tab -->
          <p-tabpanel value="0">
            @if (costSummary) {
              <div class="cost-summary">
                <span><strong>{{ "$" + costSummary.monthly_usd?.toFixed(2) }}</strong>/mo estimated</span>
                <span>{{ "$" + costSummary.daily_avg_usd?.toFixed(2) }}/day avg</span>
                <span>{{ costSummary.deployments }} deployments</span>
                <span>{{ costSummary.days_tracked }} days tracked</span>
              </div>
            }
            @if (!costData.length) {
              <p class="empty-tab">No cost data yet. Need 24h+ of collection.</p>
            }
            @for (item of costData; track item.deployment) {
              <div class="cost-row">
                <div class="cost-name">
                  <strong>{{ item.deployment }}</strong>
                  <span class="cost-ns">{{ item.namespace }}</span>
                </div>
                <div class="cost-metrics">
                  <span>{{ item.avg_pods }} pods</span>
                  <span>CPU: {{ item.cpu_avg_m }}m avg</span>
                  <span>Mem: {{ item.mem_avg_mb }}Mi avg</span>
                </div>
                <div class="cost-values">
                  <span class="cost-actual">{{ "$" + item.cost_actual_usd?.toFixed(2) }}</span>
                  <span class="cost-requested">{{ "$" + item.cost_requested_usd?.toFixed(2) }} req</span>
                  @if (item.waste_pct > 20) {
                    <p-tag [value]="item.waste_pct + '% waste'" severity="warn" [rounded]="true" size="small" />
                  }
                </div>
              </div>
            }
          </p-tabpanel>

          <!-- Alerts Tab -->
          <p-tabpanel value="1">
            @if (!alerts.length) {
              <p class="empty-tab">No active alerts ✓</p>
            }
            @for (alert of alerts; track alert.message) {
              <div class="alert-row" [class]="'severity-' + alert.severity">
                <i [class]="alert.severity === 'critical' ? 'pi pi-exclamation-circle' : 'pi pi-exclamation-triangle'"></i>
                <div class="alert-content">
                  <strong>{{ alert.title || alert.type }}</strong>
                  <span>{{ alert.message }}</span>
                </div>
                <p-tag [value]="alert.severity" [severity]="alertSeverity(alert.severity)" [rounded]="true" size="small" />
              </div>
            }
          </p-tabpanel>

          <!-- SQL Tab -->
          <p-tabpanel value="2">
            <div class="sql-section">
              <div class="sql-input">
                <textarea [(ngModel)]="sqlQuery" placeholder="SELECT * FROM hourly_pod_metrics LIMIT 10" rows="3"></textarea>
                <button pButton icon="pi pi-play" label="Run" class="p-button-sm" (click)="runQuery()" [loading]="querying"></button>
              </div>
              <div class="sql-hints">
                Tables: raw_pod_metrics, raw_node_metrics, hourly_pod_metrics, daily_summary, cost_model
              </div>
              @if (queryError) {
                <div class="sql-error">{{ queryError }}</div>
              }
              @if (queryResult) {
                <div class="sql-result">
                  <div class="result-header">
                    @for (col of queryResult.columns; track col) {
                      <span class="result-col">{{ col }}</span>
                    }
                  </div>
                  @for (row of queryResult.rows; track $index) {
                    <div class="result-row">
                      @for (col of queryResult.columns; track col) {
                        <span class="result-cell">{{ row[col] }}</span>
                      }
                    </div>
                  }
                  <div class="result-footer">{{ queryResult.count }} rows</div>
                </div>
              }
            </div>
          </p-tabpanel>

          <!-- Export Tab -->
          <p-tabpanel value="3">
            <div class="export-grid">
              @for (q of exportQueries; track q.name) {
                <div class="export-card">
                  <div class="export-info">
                    <strong>{{ q.label }}</strong>
                    <span>{{ q.description }}</span>
                  </div>
                  <div class="export-actions">
                    <button pButton icon="pi pi-file" label="CSV" class="p-button-outlined p-button-sm" (click)="exportData(q.name, 'csv')"></button>
                    <button pButton icon="pi pi-database" label="Parquet" class="p-button-outlined p-button-sm" (click)="exportData(q.name, 'parquet')"></button>
                  </div>
                </div>
              }
            </div>
          </p-tabpanel>
        </p-tabpanels>
      </p-tabs>
    }

    @if (!stats && !loading) {
      <div class="empty-state">
        <i class="pi pi-chart-bar"></i>
        <h3>Analytics Not Initialized</h3>
        <p>Start the API server to begin collecting metrics automatically.</p>
      </div>
    }

    <app-related-pages label="Related" [pages]="relatedPages" />
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .header-actions { display: flex; align-items: center; gap: 8px; }

    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
    .summary-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; text-align: center; }
    .summary-card.warn { border-left: 3px solid var(--warning); }
    .summary-value { display: block; font-size: 28px; font-weight: 800; }
    .summary-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; }

    .cost-summary { display: flex; gap: 20px; font-size: 13px; margin-bottom: 16px; padding: 12px; background: var(--bg-elevated); border-radius: var(--radius); }
    .cost-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 8px; }
    .cost-name { display: flex; flex-direction: column; }
    .cost-name strong { font-size: 13px; }
    .cost-ns { font-size: 11px; color: var(--text-muted); }
    .cost-metrics { display: flex; gap: 12px; font-size: 11px; color: var(--text-muted); }
    .cost-values { display: flex; align-items: center; gap: 10px; font-size: 13px; }
    .cost-actual { font-weight: 700; }
    .cost-requested { color: var(--text-muted); font-size: 11px; }

    .alert-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 8px; }
    .alert-row.severity-critical { border-left: 3px solid var(--danger); }
    .alert-row.severity-warning { border-left: 3px solid var(--warning); }
    .alert-row i { font-size: 18px; }
    .severity-critical i { color: var(--danger); }
    .severity-warning i { color: var(--warning); }
    .alert-content { flex: 1; display: flex; flex-direction: column; }
    .alert-content strong { font-size: 13px; }
    .alert-content span { font-size: 12px; color: var(--text-muted); }

    .sql-section { display: flex; flex-direction: column; gap: 12px; }
    .sql-input { display: flex; gap: 8px; align-items: flex-start; }
    .sql-input textarea { flex: 1; font-family: 'JetBrains Mono', monospace; font-size: 12px; padding: 10px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg-card); color: var(--text-primary); resize: vertical; }
    .sql-hints { font-size: 11px; color: var(--text-muted); }
    .sql-error { color: var(--danger); font-size: 12px; padding: 8px; background: var(--bg-card); border: 1px solid var(--danger); border-radius: var(--radius); }

    .sql-result { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); overflow-x: auto; font-size: 12px; font-family: 'JetBrains Mono', monospace; }
    .result-header, .result-row { display: flex; padding: 6px 12px; gap: 8px; }
    .result-header { font-weight: 600; border-bottom: 1px solid var(--border); background: var(--bg-elevated); font-size: 11px; text-transform: uppercase; }
    .result-row { border-bottom: 1px solid var(--border); }
    .result-row:last-of-type { border-bottom: none; }
    .result-col, .result-cell { min-width: 80px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .result-footer { font-size: 11px; color: var(--text-muted); padding: 6px 12px; border-top: 1px solid var(--border); }

    .export-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
    .export-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; display: flex; justify-content: space-between; align-items: center; }
    .export-info { display: flex; flex-direction: column; }
    .export-info strong { font-size: 13px; }
    .export-info span { font-size: 11px; color: var(--text-muted); }
    .export-actions { display: flex; gap: 6px; }

    .empty-state { text-align: center; padding: 60px 20px; color: var(--text-muted); }
    .empty-state i { font-size: 48px; margin-bottom: 16px; opacity: 0.3; }
    .empty-state h3 { font-size: 18px; margin: 0 0 8px; color: var(--text-primary); }
    .empty-tab { color: var(--text-muted); font-size: 13px; padding: 20px 0; }
    .loading { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 60px; color: var(--text-muted); }
    .spin { width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (max-width: 768px) { .summary-grid { grid-template-columns: repeat(2, 1fr); } .cost-row { flex-direction: column; align-items: flex-start; gap: 8px; } }
  `],
})
export class AnalyticsComponent implements OnInit {
  private http = inject(HttpClient);
  stats: any = null;
  costData: any[] = [];
  costSummary: any = null;
  alerts: any[] = [];
  loading = false;
  collecting = false;
  querying = false;
  activeTab = '0';
  sqlQuery = '';
  queryResult: any = null;
  queryError = '';

  exportQueries = [
    { name: 'raw_pods', label: 'Raw Pod Metrics', description: 'All collected pod CPU/memory samples' },
    { name: 'raw_nodes', label: 'Raw Node Metrics', description: 'All collected node utilization samples' },
    { name: 'hourly', label: 'Hourly Aggregates', description: 'Hourly P50/P95/P99 per deployment' },
    { name: 'daily', label: 'Daily Summary', description: 'Daily cost and usage per deployment' },
    { name: 'cost', label: 'Cost Attribution', description: 'Cost per deployment with waste analysis' },
  ];

  relatedPages = [
    { path: '/rightsizing', icon: 'pi pi-sliders-h', label: 'Right-Sizing', description: 'CPU/memory recommendations from analytics data' },
    { path: '/cost', icon: 'pi pi-dollar', label: 'Optimization', description: 'Resource optimization suggestions' },
    { path: '/cost-estimate', icon: 'pi pi-calculator', label: 'Cost Estimate', description: 'Per-deployment cost breakdown' },
    { path: '/metrics', icon: 'pi pi-chart-line', label: 'Metrics', description: 'Live CPU/memory usage' },
  ];

  ngOnInit() { this.refresh(); }

  refresh() {
    this.loading = true;
    this.http.get<any>('/api/analytics').subscribe({
      next: (res) => { this.stats = res; this.loading = false; },
      error: () => { this.stats = null; this.loading = false; },
    });
    this.http.get<any>('/api/analytics/cost').subscribe({
      next: (res) => { this.costData = res.deployments || []; this.costSummary = res.summary; },
      error: () => {},
    });
    this.http.get<any>('/api/analytics/alerts').subscribe({
      next: (res) => { this.alerts = res.alerts || []; },
      error: () => {},
    });
  }

  collectNow() {
    this.collecting = true;
    this.http.post<any>('/api/analytics/collect', {}).subscribe({
      next: () => { this.collecting = false; this.refresh(); },
      error: () => { this.collecting = false; },
    });
  }

  runQuery() {
    if (!this.sqlQuery.trim()) return;
    this.querying = true;
    this.queryError = '';
    this.queryResult = null;
    this.http.post<any>('/api/analytics/query', { sql: this.sqlQuery }).subscribe({
      next: (res) => {
        if (res.error) { this.queryError = res.error; }
        else { this.queryResult = res; }
        this.querying = false;
      },
      error: (err) => { this.queryError = err.error?.detail || 'Query failed'; this.querying = false; },
    });
  }

  exportData(query: string, fmt: string) {
    this.http.get<any>(`/api/analytics/export/${query}?fmt=${fmt}`).subscribe({
      next: (res) => { alert(`Exported: ${res.path}`); },
      error: () => { alert('Export failed'); },
    });
  }

  alertSeverity(severity: string): "success" | "warn" | "danger" | "info" | "secondary" | "contrast" | undefined {
    if (severity === 'critical') return 'danger';
    if (severity === 'warning') return 'warn';
    return 'info';
  }
}
