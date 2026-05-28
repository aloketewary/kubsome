import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ChartModule } from 'primeng/chart';
import { ApiService } from '../../core/services/api.service';
import { PodMetrics, NodeMetrics } from '../../core/models';
import { SpotlightComponent } from '../../shared/components/spotlight.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';

@Component({
  selector: 'app-metrics',
  standalone: true,
  imports: [FormsModule, TagModule, ButtonModule, TooltipModule, ChartModule, SpotlightComponent, SkeletonComponent],
  template: `
    <app-spotlight id="metrics" title="Metrics" icon="pi pi-chart-bar"
      description="CPU and memory usage for pods and nodes."
      [capabilities]="['Pod CPU/memory', 'Node pressure', 'Sortable tables', 'Auto-refresh']" [compact]="true" />

    <div class="page-header">
      <div>
        <h1>Metrics</h1>
        <p class="subtitle">Resource consumption across cluster · {{ lastUpdated || 'Loading...' }}</p>
      </div>
      <div class="header-actions">
        <div class="auto-refresh-toggle">
          <button class="ar-btn" [class.ar-active]="autoRefresh" (click)="toggleAutoRefresh()" [pTooltip]="autoRefresh ? 'Auto-refresh on (30s)' : 'Auto-refresh off'">
            <i class="pi" [class.pi-sync]="autoRefresh" [class.pi-pause]="!autoRefresh"></i>
          </button>
        </div>
        <button pButton icon="pi pi-refresh" class="p-button-outlined p-button-sm p-button-rounded" (click)="refresh()" pTooltip="Refresh" [loading]="loading"></button>
      </div>
    </div>

    <!-- Trend Chart -->
    @if (trendChart) {
      <div class="trend-section">
        <p-chart type="line" [data]="trendChart" [options]="trendOptions" height="180px" />
      </div>
    }

    <!-- Cluster Summary Strip -->
    @if (topNodes.length > 0) {
      <div class="cluster-summary">
        <div class="cs-item">
          <span class="cs-label">Nodes</span>
          <span class="cs-val">{{ topNodes.length }}</span>
        </div>
        <div class="cs-item">
          <span class="cs-label">Avg CPU</span>
          <span class="cs-val" [class.cs-warn]="avgCpu > 50" [class.cs-crit]="avgCpu > 80">{{ avgCpu }}%</span>
        </div>
        <div class="cs-item">
          <span class="cs-label">Avg MEM</span>
          <span class="cs-val" [class.cs-warn]="avgMem > 50" [class.cs-crit]="avgMem > 80">{{ avgMem }}%</span>
        </div>
        <div class="cs-item">
          <span class="cs-label">Pods Tracked</span>
          <span class="cs-val">{{ topPods.length }}</span>
        </div>
      </div>
    }

    <!-- Node Summary Cards -->
    @if (loading && topNodes.length === 0) {
      <app-skeleton variant="card" />
    }
    @if (topNodes.length > 0) {
      <div class="node-summary">
        @for (node of topNodes; track node.name) {
          <div class="node-card" [class.node-hot]="node.cpu_pct_val > 80 || node.mem_pct_val > 80" [pTooltip]="node.name">
            <div class="node-header">
              <i class="pi pi-server"></i>
              <span class="node-name">{{ shortNodeName(node.name) }}</span>
              @if (node.cpu_pct_val > 80 || node.mem_pct_val > 80) {
                <span class="node-hot-badge">HOT</span>
              }
            </div>
            <div class="node-gauges">
              <div class="gauge">
                <div class="gauge-ring">
                  <svg viewBox="0 0 36 36">
                    <path class="gauge-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <path class="gauge-fill" [class]="cpuColor(node.cpu_pct_val)" [attr.stroke-dasharray]="node.cpu_pct_val + ', 100'" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  </svg>
                  <span class="gauge-value">{{ node.cpu_percent }}</span>
                </div>
                <span class="gauge-label">CPU</span>
              </div>
              <div class="gauge">
                <div class="gauge-ring">
                  <svg viewBox="0 0 36 36">
                    <path class="gauge-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <path class="gauge-fill" [class]="memColor(node.mem_pct_val)" [attr.stroke-dasharray]="node.mem_pct_val + ', 100'" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  </svg>
                  <span class="gauge-value">{{ node.memory_percent }}</span>
                </div>
                <span class="gauge-label">MEM</span>
              </div>
            </div>
          </div>
        }
      </div>
    }

    <!-- Pod Resource Table -->
    <div class="pods-section">
      <div class="section-header">
        <h2>Top Pods</h2>
        <div class="section-controls">
          <div class="search-box">
            <i class="pi pi-search"></i>
            <input type="text" [(ngModel)]="searchQuery" (ngModelChange)="filterPods()" placeholder="Filter pods..." />
          </div>
          <div class="sort-toggle">
            <button class="sort-btn" [class.active]="sortBy === 'cpu'" (click)="sortBy = 'cpu'; sortPods()">CPU</button>
            <button class="sort-btn" [class.active]="sortBy === 'memory'" (click)="sortBy = 'memory'; sortPods()">MEM</button>
          </div>
        </div>
      </div>

      @if (loading && sortedPods.length === 0) {
        <app-skeleton variant="table" />
      }

      <div class="pod-list">
        @for (pod of sortedPods; track pod.name; let i = $index) {
          <div class="pod-metric-row" [class.pod-top3]="i < 3" [class.pod-hot]="cpuPct(pod) > 80 || memPct(pod) > 80">
            <span class="pod-rank" [class.rank-gold]="i === 0" [class.rank-silver]="i === 1" [class.rank-bronze]="i === 2">{{ i + 1 }}</span>
            <div class="pod-info">
              <code class="pod-name" [pTooltip]="pod.name">{{ shortName(pod.name) }}</code>
              <div class="pod-bars">
                <div class="bar-row">
                  <span class="bar-label">CPU</span>
                  <div class="bar-track">
                    <div class="bar-fill" [class]="cpuColor(cpuPct(pod))" [style.width.%]="cpuPct(pod)"></div>
                  </div>
                  <span class="bar-value">{{ pod.cpu }}</span>
                </div>
                <div class="bar-row">
                  <span class="bar-label">MEM</span>
                  <div class="bar-track">
                    <div class="bar-fill" [class]="memColor(memPct(pod))" [style.width.%]="memPct(pod)"></div>
                  </div>
                  <span class="bar-value">{{ pod.memory }}</span>
                </div>
              </div>
            </div>
          </div>
        }
        @if (sortedPods.length === 0 && !loading) {
          <div class="empty-state">
            <i class="pi pi-chart-bar"></i>
            <span>{{ searchQuery ? 'No pods match filter' : 'No metrics available' }}</span>
            <span class="empty-hint">{{ searchQuery ? 'Try a different search term' : 'Requires metrics-server to be running' }}</span>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .header-actions { display: flex; align-items: center; gap: 8px; }
    .ar-btn {
      width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--border);
      background: var(--bg-card); color: var(--text-muted); cursor: pointer; transition: all 0.15s;
      display: flex; align-items: center; justify-content: center;
    }
    .ar-btn:hover { border-color: var(--accent); color: var(--accent); }
    .ar-btn.ar-active { border-color: var(--success); color: var(--success); background: var(--success-subtle); }
    .ar-btn.ar-active i { animation: spin 2s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Cluster Summary */
    .cluster-summary {
      display: flex; gap: 16px; margin-bottom: 20px;
      padding: 12px 20px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
    }
    .cs-item { display: flex; flex-direction: column; align-items: center; flex: 1; }
    .cs-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .cs-val { font-size: 18px; font-weight: 700; font-family: 'JetBrains Mono', monospace; }
    .cs-warn { color: var(--warning); }
    .cs-crit { color: var(--danger); }

    /* Node Summary */
    .node-summary {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
      margin-bottom: 28px;
    }
    .node-card {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 18px; transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
    }
    .node-card:hover { border-color: var(--border-hover); transform: translateY(-2px); box-shadow: 0 8px 24px -8px rgba(0,0,0,0.2); }
    .node-hot { border-color: var(--danger); border-left: 3px solid var(--danger); }
    .node-header { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
    .node-header i { font-size: 14px; color: var(--text-muted); }
    .node-name { font-size: 12px; font-weight: 500; flex: 1; word-break: break-all; }
    .node-hot-badge {
      font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px;
      background: var(--danger-subtle); color: var(--danger); letter-spacing: 0.03em;
    }
    .node-gauges { display: flex; justify-content: center; gap: 20px; }
    .gauge { display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .gauge-ring { position: relative; width: 56px; height: 56px; }
    .gauge-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    .gauge-bg { fill: none; stroke: var(--bg-elevated); stroke-width: 3; }
    .gauge-fill { fill: none; stroke-width: 3; stroke-linecap: round; transition: stroke-dasharray 0.5s; }
    .gauge-fill.color-ok { stroke: var(--success); }
    .gauge-fill.color-warn { stroke: var(--warning); }
    .gauge-fill.color-crit { stroke: var(--danger); }
    .gauge-value {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700; font-family: 'JetBrains Mono', monospace;
    }
    .gauge-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }

    /* Pods Section */
    .pods-section {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
      overflow: hidden;
    }
    .section-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 20px; border-bottom: 1px solid var(--border); flex-wrap: wrap; gap: 10px;
    }
    .section-header h2 { font-size: 14px; font-weight: 600; margin: 0; }
    .section-controls { display: flex; align-items: center; gap: 10px; }
    .search-box {
      display: flex; align-items: center; gap: 6px;
      padding: 5px 10px; border: 1px solid var(--border); border-radius: 6px;
      background: var(--bg-elevated); transition: border-color 0.12s;
    }
    .search-box:focus-within { border-color: var(--accent); }
    .search-box i { font-size: 12px; color: var(--text-muted); }
    .search-box input {
      border: none; background: transparent; outline: none; color: var(--text);
      font-size: 12px; width: 120px;
    }
    .sort-toggle { display: flex; gap: 2px; background: var(--bg-elevated); border-radius: 6px; padding: 2px; }
    .sort-btn {
      padding: 4px 12px; border: none; border-radius: 4px;
      font-size: 11px; font-weight: 500; cursor: pointer;
      background: transparent; color: var(--text-muted); transition: all 0.12s;
    }
    .sort-btn.active { background: var(--accent); color: #fff; }
    .sort-btn:hover:not(.active) { color: var(--text); }

    .pod-list { padding: 4px 0; max-height: 600px; overflow-y: auto; }
    .pod-metric-row {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 20px; transition: all 0.15s;
    }
    .pod-metric-row:hover { background: var(--bg-hover); transform: translateX(3px); }
    .pod-top3 { border-left: 2px solid transparent; }
    .pod-hot { background: rgba(239, 68, 68, 0.04); }
    .pod-rank {
      font-size: 11px; font-weight: 600; color: var(--text-muted);
      width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;
      border-radius: 50%; flex-shrink: 0;
    }
    .rank-gold { background: rgba(234, 179, 8, 0.15); color: #ca8a04; }
    .rank-silver { background: rgba(148, 163, 184, 0.15); color: #64748b; }
    .rank-bronze { background: rgba(180, 83, 9, 0.15); color: #b45309; }
    .pod-info { flex: 1; min-width: 0; }
    .pod-name {
      font-size: 12px; display: block; margin-bottom: 6px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .pod-bars { display: flex; flex-direction: column; gap: 4px; }
    .bar-row { display: flex; align-items: center; gap: 8px; }
    .bar-label { font-size: 10px; color: var(--text-muted); width: 28px; text-transform: uppercase; }
    .bar-track { flex: 1; height: 6px; border-radius: 3px; background: var(--bg-elevated); overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 3px; transition: width 0.4s ease; }
    .bar-fill.color-ok { background: var(--success); }
    .bar-fill.color-warn { background: var(--warning); }
    .bar-fill.color-crit { background: var(--danger); }
    .bar-value { font-size: 11px; font-family: 'JetBrains Mono', monospace; color: var(--text-secondary); min-width: 50px; text-align: right; }

    .empty-state {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      padding: 48px; color: var(--text-muted); font-size: 13px;
    }
    .empty-state i { font-size: 28px; opacity: 0.3; }
    .empty-hint { font-size: 11px; opacity: 0.6; }
    .trend-section { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; margin-bottom: 16px; }
    @media (max-width: 768px) {
      .page-header { flex-direction: column; gap: 12px; }
      .header-actions { flex-wrap: wrap; }
      .metrics-grid { grid-template-columns: repeat(2, 1fr); }
    }
  `],
})
export class MetricsComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private http = inject(HttpClient);
  topPods: PodMetrics[] = [];
  topNodes: NodeMetrics[] = [];
  sortedPods: PodMetrics[] = [];
  sortBy: 'cpu' | 'memory' = 'cpu';
  searchQuery = '';
  loading = false;
  autoRefresh = true;
  lastUpdated = '';
  private maxCpu = 1;
  private maxMem = 1;
  private refreshTimer: any;
  trendChart: any = null;
  trendOptions = {
    plugins: { legend: { labels: { color: '#aaa', font: { size: 10 } } } },
    scales: { x: { ticks: { color: '#666', font: { size: 9 }, maxTicksLimit: 12 } }, y: { ticks: { color: '#666' } } },
    elements: { point: { radius: 0 } },
    maintainAspectRatio: false,
  };

  get avgCpu(): number {
    if (!this.topNodes.length) return 0;
    return Math.round(this.topNodes.reduce((s, n) => s + (n.cpu_pct_val || 0), 0) / this.topNodes.length);
  }
  get avgMem(): number {
    if (!this.topNodes.length) return 0;
    return Math.round(this.topNodes.reduce((s, n) => s + (n.mem_pct_val || 0), 0) / this.topNodes.length);
  }

  ngOnInit() {
    this.refresh();
    this.startAutoRefresh();
    this.loadTrend();
  }

  ngOnDestroy() { clearInterval(this.refreshTimer); }

  private loadTrend() {
    this.http.get<any>('/api/analytics/series/cpu-memory?hours=24').subscribe({
      next: (res) => {
        const s = res.series || [];
        if (s.length > 2) {
          this.trendChart = {
            labels: s.map((p: any) => p.ts?.substring(11, 16) || ''),
            datasets: [
              { label: 'CPU (m)', data: s.map((p: any) => p.cpu), borderColor: '#22d3ee', backgroundColor: 'rgba(34,211,238,0.05)', fill: true, tension: 0.3, borderWidth: 1.5 },
              { label: 'Memory (Mi)', data: s.map((p: any) => p.mem), borderColor: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.05)', fill: true, tension: 0.3, borderWidth: 1.5 },
            ],
          };
        }
      },
    });
  }

  toggleAutoRefresh() {
    this.autoRefresh = !this.autoRefresh;
    if (this.autoRefresh) this.startAutoRefresh();
    else clearInterval(this.refreshTimer);
  }

  private startAutoRefresh() {
    clearInterval(this.refreshTimer);
    this.refreshTimer = setInterval(() => this.refresh(), 30000);
  }

  refresh() {
    this.loading = true;
    this.api.getTopPods().subscribe({
      next: res => {
        this.topPods = res.pods;
        this.maxCpu = Math.max(...this.topPods.map(p => p.cpu_millicores), 1);
        this.maxMem = Math.max(...this.topPods.map(p => p.memory_mb), 1);
        this.filterPods();
        this.loading = false;
        this.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      },
      error: () => { this.loading = false; },
    });
    this.api.getTopNodes().subscribe(res => (this.topNodes = res.nodes));
  }

  filterPods() {
    const q = this.searchQuery.toLowerCase();
    const filtered = q ? this.topPods.filter(p => p.name.toLowerCase().includes(q)) : this.topPods;
    this.sortedPods = [...filtered].sort((a, b) =>
      this.sortBy === 'cpu' ? b.cpu_millicores - a.cpu_millicores : b.memory_mb - a.memory_mb
    );
  }

  sortPods() { this.filterPods(); }

  cpuPct(pod: PodMetrics): number { return Math.min(Math.round((pod.cpu_millicores / this.maxCpu) * 100), 100); }
  memPct(pod: PodMetrics): number { return Math.min(Math.round((pod.memory_mb / this.maxMem) * 100), 100); }

  cpuColor(pct: number): string { return (!pct || isNaN(pct)) ? 'color-ok' : pct > 80 ? 'color-crit' : pct > 50 ? 'color-warn' : 'color-ok'; }
  memColor(pct: number): string { return (!pct || isNaN(pct)) ? 'color-ok' : pct > 80 ? 'color-crit' : pct > 50 ? 'color-warn' : 'color-ok'; }

  shortName(name: string): string { return name; }
  shortNodeName(name: string): string { return name; }
}
