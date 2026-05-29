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
  templateUrl: './cost-estimate.html',
  styleUrl: './cost-estimate.scss',
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
