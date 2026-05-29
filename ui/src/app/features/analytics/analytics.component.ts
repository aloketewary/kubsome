import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TabsModule } from 'primeng/tabs';
import { ChartModule } from 'primeng/chart';
import { TooltipModule } from 'primeng/tooltip';
import { PageInfoComponent } from '../../shared/components/page-info.component';
import { SpotlightComponent } from '../../shared/components/spotlight.component';
import { RelatedPagesComponent } from '../../shared/components/related-pages.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [ButtonModule, TagModule, TabsModule, ChartModule, TooltipModule, FormsModule, DecimalPipe, PageInfoComponent, SpotlightComponent, RelatedPagesComponent, SkeletonComponent, PageHeaderComponent],
  template: `
    <app-spotlight id="analytics" title="Analytics" icon="pi pi-chart-bar"
      description="DuckDB-powered cluster analytics — cost attribution, usage trends, alerts, and custom SQL queries."
      [capabilities]="['Time-series charts', 'Cost per deployment', 'Custom SQL', 'CSV/Parquet export', 'Predictive alerts']" [compact]="true" />

    <app-page-header title="Analytics" [subtitle]="stats ? (stats.raw_rows + stats.hourly_rows + stats.daily_rows) + ' rows · ' + stats.db_size_mb + 'MB' : ''">
        <button pButton icon="pi pi-database" label="Collect Now" class="p-button-outlined p-button-sm" (click)="collectNow()" [loading]="collecting"></button>
        <button pButton icon="pi pi-refresh" class="p-button-outlined p-button-sm p-button-rounded" (click)="refresh()" [loading]="loading"></button>
        <app-page-info title="Analytics" description="DuckDB-backed analytics engine. Auto-collects every 5 min."
          [tips]="['Charts tab shows time-series from DuckDB', 'SQL tab for ad-hoc queries', 'Export to CSV or Parquet']"
          [commands]="['analytics', 'collect', 'cost-query', 'predict', 'capacity-plan']" />
    </app-page-header>

    @if (loading && !stats) {
      <div class="loading"><app-skeleton variant="stats" /><app-skeleton variant="card" /></div>
    }

    @if (loadError && !stats) {
      <div class="error-state">
        <i class="pi pi-exclamation-triangle"></i>
        <span>Failed to connect to analytics engine. Is DuckDB installed?</span>
        <button pButton label="Retry" icon="pi pi-refresh" class="p-button-outlined p-button-sm" (click)="refresh()"></button>
      </div>
    }

    @if (stats) {
      <!-- Summary Cards -->
      <div class="summary-grid">
        <div class="summary-card">
          <span class="summary-value">{{ (stats.raw_rows + stats.hourly_rows) | number }}</span>
          <span class="summary-label">Data Points</span>
        </div>
        <div class="summary-card">
          <span class="summary-value">{{ stats.db_size_mb }}MB</span>
          <span class="summary-label">DB Size</span>
        </div>
        <div class="summary-card" [class.warn]="predictions.length > 0">
          <span class="summary-value">{{ predictions.length }}</span>
          <span class="summary-label">Predictions</span>
        </div>
        <div class="summary-card" [class.warn]="alerts.length > 0">
          <span class="summary-value">{{ alerts.length }}</span>
          <span class="summary-label">Alerts</span>
        </div>
      </div>

      <!-- Tabs -->
      <p-tabs [value]="activeTab" (valueChange)="activeTab = '' + $event">
        <p-tablist>
          <p-tab value="0">Charts</p-tab>
          <p-tab value="1">Cost ({{ costData.length }})</p-tab>
          <p-tab value="2">Predictions ({{ predictions.length }})</p-tab>
          <p-tab value="3">SQL Query</p-tab>
          <p-tab value="4">Export</p-tab>
        </p-tablist>

        <p-tabpanels>
          <!-- Charts Tab -->
          <p-tabpanel value="0">
            <div class="charts-grid">
              <div class="chart-card">
                <h4>CPU & Memory (24h)</h4>
                @if (cpuMemChart) {
                  <p-chart type="line" [data]="cpuMemChart" [options]="lineOptions" height="250px" />
                } @else {
                  <p class="empty-tab">No time-series data yet. Wait for collection.</p>
                }
              </div>
              <div class="chart-card">
                <h4>Daily Cost (30d)</h4>
                @if (costChart) {
                  <p-chart type="bar" [data]="costChart" [options]="barOptions" height="250px" />
                } @else {
                  <p class="empty-tab">Need 24h+ of data for cost chart.</p>
                }
              </div>
              <div class="chart-card">
                <h4>Top Consumers (6h)</h4>
                @if (consumersChart) {
                  <p-chart type="bar" [data]="consumersChart" [options]="horizontalBarOptions" height="250px" />
                } @else {
                  <p class="empty-tab">No consumer data yet.</p>
                }
              </div>
              <div class="chart-card">
                <h4>Event Activity (24h)</h4>
                @if (eventChart) {
                  <p-chart type="bar" [data]="eventChart" [options]="barOptions" height="250px" />
                } @else {
                  <p class="empty-tab">No event data yet.</p>
                }
              </div>
            </div>
          </p-tabpanel>

          <!-- Cost Tab -->
          <p-tabpanel value="1">
            @if (costSummary) {
              <div class="cost-summary">
                <span><strong>{{ "$" + costSummary.monthly_usd?.toFixed(2) }}</strong>/mo</span>
                <span>{{ "$" + costSummary.daily_avg_usd?.toFixed(2) }}/day</span>
                <span>{{ costSummary.deployments }} deployments</span>
              </div>
            }
            @for (item of costData; track item.deployment) {
              <div class="cost-row">
                <span class="cost-name"><strong>{{ item.deployment }}</strong> <span class="ns">{{ item.namespace }}</span></span>
                <span class="cost-metrics">{{ item.avg_pods }} pods · CPU {{ item.cpu_avg_m }}m · Mem {{ item.mem_avg_mb }}Mi</span>
                <span class="cost-value">{{ "$" + item.cost_requested_usd?.toFixed(2) }}
                  @if (item.waste_pct > 20) { <span class="waste">({{ item.waste_pct }}% waste)</span> }
                </span>
              </div>
            }
            @if (!costData.length) { <p class="empty-tab">No cost data yet.</p> }
          </p-tabpanel>

          <!-- Predictions Tab -->
          <p-tabpanel value="2">
            @if (!predictions.length) { <p class="empty-tab">No resource exhaustion predicted in next 24h ✓</p> }
            @for (p of predictions; track p.message) {
              <div class="prediction-row" [class]="'sev-' + p.severity">
                <i class="pi pi-exclamation-triangle"></i>
                <div class="pred-content">
                  <strong>{{ p.type }}</strong>
                  <span>{{ p.message }}</span>
                  @if (p.recommendation) { <span class="pred-rec">→ {{ p.recommendation }}</span> }
                </div>
                <div class="pred-meta">
                  @if (p.hours_remaining) { <span>~{{ p.hours_remaining }}h</span> }
                  <span>{{ p.confidence }}%</span>
                </div>
              </div>
            }
          </p-tabpanel>

          <!-- SQL Tab -->
          <p-tabpanel value="3">
            <div class="sql-section">
              <div class="sql-input">
                <textarea [(ngModel)]="sqlQuery" placeholder="SELECT * FROM hourly_pod_metrics LIMIT 10" rows="3"></textarea>
                <button pButton icon="pi pi-play" label="Run" class="p-button-sm" (click)="runQuery()" [loading]="querying"></button>
              </div>
              <div class="sql-hints">Tables: raw_pod_metrics, hourly_pod_metrics, daily_summary, pod_state, event_log, audit_log, command_usage, incidents, cost_model</div>
              @if (queryError) { <div class="sql-error">{{ queryError }}</div> }
              @if (queryResult) {
                <div class="sql-result">
                  <div class="result-header">
                    @for (col of queryResult.columns; track col) { <span>{{ col }}</span> }
                  </div>
                  @for (row of queryResult.rows; track $index) {
                    <div class="result-row">
                      @for (col of queryResult.columns; track col) { <span>{{ row[col] }}</span> }
                    </div>
                  }
                  <div class="result-footer">{{ queryResult.count }} rows</div>
                </div>
              }
            </div>
          </p-tabpanel>

          <!-- Export Tab -->
          <p-tabpanel value="4">
            @if (exportMsg) {
              <div class="export-feedback" [class.export-ok]="exportMsg.startsWith('✓')" [class.export-err]="exportMsg.startsWith('✗')">{{ exportMsg }}</div>
            }
            <div class="export-grid">
              @for (q of exportQueries; track q.name) {
                <div class="export-card">
                  <div><strong>{{ q.label }}</strong><br><span class="export-desc">{{ q.description }}</span></div>
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

    <app-related-pages label="Related" [pages]="relatedPages" />
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
    .page-header h1 { font-size: 24px; font-weight: 700; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .header-actions { display: flex; align-items: center; gap: 8px; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
    .summary-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; text-align: center; transition: all 0.2s ease; }
    .summary-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px -8px rgba(0,0,0,0.15); }
    .summary-card.warn { border-left: 3px solid var(--warning); }
    .summary-value { display: block; font-size: 28px; font-weight: 800; }
    .summary-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; }

    .charts-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .chart-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; transition: border-color 0.2s; }
    .chart-card:hover { border-color: var(--border-hover); }
    .chart-card h4 { font-size: 13px; font-weight: 600; margin: 0 0 12px; }

    .cost-summary { display: flex; gap: 20px; font-size: 13px; margin-bottom: 16px; padding: 12px; background: var(--bg-elevated); border-radius: var(--radius); }
    .cost-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 6px; font-size: 13px; transition: all 0.15s ease; }
    .cost-row:hover { background: var(--bg-hover); border-color: var(--border-hover); }
    .cost-name .ns { font-size: 11px; color: var(--text-muted); }
    .cost-metrics { font-size: 11px; color: var(--text-muted); }
    .cost-value { font-weight: 700; }
    .waste { color: var(--warning); font-size: 11px; font-weight: 400; }

    .prediction-row { display: flex; align-items: flex-start; gap: 12px; padding: 12px 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 8px; transition: all 0.2s ease; }
    .prediction-row:hover { transform: translateY(-1px); box-shadow: 0 4px 12px -4px rgba(0,0,0,0.1); }
    .prediction-row.sev-critical, .prediction-row.sev-high { border-left: 3px solid var(--danger); }
    .prediction-row.sev-medium { border-left: 3px solid var(--warning); }
    .prediction-row i { margin-top: 2px; color: var(--warning); }
    .sev-critical i, .sev-high i { color: var(--danger); }
    .pred-content { flex: 1; display: flex; flex-direction: column; gap: 2px; font-size: 13px; }
    .pred-content strong { font-size: 12px; text-transform: uppercase; color: var(--text-muted); }
    .pred-rec { font-size: 12px; color: var(--accent); }
    .pred-meta { display: flex; flex-direction: column; align-items: flex-end; font-size: 11px; color: var(--text-muted); gap: 2px; }

    .sql-section { display: flex; flex-direction: column; gap: 12px; }
    .sql-input { display: flex; gap: 8px; align-items: flex-start; }
    .sql-input textarea { flex: 1; font-family: 'JetBrains Mono', monospace; font-size: 12px; padding: 10px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg-card); color: var(--text-primary); resize: vertical; }
    .sql-hints { font-size: 11px; color: var(--text-muted); }
    .sql-error { color: var(--danger); font-size: 12px; padding: 8px; background: var(--bg-card); border: 1px solid var(--danger); border-radius: var(--radius); }
    .sql-result { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); overflow-x: auto; font-size: 12px; font-family: 'JetBrains Mono', monospace; }
    .result-header, .result-row { display: flex; padding: 6px 12px; gap: 8px; }
    .result-header { font-weight: 600; border-bottom: 1px solid var(--border); background: var(--bg-elevated); font-size: 11px; }
    .result-row { border-bottom: 1px solid var(--border); }
    .result-header span, .result-row span { min-width: 80px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .result-footer { font-size: 11px; color: var(--text-muted); padding: 6px 12px; }

    .export-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
    .export-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s ease; }
    .export-card:hover { border-color: var(--border-hover); box-shadow: 0 4px 12px -4px rgba(0,0,0,0.08); }
    .export-desc { font-size: 11px; color: var(--text-muted); }
    .export-actions { display: flex; gap: 6px; }
    .export-feedback { padding: 10px 14px; border-radius: var(--radius); font-size: 13px; margin-bottom: 12px; animation: fadeIn 0.2s ease; }
    .export-ok { background: var(--success-subtle); color: var(--success); border: 1px solid var(--success); }
    .export-err { background: var(--danger-subtle); color: var(--danger); border: 1px solid var(--danger); }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .empty-tab { color: var(--text-muted); font-size: 13px; padding: 20px 0; }
    .loading { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 40px; }
    .error-state {
      display: flex; flex-direction: column; align-items: center; gap: 12px;
      padding: 48px; color: var(--text-muted); font-size: 13px;
      background: var(--bg-card); border: 1px solid var(--danger); border-radius: var(--radius);
    }
    .error-state i { font-size: 24px; color: var(--danger); }
    .spin { width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (max-width: 768px) { .summary-grid { grid-template-columns: repeat(2, 1fr); } .charts-grid { grid-template-columns: 1fr; } }
  `],
})
export class AnalyticsComponent implements OnInit {
  private http = inject(HttpClient);
  stats: any = null;
  costData: any[] = [];
  costSummary: any = null;
  alerts: any[] = [];
  predictions: any[] = [];
  loading = false;
  loadError = false;
  collecting = false;
  querying = false;
  activeTab = '0';
  sqlQuery = '';
  queryResult: any = null;
  queryError = '';
  exportMsg = '';

