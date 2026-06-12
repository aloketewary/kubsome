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
import { HealthRingComponent } from '../../shared/components/futuristic/health-ring.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [TagModule, ButtonModule, TooltipModule, HoloCardComponent, MetricTileComponent, StatusBeaconComponent, LiveIndicatorComponent, HealthRingComponent],
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
  diffTimeline: any = null;
  proTip: any = null;

  readonly SAVED_PER_CMD = 2;
  readonly SAVED_PER_FIX = 15;

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

  get hoursSaved(): number {
    if (!this.stats) return 0;
    const mins = ((this.stats.total_commands - this.stats.unresolved_count) * this.SAVED_PER_CMD) + (this.stats.auto_remediations * this.SAVED_PER_FIX);
    return Math.floor(mins / 60);
  }

  pickProTip() {
    const tips = [
      { id: 'scorecard', title: 'Check your Scorecard', text: 'See how your cluster stacks up against best practices.', icon: 'pi pi-trophy', link: '/scorecard' },
      { id: 'security', title: 'Run Security Scan', text: 'Identify vulnerabilities and misconfigurations in seconds.', icon: 'pi pi-shield', link: '/ai', query: 'run security scan' },
      { id: 'optimize', title: 'Optimize Costs', text: 'Find idle resources and rightsize your deployments.', icon: 'pi pi-dollar', link: '/cost' }
    ];
    // Simple heuristic: suggest something not in top_commands
    const used = this.stats?.top_commands?.map((c: any) => c[0]) || [];
    const suggestion = tips.find(t => !used.includes(t.id)) || tips[0];
    this.proTip = suggestion;
  }

  getActivitySummary(): string {
    if (!this.diffTimeline || !this.diffTimeline.summary) return '';
    const s = this.diffTimeline.summary;
    const parts = [];
    if (s.restarts > 0) parts.push(`${s.restarts} restarts`);
    if (s.deployments > 0) parts.push(`${s.deployments} deployments`);
    return parts.length ? parts.join(' and ') + ' in last 24h' : 'Quiet last 24h';
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
    this.api.getStats().subscribe({ next: (res) => { this.stats = res; this.pickProTip(); }, error: () => {} });
    this.api.getCostTrend().subscribe({ next: (res) => (this.costTrend = res), error: () => {} });
    this.api.getIncidentStatus().subscribe({ next: (res) => { this.activeIncident = res.id ? res : null; }, error: () => {} });
    this.api.getDiffTimeline(24).subscribe({ next: (res) => (this.diffTimeline = res), error: () => {} });
    this.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  ngOnInit() { this.refresh(); this.refreshInterval = setInterval(() => this.refresh(), 30000); }
  ngOnDestroy() { clearInterval(this.refreshInterval); }
}
