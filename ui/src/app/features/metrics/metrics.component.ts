import { Component, inject, OnInit } from '@angular/core';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ApiService } from '../../core/services/api.service';
import { PodMetrics, NodeMetrics } from '../../core/models';

@Component({
  selector: 'app-metrics',
  standalone: true,
  imports: [TagModule, ButtonModule, TooltipModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Metrics</h1>
        <p class="subtitle">Resource consumption across cluster</p>
      </div>
      <button pButton icon="pi pi-refresh" class="p-button-outlined p-button-sm p-button-rounded" (click)="refresh()" pTooltip="Refresh"></button>
    </div>

    <!-- Node Summary Cards -->
    @if (topNodes.length > 0) {
      <div class="node-summary">
        @for (node of topNodes; track node.name) {
          <div class="node-card">
            <div class="node-header">
              <i class="pi pi-server"></i>
              <span class="node-name">{{ node.name }}</span>
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
        <div class="sort-toggle">
          <button class="sort-btn" [class.active]="sortBy === 'cpu'" (click)="sortBy = 'cpu'; sortPods()">CPU</button>
          <button class="sort-btn" [class.active]="sortBy === 'memory'" (click)="sortBy = 'memory'; sortPods()">Memory</button>
        </div>
      </div>

      <div class="pod-list">
        @for (pod of sortedPods; track pod.name; let i = $index) {
          <div class="pod-metric-row">
            <span class="pod-rank">{{ i + 1 }}</span>
            <div class="pod-info">
              <code class="pod-name">{{ shortName(pod.name) }}</code>
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
        @if (sortedPods.length === 0) {
          <div class="empty-state">
            <i class="pi pi-chart-bar"></i>
            <span>No metrics available</span>
            <span class="empty-hint">Requires metrics-server to be running</span>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

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
    .node-header { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
    .node-header i { font-size: 14px; color: var(--text-muted); }
    .node-name { font-size: 12px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
      padding: 14px 20px; border-bottom: 1px solid var(--border);
    }
    .section-header h2 { font-size: 14px; font-weight: 600; margin: 0; }
    .sort-toggle { display: flex; gap: 2px; background: var(--bg-elevated); border-radius: 6px; padding: 2px; }
    .sort-btn {
      padding: 4px 12px; border: none; border-radius: 4px;
      font-size: 11px; font-weight: 500; cursor: pointer;
      background: transparent; color: var(--text-muted); transition: all 0.12s;
    }
    .sort-btn.active { background: var(--accent); color: #fff; }
    .sort-btn:hover:not(.active) { color: var(--text); }

    .pod-list { padding: 4px 0; }
    .pod-metric-row {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 20px; transition: all 0.15s;
    }
    .pod-metric-row:hover { background: var(--bg-hover); transform: translateX(3px); }
    .pod-rank {
      font-size: 11px; font-weight: 600; color: var(--text-muted);
      width: 20px; text-align: center;
    }
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
  `],
})
export class MetricsComponent implements OnInit {
  private api = inject(ApiService);
  topPods: PodMetrics[] = [];
  topNodes: NodeMetrics[] = [];
  sortedPods: PodMetrics[] = [];
  sortBy: 'cpu' | 'memory' = 'cpu';
  private maxCpu = 1;
  private maxMem = 1;

  ngOnInit() { this.refresh(); }

  refresh() {
    this.api.getTopPods().subscribe(res => {
      this.topPods = res.pods;
      this.maxCpu = Math.max(...this.topPods.map(p => p.cpu_millicores), 1);
      this.maxMem = Math.max(...this.topPods.map(p => p.memory_mb), 1);
      this.sortPods();
    });
    this.api.getTopNodes().subscribe(res => (this.topNodes = res.nodes));
  }

  sortPods() {
    this.sortedPods = [...this.topPods].sort((a, b) =>
      this.sortBy === 'cpu' ? b.cpu_millicores - a.cpu_millicores : b.memory_mb - a.memory_mb
    );
  }

  cpuPct(pod: PodMetrics): number { return Math.min(Math.round((pod.cpu_millicores / this.maxCpu) * 100), 100); }
  memPct(pod: PodMetrics): number { return Math.min(Math.round((pod.memory_mb / this.maxMem) * 100), 100); }

  cpuColor(pct: number): string { return (!pct || isNaN(pct)) ? 'color-ok' : pct > 80 ? 'color-crit' : pct > 50 ? 'color-warn' : 'color-ok'; }
  memColor(pct: number): string { return (!pct || isNaN(pct)) ? 'color-ok' : pct > 80 ? 'color-crit' : pct > 50 ? 'color-warn' : 'color-ok'; }

  shortName(name: string): string { return name.length > 45 ? '...' + name.slice(-42) : name; }
}