  // Charts
  cpuMemChart: any = null;
  costChart: any = null;
  consumersChart: any = null;
  eventChart: any = null;

  lineOptions: any = {
    plugins: { legend: { labels: { color: '#aaa', font: { size: 11 } } } },
    scales: { x: { ticks: { color: '#666', font: { size: 10 } } }, y: { ticks: { color: '#666' } } },
    maintainAspectRatio: false,
    responsive: true,
  };
  barOptions: any = {
    plugins: { legend: { display: false } },
    scales: { x: { ticks: { color: '#666', font: { size: 10 } } }, y: { beginAtZero: true, ticks: { color: '#666' } } },
    maintainAspectRatio: false,
    responsive: true,
  };
  horizontalBarOptions: any = {
    indexAxis: 'y',
    plugins: { legend: { labels: { color: '#aaa', font: { size: 11 } } } },
    scales: { x: { beginAtZero: true, ticks: { color: '#666' } }, y: { ticks: { color: '#666', font: { size: 10 } } } },
    maintainAspectRatio: false,
    responsive: true,
  };

  exportQueries = [
    { name: 'raw_pods', label: 'Raw Pod Metrics', description: 'All pod CPU/memory samples' },
    { name: 'hourly', label: 'Hourly Aggregates', description: 'Hourly P50/P95/P99 per deployment' },
    { name: 'daily', label: 'Daily Summary', description: 'Daily cost and usage' },
    { name: 'cost', label: 'Cost Attribution', description: 'Cost per deployment' },
  ];

