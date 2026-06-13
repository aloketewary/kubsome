import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TabsModule } from 'primeng/tabs';
import { ChartModule } from 'primeng/chart';
import { TooltipModule } from 'primeng/tooltip';
import { IntelHeaderComponent } from '../../shared/components/futuristic/intel-header.component';
import { MetricTileComponent } from '../../shared/components/futuristic/metric-tile.component';
import { RelatedPagesComponent } from '../../shared/components/related-pages.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { AnalyticsOverview } from './analytics.models';


@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [
    ButtonModule, TagModule, TabsModule, ChartModule, TooltipModule,
    FormsModule, DecimalPipe, IntelHeaderComponent, MetricTileComponent,
    RelatedPagesComponent, SkeletonComponent,
  ],
  templateUrl: './analytics.html',
  styleUrl: './analytics.scss',
})
export class AnalyticsComponent implements OnInit {
  private http = inject(HttpClient);

  overview: AnalyticsOverview | null = null;
  loading = false;
  loadError = false;
  activeTab = '0';

  // Resources tab charts
  cpuMemChart: any = null;
  consumersChart: any = null;

  // Cost tab
  costData: any[] = [];
  costSummary: any = null;

  // Investigate tab
  querying = false;
  sqlQuery = '';
  queryResult: any = null;
  queryError = '';
  exportMsg = '';

  lineOptions: any = {
    plugins: { legend: { labels: { color: '#aaa', font: { size: 11 } } } },
    scales: { x: { ticks: { color: '#666', font: { size: 10 } } }, y: { ticks: { color: '#666' } } },
    maintainAspectRatio: false,
    responsive: true,
  };
  horizontalBarOptions: any = {
    indexAxis: 'y' as const,
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
    this.http.get<AnalyticsOverview>('/api/analytics/overview').subscribe({
      next: (res) => {
        this.overview = res;
        this.loading = false;
        this.loadError = false;
      },
      error: () => {
        this.overview = null;
        this.loading = false;
        this.loadError = true;
      },
    });
  }

  onTabChange(tab: string) {
    this.activeTab = tab;
    if (tab === '1' && !this.cpuMemChart) this.loadResourcesCharts();
    if (tab === '2' && !this.costData.length) this.loadCostData();
  }

  // --- Resources tab ---
  loadResourcesCharts() {
    this.http.get<any>('/api/analytics/series/cpu-memory?hours=24').subscribe({
      next: (res) => {
        const series = res.series || [];
        if (series.length) {
          this.cpuMemChart = {
            labels: series.map((s: any) => s.ts?.substring(11, 16) || ''),
            datasets: [
              { label: 'CPU (m)', data: series.map((s: any) => s.cpu), borderColor: '#d09c60', backgroundColor: 'rgba(208,156,96,0.1)', fill: true, tension: 0.3 },
              { label: 'Memory (Mi)', data: series.map((s: any) => s.mem), borderColor: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.1)', fill: true, tension: 0.3 },
            ],
          };
        }
      },
    });
    this.http.get<any>('/api/analytics/series/top-consumers?hours=6').subscribe({
      next: (res) => {
        const consumers = res.consumers || [];
        if (consumers.length) {
          this.consumersChart = {
            labels: consumers.map((c: any) => c.deployment?.substring(0, 20) || ''),
            datasets: [
              { label: 'CPU (m)', data: consumers.map((c: any) => c.cpu_avg || 0), backgroundColor: '#d09c60', borderRadius: 3 },
              { label: 'Memory (Mi)', data: consumers.map((c: any) => c.mem_avg || 0), backgroundColor: '#a78bfa', borderRadius: 3 },
            ],
          };
        }
      },
    });
  }

  // --- Cost tab ---
  loadCostData() {
    this.http.get<any>('/api/analytics/cost').subscribe({
      next: (res) => { this.costData = res.deployments || []; this.costSummary = res.summary; },
    });
  }

  // --- Investigate tab ---
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

  // --- Helpers ---
  get freshnessLabel(): string {
    if (!this.overview) return '';
    const s = this.overview.data_freshness_seconds;
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.round(s / 60)}m ago`;
    return `${Math.round(s / 3600)}h ago`;
  }

  heroHealthAccent(): 'green' | 'amber' | 'red' {
    if (!this.overview) return 'green';
    if (this.overview.health_score >= 80) return 'green';
    if (this.overview.health_score >= 60) return 'amber';
    return 'red';
  }

  heroCostDelta(): string {
    if (!this.overview) return '$0';
    const d = this.overview.cost_delta_monthly;
    return d >= 0 ? `+$${d.toFixed(0)}` : `-$${Math.abs(d).toFixed(0)}`;
  }

  heroCostTrend(): 'up' | 'down' {
    return (this.overview?.cost_delta_monthly ?? 0) >= 0 ? 'up' : 'down';
  }

  heroRiskAccent(): 'green' | 'amber' | 'red' {
    const sev = this.overview?.highest_risk_severity;
    if (sev === 'critical') return 'red';
    if (sev === 'high') return 'amber';
    if (sev === 'medium') return 'amber';
    return 'green';
  }
}
