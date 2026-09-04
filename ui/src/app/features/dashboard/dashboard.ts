import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { catchError, forkJoin, of } from 'rxjs';
import { TooltipModule } from 'primeng/tooltip';
import { ApiService } from '../../core/services/api.service';
import { OverviewResponse, KubeEvent, Pod } from '../../core/models';
import { SlicePipe } from '@angular/common';

type DashboardState = 'loading' | 'healthy' | 'degraded' | 'critical' | 'unavailable' | 'empty';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [TooltipModule, SlicePipe],
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
  dashboardState: DashboardState = 'loading';
  errorMessage = '';
  lastUpdated = '';
  lastSuccessfulSync = '';
  refreshing = false;
  private refreshInterval: ReturnType<typeof setInterval> | undefined;
  uptime: any = null;

  get hasData(): boolean { return this.data !== null; }
  get isLoading(): boolean { return this.dashboardState === 'loading'; }
  get isUnavailable(): boolean { return this.dashboardState === 'unavailable'; }
  get isEmpty(): boolean { return this.dashboardState === 'empty'; }
  get isOperational(): boolean { return this.dashboardState === 'healthy'; }

  get podTotal() { return (this.data?.pods.healthy || 0) + (this.data?.pods.warning || 0) + (this.data?.pods.critical || 0); }
  get nodeTotal() { return (this.data?.nodes.healthy || 0) + (this.data?.nodes.warning || 0); }
  get depTotal() { return (this.data?.deployments.healthy || 0) + (this.data?.deployments.unavailable || 0); }
  get totalResources() { return this.podTotal + this.nodeTotal + this.depTotal; }
  get healthyResources() { return (this.data?.pods.healthy || 0) + (this.data?.nodes.healthy || 0) + (this.data?.deployments.healthy || 0); }
  get attentionCount() {
    return (this.data?.pods.warning || 0)
      + (this.data?.pods.critical || 0)
      + (this.data?.nodes.warning || 0)
      + (this.data?.deployments.unavailable || 0);
  }

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
    if (this.totalResources === 0) return 0;
    return Math.round((this.healthyResources / this.totalResources) * 100);
  }

  get healthColor(): 'green' | 'amber' | 'red' {
    if (this.overallHealth === 'critical') return 'red';
    if (this.overallHealth === 'degraded') return 'amber';
    return 'green';
  }

  get statusTitle(): string {
    switch (this.dashboardState) {
      case 'unavailable': return 'Cluster unavailable';
      case 'empty': return 'No resources detected';
      case 'critical': return 'Immediate attention required';
      case 'degraded': return 'Cluster needs attention';
      default: return 'All systems operational';
    }
  }

  get statusDescription(): string {
    if (this.isUnavailable) return this.errorMessage || 'Unable to retrieve current cluster data.';
    if (this.isEmpty) return 'Connection is available, but no pods, nodes, or deployments were returned.';
    return `${this.healthyResources} / ${this.totalResources} resources healthy`;
  }

  /** Top issue, first Warning event used for incident actions. */
  get topIssue(): KubeEvent | null {
    return this.warningEvents[0] || null;
  }

  get warningEvents(): KubeEvent[] {
    return this.recentEvents.filter(e => e.type === 'Warning');
  }

  get normalEvents(): KubeEvent[] {
    return this.recentEvents.filter(e => e.type !== 'Warning');
  }

  pct(value: number, total: number): number { return total === 0 ? 0 : Math.round((value / total) * 100); }
  goToInvestigate() {
    const target = this.topIssue?.object;
    if (target) this.router.navigate(['/monitor/investigate'], { queryParams: { target } });
    else this.router.navigate(['/operations/pods']);
  }

  goToPods() { this.router.navigate(['/operations/pods']); }

  podSeverity(pod: Pod): 'critical' | 'warning' {
    const crit = ['CrashLoopBackOff', 'Error', 'OOMKilled', 'ImagePullBackOff'];
    return crit.some(s => pod.status.includes(s)) ? 'critical' : 'warning';
  }

  refresh() {
    const firstLoad = !this.data && !this.lastSuccessfulSync;
    this.refreshing = true;
    this.errorMessage = '';
    if (firstLoad) this.dashboardState = 'loading';

    forkJoin({
      overview: this.api.getOverview().pipe(catchError(() => of(null))),
      events: this.api.getEvents(10).pipe(catchError(() => of(null))),
      pods: this.api.getPods(1, 50).pipe(catchError(() => of(null))),
      uptime: this.http.get<any>('/api/uptime').pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ overview, events, pods, uptime }) => {
        if (overview) {
          this.data = overview;
          this.dashboardState = this.classifyState(overview);
          this.lastSuccessfulSync = this.formatTime(new Date());
          this.lastUpdated = this.lastSuccessfulSync;
        } else {
          this.dashboardState = 'unavailable';
          this.errorMessage = 'Cluster overview could not be loaded. Check the connection and retry.';
        }

        this.recentEvents = events?.events || [];
        this.problemPods = (pods?.pods || []).filter(p =>
          p.status !== 'Running' && p.status !== 'Completed' && p.status !== 'Succeeded'
        ).slice(0, 8);
        this.uptime = uptime;
        this.refreshing = false;
      },
      error: () => {
        this.dashboardState = 'unavailable';
        this.errorMessage = 'Cluster data could not be loaded. Check the connection and retry.';
        this.refreshing = false;
      },
    });
  }

  private classifyState(overview: OverviewResponse): DashboardState {
    const total = (overview.pods.healthy || 0)
      + (overview.pods.warning || 0)
      + (overview.pods.critical || 0)
      + (overview.nodes.healthy || 0)
      + (overview.nodes.warning || 0)
      + (overview.deployments.healthy || 0)
      + (overview.deployments.unavailable || 0);

    if (total === 0) return 'empty';
    if ((overview.pods.critical || 0) > 0 || (overview.nodes.warning || 0) > 0) return 'critical';
    if ((overview.pods.warning || 0) > 0 || (overview.deployments.unavailable || 0) > 0) return 'degraded';
    return 'healthy';
  }

  private formatTime(value: Date): string {
    return value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  ngOnInit() {
    this.refresh();
    this.refreshInterval = setInterval(() => this.refresh(), 30000);
  }

  ngOnDestroy() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }
}
