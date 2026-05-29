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
  templateUrl: './analytics.html',
  styleUrl: './analytics.scss',
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