  relatedPages = [
    { path: '/rightsizing', icon: 'pi pi-sliders-h', label: 'Right-Sizing', description: 'CPU/memory recommendations' },
    { path: '/cost-estimate', icon: 'pi pi-calculator', label: 'Cost Estimate', description: 'Per-deployment cost' },
    { path: '/metrics', icon: 'pi pi-chart-line', label: 'Live Metrics', description: 'Real-time usage' },
  ];

  ngOnInit() { this.refresh(); }

  refresh() {
    this.loading = true;
    this.http.get<any>('/api/analytics').subscribe({
      next: (res) => { this.stats = res; this.loading = false; this.loadError = false; },
      error: () => { this.stats = null; this.loading = false; this.loadError = true; },
    });
    this.http.get<any>('/api/analytics/cost').subscribe({
      next: (res) => { this.costData = res.deployments || []; this.costSummary = res.summary; },
    });
    this.http.get<any>('/api/analytics/alerts').subscribe({
      next: (res) => { this.alerts = res.alerts || []; },
    });
    this.http.get<any>('/api/analytics/predictions').subscribe({
      next: (res) => { this.predictions = res.predictions || []; },
    });
    this.loadCharts();
  }

  loadCharts() {
    // CPU/Memory line chart
    this.http.get<any>('/api/analytics/series/cpu-memory?hours=24').subscribe({
      next: (res) => {
        const series = res.series || [];
        if (series.length) {
          this.cpuMemChart = {
            labels: series.map((s: any) => s.ts?.substring(11, 16) || ''),
            datasets: [
              { label: 'CPU (m)', data: series.map((s: any) => s.cpu), borderColor: '#22d3ee', backgroundColor: 'rgba(34,211,238,0.1)', fill: true, tension: 0.3 },
              { label: 'Memory (Mi)', data: series.map((s: any) => s.mem), borderColor: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.1)', fill: true, tension: 0.3 },
            ],
          };
        }
      },
    });

    // Cost bar chart
    this.http.get<any>('/api/analytics/series/cost?days=30').subscribe({
      next: (res) => {
        const series = res.series || [];
        if (series.length > 0) {
          this.costChart = {
            labels: series.map((s: any) => s.day?.substring(5, 10) || ''),
            datasets: [{ label: 'Daily Cost ($)', data: series.map((s: any) => s.cost || 0), backgroundColor: '#22c55e', borderRadius: 3 }],
          };
        }
      },
    });

    // Top consumers
    this.http.get<any>('/api/analytics/series/top-consumers?hours=6').subscribe({
      next: (res) => {
        const consumers = res.consumers || [];
        if (consumers.length) {
          this.consumersChart = {
            labels: consumers.map((c: any) => c.deployment?.substring(0, 20) || ''),
            datasets: [
              { label: 'CPU (m)', data: consumers.map((c: any) => c.cpu_avg || 0), backgroundColor: '#22d3ee', borderRadius: 3 },
              { label: 'Memory (Mi)', data: consumers.map((c: any) => c.mem_avg || 0), backgroundColor: '#a78bfa', borderRadius: 3 },
            ],
          };
        }
      },
    });

    // Event timeline
    this.http.get<any>('/api/analytics/series/events?hours=24').subscribe({
      next: (res) => {
        const series = res.series || [];
        if (series.length) {
          const allHours = [...new Set(series.map((s: any) => s.ts?.substring(11, 13) || ''))].sort();
          const warnings = series.filter((s: any) => s.type === 'Warning');
          const normals = series.filter((s: any) => s.type === 'Normal');
          this.eventChart = {
            labels: allHours,
            datasets: [
              { label: 'Warning', data: allHours.map(h => warnings.find((w: any) => w.ts?.substring(11, 13) === h)?.count || 0), backgroundColor: '#f59e0b', borderRadius: 3 },
              { label: 'Normal', data: allHours.map(h => normals.find((n: any) => n.ts?.substring(11, 13) === h)?.count || 0), backgroundColor: '#6b7280', borderRadius: 3 },
            ],
          };
        }
      },
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
      next: (res) => { if (res.error) this.queryError = res.error; else this.queryResult = res; this.querying = false; },
      error: (err) => { this.queryError = err.error?.detail || 'Query failed'; this.querying = false; },
    });
  }

  exportData(query: string, fmt: string) {
    this.http.get<any>(`/api/analytics/export/${query}?fmt=${fmt}`).subscribe({
      next: (res) => { this.exportMsg = `✓ Exported: ${res.path}`; setTimeout(() => this.exportMsg = '', 5000); },
      error: () => { this.exportMsg = '✗ Export failed'; setTimeout(() => this.exportMsg = '', 5000); },
    });
  }
}
