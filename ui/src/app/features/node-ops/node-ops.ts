import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { HoloCardComponent } from '../../shared/components/futuristic/holo-card.component';
import { MetricTileComponent } from '../../shared/components/futuristic/metric-tile.component';
import { StatusBeaconComponent } from '../../shared/components/futuristic/status-beacon.component';
import { ActionIconComponent } from '../../shared/components/futuristic/action-icon.component';
import { IntelHeaderComponent } from '../../shared/components/futuristic/intel-header.component';

interface NodeInfo {
  name: string;
  ready: boolean;
  schedulable: boolean;
  pods_count: number;
}

@Component({
  selector: 'app-node-ops',
  standalone: true,
  imports: [IntelHeaderComponent, FormsModule, TagModule, ButtonModule, TooltipModule, HoloCardComponent, MetricTileComponent, StatusBeaconComponent, ActionIconComponent],
  templateUrl: './node-ops.html',
  styleUrl: './node-ops.scss',
})
export class NodeOpsComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  nodes: NodeInfo[] = [];
  apiResources: any[] = [];
  loading = false;
  lastUpdated = '';
  actionMessage = '';
  actionSuccess = false;
  showResources = false;
  resourceFilter = '';

  // Wait form
  waitResource = '';
  waitName = '';
  waitCondition = 'condition=Available';
  waitTimeout = 120;
  waitResult = '';
  waitSuccess = false;

  private refreshTimer: any;

  get schedulableCount() { return this.nodes.filter(n => n.schedulable).length; }
  get cordonedCount() { return this.nodes.filter(n => !n.schedulable).length; }
  get filteredResources() {
    if (!this.resourceFilter) return this.apiResources;
    const q = this.resourceFilter.toLowerCase();
    return this.apiResources.filter(r => r.name.includes(q) || r.kind.toLowerCase().includes(q));
  }

  ngOnInit() { this.load(); this.refreshTimer = setInterval(() => this.load(), 30000); }
  ngOnDestroy() { clearInterval(this.refreshTimer); }

  load() {
    this.loading = true;
    this.http.get<any>('/api/node-ops').subscribe({
      next: (res) => { this.nodes = res.nodes || []; this.loading = false; this.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); },
      error: () => { this.loading = false; }
    });
  }

  cordon(node: string) {
    this.actionMessage = '';
    this.http.post<any>('/api/node-ops/cordon', { node }).subscribe({
      next: (res) => { this.actionSuccess = res.success; this.actionMessage = res.success ? `✓ Cordoned ${node}` : res.message; if (res.success) this.load(); },
      error: (err) => { this.actionSuccess = false; this.actionMessage = err.error?.detail || 'Failed'; }
    });
  }

  uncordon(node: string) {
    this.actionMessage = '';
    this.http.post<any>('/api/node-ops/uncordon', { node }).subscribe({
      next: (res) => { this.actionSuccess = res.success; this.actionMessage = res.success ? `✓ Uncordoned ${node}` : res.message; if (res.success) this.load(); },
      error: (err) => { this.actionSuccess = false; this.actionMessage = err.error?.detail || 'Failed'; }
    });
  }

  drain(node: string) {
    if (!confirm(`⚠ Drain ${node}? This will evict all pods.`)) return;
    this.actionMessage = '';
    this.http.post<any>('/api/node-ops/drain', { node, force: false }).subscribe({
      next: (res) => { this.actionSuccess = res.success; this.actionMessage = res.success ? `✓ Drained ${node}` : res.message; if (res.success) this.load(); },
      error: (err) => { this.actionSuccess = false; this.actionMessage = err.error?.detail || 'Failed'; }
    });
  }

  runWait() {
    if (!this.waitResource || !this.waitName) return;
    this.waitResult = '';
    this.http.post<any>('/api/node-ops/wait', {
      resource: this.waitResource, name: this.waitName,
      condition: this.waitCondition, timeout: this.waitTimeout
    }).subscribe({
      next: (res) => { this.waitSuccess = res.success; this.waitResult = res.message; },
      error: (err) => { this.waitSuccess = false; this.waitResult = err.error?.detail || 'Failed'; }
    });
  }

  loadApiResources() {
    this.showResources = !this.showResources;
    if (this.showResources && this.apiResources.length === 0) {
      this.http.get<any>('/api/node-ops/api-resources').subscribe({
        next: (res) => { this.apiResources = res.resources || []; },
      });
    }
  }

  nodeStatus(node: NodeInfo): 'success' | 'warning' | 'danger' {
    if (!node.ready) return 'danger';
    if (!node.schedulable) return 'warning';
    return 'success';
  }
}
