import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ApiService } from '../../core/services/api.service';
import { OverviewResponse, KubeEvent } from '../../core/models';
import { HoloCardComponent } from '../../shared/components/futuristic/holo-card.component';
import { MetricTileComponent } from '../../shared/components/futuristic/metric-tile.component';
import { StatusBeaconComponent } from '../../shared/components/futuristic/status-beacon.component';
import { LiveIndicatorComponent } from '../../shared/components/futuristic/live-indicator.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [TagModule, ButtonModule, TooltipModule, HoloCardComponent, MetricTileComponent, StatusBeaconComponent, LiveIndicatorComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private http = inject(HttpClient);
  router = inject(Router);
  data: OverviewResponse | null = null;
  recentEvents: KubeEvent[] = [];
  lastUpdated = '';
  refreshing = false;
  private refreshInterval: any;
  uptime: any = null;
  stats: any = null;
  costTrend: any = null;
  activeIncident: any = null;

  get podTotal() { return (this.data?.pods.healthy || 0) + (this.data?.pods.warning || 0) + (this.data?.pods.critical || 0); }
  get nodeTotal() { return (this.data?.nodes.healthy || 0) + (this.data?.nodes.warning || 0); }
  get depTotal() { return (this.data?.deployments.healthy || 0) + (this.data?.deployments.unavailable || 0); }

  get overallHealth(): 'healthy' | 'degraded' | 'critical' {
    if ((this.data?.pods.critical || 0) > 0 || (this.data?.nodes.warning || 0) > 0) return 'critical';
    if ((this.data?.pods.warning || 0) > 0 || (this.data?.deployments.unavailable || 0) > 0) return 'degraded';
    return 'healthy';
  }

  get healthPct(): number {
    const total = this.podTotal + this.nodeTotal + this.depTotal;
    if (total === 0) return 100;
    const healthy = (this.data?.pods.healthy || 0) + (this.data?.nodes.healthy || 0) + (this.data?.deployments.healthy || 0);
    return Math.round((healthy / total) * 100);
  }

  get healthColor(): 'green' | 'amber' | 'red' {
    if (this.overallHealth === 'critical') return 'red';
    if (this.overallHealth === 'degraded') return 'amber';
    return 'green';
  }

  pct(value: number, total: number): number { return total === 0 ? 0 : Math.round((value / total) * 100); }
  goToPods() { this.router.navigate(['/pods']); }

  getReadyNodes(): number { return this.uptime?.nodes?.filter((n: any) => n.ready).length || 0; }
  getMaxUptime(): string {
    if (!this.uptime?.nodes?.length) return '—';
    const max = this.uptime.nodes.reduce((a: any, b: any) => a.uptime_seconds > b.uptime_seconds ? a : b);
    return max.uptime_human || '—';
  }

  refresh() {
    this.refreshing = true;
    this.api.getOverview().subscribe({
      next: (res) => { this.data = res; },
      error: () => { this.data = { pods: { healthy: 0, warning: 0, critical: 0 }, nodes: { healthy: 0, warning: 0 }, deployments: { healthy: 0, unavailable: 0 } } as any; },
    });
    this.api.getEvents(5).subscribe({
      next: (res) => { this.recentEvents = res.events; this.refreshing = false; },
      error: () => { this.recentEvents = []; this.refreshing = false; },
    });
    this.http.get<any>('/api/uptime').subscribe({
      next: (res) => { this.uptime = res; },
      error: () => { this.uptime = { cluster_down: false, day: new Date().toLocaleDateString('en', { weekday: 'long' }) }; },
    });
    this.api.getStats().subscribe({ next: (res) => (this.stats = res), error: () => {} });
    this.api.getCostTrend().subscribe({ next: (res) => (this.costTrend = res), error: () => {} });
    this.api.getIncidentStatus().subscribe({ next: (res) => { this.activeIncident = res.id ? res : null; }, error: () => {} });
    this.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  ngOnInit() { this.refresh(); this.refreshInterval = setInterval(() => this.refresh(), 30000); }
  ngOnDestroy() { clearInterval(this.refreshInterval); }
}
