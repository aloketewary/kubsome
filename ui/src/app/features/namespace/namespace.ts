import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TooltipModule } from 'primeng/tooltip';
import { HoloCardComponent } from '../../shared/components/futuristic/holo-card.component';
import { MetricTileComponent } from '../../shared/components/futuristic/metric-tile.component';
import { StatusBeaconComponent } from '../../shared/components/futuristic/status-beacon.component';
import { CommandBarComponent } from '../../shared/components/futuristic/command-bar.component';
import type { CommandPill } from '../../shared/components/futuristic/command-bar.component';
import { LiveIndicatorComponent } from '../../shared/components/futuristic/live-indicator.component';

interface ResourceItem {
  type: string;
  count: number;
  icon: string;
  color: string;
  route?: string;
}

@Component({
  selector: 'app-namespace',
  standalone: true,
  imports: [FormsModule, TooltipModule, HoloCardComponent, MetricTileComponent, StatusBeaconComponent, CommandBarComponent, LiveIndicatorComponent],
  templateUrl: './namespace.html',
  styleUrl: './namespace.scss',
})
export class NamespaceComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  router = inject(Router);
  data: any = null;
  resourceList: ResourceItem[] = [];
  podStatuses: { status: string; count: number }[] = [];
  resourceSearch = '';
  loading = false;
  autoRefresh = true;
  lastUpdated = '';
  private refreshTimer: any;

  private colorMap: Record<string, string> = {
    pods: '#00d4ff', deployments: '#8b5cf6', services: '#10b981',
    configmaps: '#f59e0b', secrets: '#f43f5e', ingress: '#ec4899',
    jobs: '#06b6d4', cronjobs: '#a78bfa', statefulsets: '#14b8a6', daemonsets: '#f97316',
  };
  private iconMap: Record<string, string> = {
    pods: 'pi pi-box', deployments: 'pi pi-send', services: 'pi pi-globe',
    configmaps: 'pi pi-file', secrets: 'pi pi-lock', ingress: 'pi pi-link',
    jobs: 'pi pi-clock', cronjobs: 'pi pi-history', statefulsets: 'pi pi-database', daemonsets: 'pi pi-server',
  };
  private routeMap: Record<string, string> = {
    pods: '/pods', deployments: '/deployments', services: '/network',
    jobs: '/jobs', cronjobs: '/jobs', ingress: '/network', secrets: '/secrets',
  };

  get totalResources() { return this.resourceList.reduce((s, r) => s + r.count, 0); }
  get totalPods() { return this.podStatuses.reduce((s, p) => s + p.count, 0); }
  get runningPods() { return this.podStatuses.find(s => s.status === 'Running')?.count || 0; }
  get runningPct() { return this.totalPods > 0 ? Math.round((this.runningPods / this.totalPods) * 100) : 0; }
  get pendingPods() { return this.podStatuses.find(s => s.status === 'Pending')?.count || 0; }
  get failedPods() { return this.totalPods - this.runningPods - this.pendingPods; }

  get filterPills(): CommandPill[] {
    return [
      { label: 'All', value: 'all', count: this.resourceList.length },
      ...this.resourceList.slice(0, 4).map(r => ({ label: r.type, value: r.type, count: r.count })),
    ];
  }

  statusFilter = 'all';
  onFilterChange(v: string) { this.statusFilter = v; }
  onSearchChange(v: string) { this.resourceSearch = v; }

  get filteredResources(): ResourceItem[] {
    let result = this.resourceList;
    if (this.statusFilter !== 'all') result = result.filter(r => r.type === this.statusFilter);
    if (this.resourceSearch) { const q = this.resourceSearch.toLowerCase(); result = result.filter(r => r.type.toLowerCase().includes(q)); }
    return result;
  }

  statusBeacon(status: string): 'ok' | 'warning' | 'critical' {
    if (status === 'Running' || status === 'Succeeded') return 'ok';
    if (status === 'Pending') return 'warning';
    return 'critical';
  }

  ngOnInit() { this.load(); this.startAutoRefresh(); }
  ngOnDestroy() { clearInterval(this.refreshTimer); }
  toggleAutoRefresh() { this.autoRefresh = !this.autoRefresh; if (this.autoRefresh) this.startAutoRefresh(); else clearInterval(this.refreshTimer); }
  private startAutoRefresh() { clearInterval(this.refreshTimer); this.refreshTimer = setInterval(() => this.load(), 30000); }

  load() {
    this.loading = true;
    this.http.get<any>('/api/ns-overview').subscribe(res => {
      this.data = res;
      this.resourceList = Object.entries(res.resources || {})
        .map(([type, count]) => ({ type, count: count as number, icon: this.iconMap[type] || 'pi pi-th-large', color: this.colorMap[type] || '#6b7280', route: this.routeMap[type] }))
        .sort((a, b) => b.count - a.count);
      this.podStatuses = Object.entries(res.pod_statuses || {}).map(([status, count]) => ({ status, count: count as number }));
      this.loading = false;
      this.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    });
  }
}
