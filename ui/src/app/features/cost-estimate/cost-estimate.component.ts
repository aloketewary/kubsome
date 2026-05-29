import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { PageInfoComponent } from '../../shared/components/page-info.component';
import { SpotlightComponent } from '../../shared/components/spotlight.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { TrendChartComponent } from '../../shared/components/trend-chart.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';

@Component({
  selector: 'app-cost-estimate',
  standalone: true,
  imports: [ButtonModule, TooltipModule, FormsModule, InputTextModule, PageInfoComponent, SpotlightComponent, TrendChartComponent, PageHeaderComponent, SkeletonComponent],
  template: `
    <app-spotlight id="cost-estimate" title="Cost Estimation" icon="pi pi-dollar"
      description="Estimated monthly spend per deployment based on resource requests."
      [capabilities]="['Per-deployment cost', 'CPU/memory pricing', 'Right-sizing tips']" [compact]="true" />

    <app-page-header title="Cost Estimation" [subtitle]="'Estimated monthly spend based on resource requests · ' + lastUpdated">
        <div class="search-wrap">
          <i class="pi pi-search"></i>
          <input pInputText [(ngModel)]="searchQuery" placeholder="Filter deployments..." (ngModelChange)="applyFilter()" />
        </div>
        <button pButton icon="pi pi-download" label="Export" class="p-button-outlined p-button-sm" (click)="exportCsv()" [disabled]="!data?.deployments?.length" pTooltip="Export CSV"></button>
        <button pButton icon="pi pi-refresh" class="p-button-outlined p-button-sm p-button-rounded" (click)="refresh()" [loading]="loading"></button>
        <app-page-info title="Cost Estimation" description="Estimated monthly spend per deployment based on CPU and memory resource requests."
          [tips]="['Based on AWS on-demand pricing (~$30/vCPU, ~$4/GB)', 'Sorted by highest cost first', 'Reduce cost by right-sizing: optimize command']"
          [commands]="['cost-estimate', 'optimize', 'top pods']" />
    </app-page-header>

    @if (data) {
      <!-- Cost Trend Chart (auto-hides if no DuckDB data) -->
      <app-trend-chart
        endpoint="/api/analytics/series/cost?days=30"
        title="Monthly Cost Trend"
        chartType="bar"
        height="150px"
        labelField="day"
        [labelSlice]="[5, 10]"
        [datasets]="[{label: 'Daily Cost ($)', field: 'cost', color: '#22c55e', fill: false}]" />

      <!-- Total Banner -->
      <div class="total-banner">
        <div class="total-amount">\${{ data.total.toFixed(2) }}</div>
        <div class="total-label">estimated / month</div>
        <div class="total-note">{{ filteredDeployments.length }} deployments · {{ data.pricing.note }}</div>
      </div>

      <!-- Cost Trend -->
      @if (trend) {
        <div class="trend-card">
          <div class="trend-row">
            <div class="trend-item">
              <span class="trend-label">Current</span>
              <span class="trend-val">\${{ trend.current_monthly.toFixed(0) }}/mo</span>
            </div>
            <div class="trend-arrow">
              <i class="pi" [class.pi-arrow-up]="trend.trend === 'growing'" [class.pi-arrow-right]="trend.trend === 'stable'" [class.pi-arrow-down]="trend.trend === 'shrinking'"
                [class.trend-up]="trend.trend === 'growing'" [class.trend-stable]="trend.trend === 'stable'" [class.trend-down]="trend.trend === 'shrinking'"></i>
            </div>
            <div class="trend-item">
              <span class="trend-label">Projected</span>
              <span class="trend-val">\${{ trend.projected_monthly.toFixed(0) }}/mo</span>
            </div>
            <div class="trend-item trend-savings">
              <span class="trend-label">Savings Possible</span>
              <span class="trend-val savings-green">\${{ trend.savings_opportunity.toFixed(0) }}/mo</span>
            </div>
          </div>
          <div class="trend-note">{{ trend.note }}</div>
        </div>
      }

      <!-- Cost Bar Chart -->
      @if (filteredDeployments.length > 0) {
        <div class="cost-chart-card">
          <div class="cost-chart-header">
            <span class="cost-chart-title">Cost Distribution</span>
            <span class="cost-chart-badge">Top {{ Math.min(filteredDeployments.length, 10) }}</span>
          </div>
          <div class="cost-bars">
            @for (dep of filteredDeployments.slice(0, 10); track dep.name) {
              <div class="cost-bar-row">
                <span class="cb-name" [pTooltip]="dep.name">{{ shortName(dep.name) }}</span>
                <div class="cb-track">
                  <div class="cb-fill" [style.width.%]="costPct(dep.cost_total)" [class.cb-high]="dep.cost_total > data.total * 0.3" [class.cb-med]="dep.cost_total > data.total * 0.15 && dep.cost_total <= data.total * 0.3"></div>
                </div>
                <span class="cb-value">\${{ dep.cost_total.toFixed(0) }}</span>
              </div>
            }
          </div>
        </div>
      }

      <!-- Table -->
      <div class="cost-table">
        <div class="table-header">
          <span class="col-name">Deployment</span>
          <span class="col-rep">Replicas</span>
          <span class="col-cpu">CPU</span>
          <span class="col-mem">Memory</span>
          <span class="col-cost">$/pod</span>
          <span class="col-total">$/month</span>
        </div>
        @for (dep of filteredDeployments; track dep.name) {
          <div class="table-row">
            <span class="col-name mono">{{ dep.name }}</span>
            <span class="col-rep">{{ dep.replicas }}</span>
            <span class="col-cpu">{{ dep.cpu_request }}</span>
            <span class="col-mem">{{ dep.memory_request }}</span>
            <span class="col-cost">\${{ dep.cost_per_pod.toFixed(2) }}</span>
            <span class="col-total bold">\${{ dep.cost_total.toFixed(2) }}</span>
          </div>
        }
        @if (filteredDeployments.length === 0) {
          <div class="empty">{{ searchQuery ? 'No deployments matching "' + searchQuery + '"' : 'No deployments with resource requests' }}</div>
        }
      </div>
    } @else if (loading) {
      <app-skeleton variant="stats" />
      <app-skeleton variant="table" [count]="6" />
    } @else {
      <div class="empty-state">
        <i class="pi pi-dollar"></i>
        <h3>No Cost Data</h3>
        <p>Unable to calculate costs. Check cluster connectivity.</p>
        <button pButton label="Retry" icon="pi pi-refresh" class="p-button-outlined p-button-sm" (click)="refresh()"></button>
      </div>
    }
  `,
  styles: [`
    .search-wrap { position: relative; }
    .search-wrap i { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 12px; }
    .search-wrap input { padding-left: 30px !important; width: 180px; }
    .empty-state { text-align: center; padding: 60px 20px; color: var(--text-muted); }
    .empty-state i { font-size: 48px; opacity: 0.3; margin-bottom: 16px; }
    .empty-state h3 { margin: 8px 0 0; }
    .empty-state p { margin: 4px 0 16px; font-size: 13px; }
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

    .total-banner {
      text-align: center; padding: 28px; margin-bottom: 20px;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
    }
    .total-amount { font-size: 42px; font-weight: 800; letter-spacing: -0.04em; color: var(--accent); }
    .total-label { font-size: 14px; color: var(--text-secondary); margin-top: 4px; }
    .total-note { font-size: 11px; color: var(--text-muted); margin-top: 8px; }

    /* Cost Trend */
    .trend-card {
      padding: 16px 20px; margin-bottom: 20px;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
    }
    .trend-row { display: flex; align-items: center; gap: 20px; }
    .trend-item { text-align: center; }
    .trend-label { display: block; font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px; }
    .trend-val { font-size: 16px; font-weight: 700; font-family: 'JetBrains Mono', monospace; }
    .trend-arrow { font-size: 18px; }
    .trend-up { color: var(--danger); }
    .trend-stable { color: var(--success); }
    .trend-down { color: var(--accent); }
    .trend-savings { margin-left: auto; }
    .savings-green { color: var(--success); }
    .trend-note { font-size: 11px; color: var(--text-muted); margin-top: 10px; }

    /* Cost Bar Chart */
    .cost-chart-card {
      padding: 18px; margin-bottom: 20px;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
    }
    .cost-chart-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .cost-chart-title { font-size: 13px; font-weight: 600; color: var(--text-secondary); }
    .cost-chart-badge { font-size: 10px; font-weight: 600; padding: 3px 10px; border-radius: 20px; background: var(--accent-subtle); color: var(--accent); }
    .cost-bars { display: flex; flex-direction: column; gap: 8px; }
    .cost-bar-row { display: flex; align-items: center; gap: 10px; }
    .cb-name { font-size: 11px; font-family: 'JetBrains Mono', monospace; color: var(--text-secondary); flex-shrink: 0; }
    .cb-track { flex: 1; height: 20px; border-radius: 4px; background: var(--bg-elevated); overflow: hidden; }
    .cb-fill { height: 100%; border-radius: 4px; background: var(--accent); opacity: 0.7; transition: width 0.5s cubic-bezier(0.4,0,0.2,1); }
    .cb-fill.cb-high { background: var(--danger); opacity: 0.8; }
    .cb-fill.cb-med { background: var(--warning); opacity: 0.75; }
    .cb-value { font-size: 11px; font-weight: 600; font-family: 'JetBrains Mono', monospace; min-width: 40px; text-align: right; }

    .cost-table { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
    .table-header {
      display: grid; grid-template-columns: 2fr 0.5fr 0.7fr 0.7fr 0.7fr 0.8fr;
      padding: 10px 16px; background: var(--bg-elevated); border-bottom: 1px solid var(--border);
      font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em;
    }
    .table-row {
      display: grid; grid-template-columns: 2fr 0.5fr 0.7fr 0.7fr 0.7fr 0.8fr;
      padding: 10px 16px; border-bottom: 1px solid var(--border); font-size: 12px; align-items: center;
      transition: background 0.1s;
    }
    .table-row:last-child { border-bottom: none; }
    .table-row:hover { background: var(--bg-hover); }
    .mono { font-family: 'JetBrains Mono', monospace; font-size: 11px; }
    .bold { font-weight: 600; }
    .col-cost, .col-total { text-align: right; }
    .col-rep, .col-cpu, .col-mem { text-align: center; }
    .empty { padding: 40px; text-align: center; color: var(--text-muted); font-size: 13px; }
    .loading { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 60px; color: var(--text-muted); }
    .spin { width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (max-width: 768px) {
      .table-header, .table-row { grid-template-columns: 2fr 0.5fr 1fr 1fr; }
      .col-cpu, .col-mem { display: none; }
      .trend-row { flex-wrap: wrap; gap: 12px; }
      .cost-bars { display: none; }
    }
  `],
})
export class CostEstimateComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  data: any = null;
  trend: any = null;
  Math = Math;
  loading = false;
  lastUpdated = '';
  searchQuery = '';
  filteredDeployments: any[] = [];
  private timer: any;

  ngOnInit() { this.refresh(); this.timer = setInterval(() => this.refresh(), 60000); }
  ngOnDestroy() { clearInterval(this.timer); }

  applyFilter() {
    const deps = this.data?.deployments || [];
    if (!this.searchQuery) { this.filteredDeployments = deps; return; }
    const q = this.searchQuery.toLowerCase();
    this.filteredDeployments = deps.filter((d: any) => d.name.toLowerCase().includes(q));
  }

  refresh() {
    this.loading = true;
    this.http.get<any>('/api/cost-estimate').subscribe({
      next: (res) => {
        this.data = res;
        this.loading = false;
        this.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        this.applyFilter();
      },
      error: () => { this.data = null; this.loading = false; },
    });
    this.http.get<any>('/api/cost-trend').subscribe({
      next: (res) => { this.trend = res; },
      error: () => {},
    });
  }

  exportCsv() {
    if (!this.data?.deployments?.length) return;
    const header = 'Deployment,Replicas,CPU,Memory,Cost/Pod,Cost/Month';
    const rows = this.data.deployments.map((d: any) =>
      `${d.name},${d.replicas},${d.cpu_request},${d.memory_request},${d.cost_per_pod.toFixed(2)},${d.cost_total.toFixed(2)}`);
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'cost-estimate.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  costPct(cost: number): number {
    if (!this.data || this.data.total === 0) return 0;
    return Math.min(Math.round((cost / this.data.total) * 100), 100);
  }

  shortName(name: string): string {
    return name;
  }
}
