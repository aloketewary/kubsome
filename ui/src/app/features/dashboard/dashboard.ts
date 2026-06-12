import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ApiService } from '../../core/services/api.service';
import { OverviewResponse, KubeEvent, Pod } from '../../core/models';
import { HoloCardComponent } from '../../shared/components/futuristic/holo-card.component';
import { MetricTileComponent } from '../../shared/components/futuristic/metric-tile.component';
import { StatusBeaconComponent } from '../../shared/components/futuristic/status-beacon.component';
import { LiveIndicatorComponent } from '../../shared/components/futuristic/live-indicator.component';
import { HealthRingComponent } from '../../shared/components/futuristic/health-ring.component';
import { SlicePipe } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [TagModule, ButtonModule, TooltipModule, HoloCardComponent, MetricTileComponent, StatusBeaconComponent, LiveIndicatorComponent, HealthRingComponent, SlicePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private http = inject(HttpClient);
  router = inject(Router);
  data: OverviewResponse | null = null;
  recentEvents: KubeEvent[] = [];
  problemPods: Pod[] = [];
  lastUpdated = '';
  refreshing = false;
  private refreshInterval: any;
  uptime: any = null;

  get podTotal() { return (this.data?.pods.healthy || 0) + (this.data?.pods.warning || 0) + (this.data?.pods.critical || 0); }
  get nodeTotal() { return (this.data?.nodes.healthy || 0) + (this.data?.nodes.warning || 0); }
  get depTotal() { return (this.data?.deployments.healthy || 0) + (this.data?.deployments.unavailable || 0); }

  get hasProblems(): boolean {
    return (this.data?.pods.critical || 0) > 0
      || (this.data?.nodes.warning || 0) > 0
      || (this.data?.deployments.unavailable || 0) > 0;
  }

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

  /** Top issue — first Warning event, used for incident hero */
  get topIssue(): KubeEvent | null {
    return this.warningEvents[0] || null;
  }

  /** Warning events only */
  get warningEvents(): KubeEvent[] {
    return this.recentEvents.filter(e => e.type === 'Warning');
  }

  /** Normal events */
  get normalEvents(): KubeEvent[] {
    return this.recentEvents.filter(e => e.type !== 'Warning');
  }

  pct(value: number, total: number): number { return total === 0 ? 0 : Math.round((value / total) * 100); }
  goToPods() { this.router.navigate(['/pods']); }

  podSeverity(pod: Pod): 'critical' | 'warning' {
    const crit = ['CrashLoopBackOff', 'Error', 'OOMKilled', 'ImagePullBackOff'];
    return crit.some(s => pod.status.includes(s)) ? 'critical' : 'warning';
  }

  refresh() {
    this.refreshing = true;
    this.api.getOverview().subscribe({
      next: (res) => { this.data = res; },
      error: () => { this.data = { pods: { healthy: 0, warning: 0, critical: 0 }, nodes: { healthy: 0, warning: 0 }, deployments: { healthy: 0, unavailable: 0 } } as any; },
    });
    this.api.getEvents(10).subscribe({
      next: (res) => { this.recentEvents = res.events; this.refreshing = false; },
      error: () => { this.recentEvents = []; this.refreshing = false; },
    });
    this.api.getPods(1, 50).subscribe({
      next: (res) => {
        this.problemPods = res.pods.filter(p =>
          p.status !== 'Running' && p.status !== 'Completed' && p.status !== 'Succeeded'
        ).slice(0, 8);
      },
      error: () => { this.problemPods = []; },
    });
    this.http.get<any>('/api/uptime').subscribe({
      next: (res) => { this.uptime = res; },
      error: () => { this.uptime = null; },
    });
    this.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  ngOnInit() { this.refresh(); this.refreshInterval = setInterval(() => this.refresh(), 30000); }
  ngOnDestroy() { clearInterval(this.refreshInterval); }
}
