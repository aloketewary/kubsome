import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ApiService } from '../../core/services/api.service';
import { PodMetrics, NodeMetrics } from '../../core/models';
import type { NodePod } from '../../core/models';
import { HoloCardComponent } from '../../shared/components/futuristic/holo-card.component';
import { MetricTileComponent } from '../../shared/components/futuristic/metric-tile.component';
import { CommandBarComponent } from '../../shared/components/futuristic/command-bar.component';
import type { CommandPill } from '../../shared/components/futuristic/command-bar.component';
import { LiveIndicatorComponent } from '../../shared/components/futuristic/live-indicator.component';
import { StatusBeaconComponent } from '../../shared/components/futuristic/status-beacon.component';

@Component({
  selector: 'app-metrics',
  standalone: true,
  imports: [
    FormsModule, TagModule, ButtonModule, TooltipModule,
    HoloCardComponent, MetricTileComponent, CommandBarComponent,
    LiveIndicatorComponent, StatusBeaconComponent,
  ],
  templateUrl: './metrics.html',
  styleUrl: './metrics.scss',
})
export class MetricsComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private http = inject(HttpClient);

  topPods: PodMetrics[] = [];
  topNodes: NodeMetrics[] = [];
  sortedPods: PodMetrics[] = [];
  nodeWorkloads: { [nodeName: string]: NodePod[] } = {};
  expandedNode = '';
  sortBy: 'cpu' | 'memory' = 'cpu';
  searchQuery = '';
  loading = false;
  autoRefresh = true;
  lastUpdated = '';
  private maxCpu = 1;
  private maxMem = 1;
  private refreshTimer: any;

  get avgCpu(): number {
    if (!this.topNodes.length) return 0;
    return Math.round(this.topNodes.reduce((s, n) => s + (n.cpu_pct_val || 0), 0) / this.topNodes.length);
  }
  get avgMem(): number {
    if (!this.topNodes.length) return 0;
    return Math.round(this.topNodes.reduce((s, n) => s + (n.mem_pct_val || 0), 0) / this.topNodes.length);
  }

  get filterPills(): CommandPill[] {
    return [
      { label: 'CPU', value: 'cpu', color: 'cyan' },
      { label: 'Memory', value: 'memory', color: 'purple' },
    ];
  }

  onSortChange(value: string) {
    this.sortBy = value as 'cpu' | 'memory';
    this.sortPods();
  }

  onSearchChange(value: string) {
    this.searchQuery = value;
    this.filterPods();
  }

  ngOnInit() { this.refresh(); this.startAutoRefresh(); }
  ngOnDestroy() { clearInterval(this.refreshTimer); }

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
    this.api.getNodeWorkloads().subscribe({
      next: res => { this.nodeWorkloads = res.nodes || {}; },
      error: () => {},
    });
  }

  toggleNode(name: string) {
    this.expandedNode = this.expandedNode === name ? '' : name;
  }

  getNodePods(name: string): NodePod[] {
    return this.nodeWorkloads[name] || [];
  }

  getNodeDeployments(name: string): string[] {
    const pods = this.getNodePods(name);
    const deps = new Set(pods.map(p => p.deployment).filter(d => !!d));
    return [...deps];
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
  cpuColor(pct: number): string { return (!pct || isNaN(pct)) ? 'bar-ok' : pct > 80 ? 'bar-crit' : pct > 50 ? 'bar-warn' : 'bar-ok'; }
  memColor(pct: number): string { return (!pct || isNaN(pct)) ? 'bar-ok' : pct > 80 ? 'bar-crit' : pct > 50 ? 'bar-warn' : 'bar-ok'; }

  nodeStatus(node: NodeMetrics): 'ok' | 'warning' | 'critical' {
    if (node.cpu_pct_val > 80 || node.mem_pct_val > 80) return 'critical';
    if (node.cpu_pct_val > 50 || node.mem_pct_val > 50) return 'warning';
    return 'ok';
  }
}
