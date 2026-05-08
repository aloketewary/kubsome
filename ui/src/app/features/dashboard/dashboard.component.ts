import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { ApiService } from '../../core/services/api.service';
import { OverviewResponse, KubeEvent } from '../../core/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [TagModule, ButtonModule],
  template: `
    @if (data) {
      <!-- Hero Status Banner -->
      <div class="hero" [class]="'hero-' + overallHealth">
        <div class="hero-ring">
          <svg viewBox="0 0 36 36" class="ring-svg">
            <path class="ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            <path class="ring-fill" [attr.stroke-dasharray]="healthPct + ', 100'" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
          </svg>
          <span class="ring-value">{{ healthPct }}%</span>
        </div>
        <div class="hero-info">
          <h1 class="hero-title">{{ overallHealth === 'healthy' ? 'All Systems Operational' : overallHealth === 'degraded' ? 'Degraded Performance' : 'Critical Issues Detected' }}</h1>
          <p class="hero-sub">{{ data.pods.healthy + data.nodes.healthy + data.deployments.healthy }} / {{ podTotal + nodeTotal + depTotal }} resources healthy</p>
          <span class="hero-time">Updated {{ lastUpdated }}</span>
        </div>
        <button pButton icon="pi pi-refresh" class="p-button-text p-button-sm hero-refresh" (click)="refresh()"></button>
      </div>

      <!-- Critical Alert Banner -->
      @if ((data.pods.critical) > 0 || data.nodes.warning > 0) {
        <div class="alert-banner">
          <i class="pi pi-exclamation-triangle"></i>
          <span>
            @if ((data.pods.critical) > 0) { {{ data.pods.critical }} pod(s) in critical state. }
            @if (data.nodes.warning > 0) { {{ data.nodes.warning }} node(s) not ready. }
          </span>
          <button pButton label="Investigate" icon="pi pi-arrow-right" iconPos="right" class="p-button-sm p-button-text" (click)="goToPods()"></button>
        </div>
      }

      <!-- Metric Cards -->
      <div class="metrics-grid">
        <div class="metric-card" (click)="goToPods()">
          <div class="metric-top">
            <div class="metric-icon pods"><i class="pi pi-box"></i></div>
            <div class="metric-numbers">
              <span class="metric-value">{{ data.pods.healthy }}</span>
              <span class="metric-of">/ {{ podTotal }}</span>
            </div>
          </div>
          <div class="metric-label">Pods Running</div>
          <div class="metric-bar">
            <div class="bar-segment bar-ok" [style.width.%]="pct(data.pods.healthy, podTotal)"></div>
            <div class="bar-segment bar-warn" [style.width.%]="pct(data.pods.warning, podTotal)"></div>
            <div class="bar-segment bar-crit" [style.width.%]="pct(data.pods.critical, podTotal)"></div>
          </div>
          <div class="metric-legend">
            @if ((data.pods.warning) > 0) { <span class="legend-item warn">{{ data.pods.warning }} warning</span> }
            @if ((data.pods.critical) > 0) { <span class="legend-item crit">{{ data.pods.critical }} critical</span> }
            @if ((data.pods.warning) === 0 && (data.pods.critical) === 0) { <span class="legend-item ok">All healthy</span> }
          </div>
        </div>

        <div class="metric-card" (click)="router.navigate(['/metrics'])">
          <div class="metric-top">
            <div class="metric-icon nodes"><i class="pi pi-server"></i></div>
            <div class="metric-numbers">
              <span class="metric-value">{{ data.nodes.healthy }}</span>
              <span class="metric-of">/ {{ nodeTotal }}</span>
            </div>
          </div>
          <div class="metric-label">Nodes Ready</div>
          <div class="metric-bar">
            <div class="bar-segment bar-ok" [style.width.%]="pct(data.nodes.healthy, nodeTotal)"></div>
            <div class="bar-segment bar-warn" [style.width.%]="pct(data.nodes.warning, nodeTotal)"></div>
          </div>
          <div class="metric-legend">
            @if (data.nodes.warning > 0) { <span class="legend-item warn">{{ data.nodes.warning }} not ready</span> }
            @else { <span class="legend-item ok">All ready</span> }
          </div>
        </div>

        <div class="metric-card" (click)="router.navigate(['/deployments'])">
          <div class="metric-top">
            <div class="metric-icon deploys"><i class="pi pi-send"></i></div>
            <div class="metric-numbers">
              <span class="metric-value">{{ data.deployments.healthy }}</span>
              <span class="metric-of">/ {{ depTotal }}</span>
            </div>
          </div>
          <div class="metric-label">Deployments Available</div>
          <div class="metric-bar">
            <div class="bar-segment bar-ok" [style.width.%]="pct(data.deployments.healthy, depTotal)"></div>
            <div class="bar-segment bar-crit" [style.width.%]="pct(data.deployments.unavailable, depTotal)"></div>
          </div>
          <div class="metric-legend">
            @if ((data.deployments.unavailable) > 0) { <span class="legend-item crit">{{ data.deployments.unavailable }} unavailable</span> }
            @else { <span class="legend-item ok">All available</span> }
          </div>
        </div>
      </div>

      <!-- Two-column layout: Events + Actions -->
      <div class="bottom-grid">
        <div class="bottom-section">
          <div class="section-header">
            <h2>Recent Events</h2>
            <button pButton label="All" class="p-button-text p-button-sm" icon="pi pi-arrow-right" iconPos="right" (click)="router.navigate(['/events'])"></button>
          </div>
          <div class="events-card">
            @for (event of recentEvents; track $index) {
              <div class="event-row">
                <div class="event-dot" [class.warn]="event.type === 'Warning'"></div>
                <div class="event-content">
                  <span class="event-reason">{{ event.reason }}</span>
                  <span class="event-msg">{{ event.message }}</span>
                </div>
                <code class="event-obj">{{ event.object }}</code>
              </div>
            }
            @if (recentEvents.length === 0) {
              <div class="events-empty"><i class="pi pi-check-circle"></i> No recent events</div>
            }
          </div>
        </div>

        <div class="bottom-section">
          <div class="section-header">
            <h2>Quick Actions</h2>
          </div>
          <div class="actions-grid">
            <div class="action-card" (click)="router.navigate(['/ai'])">
              <i class="pi pi-sparkles"></i>
              <span>AI Summary</span>
            </div>
            <div class="action-card" (click)="router.navigate(['/terminal'])">
              <i class="pi pi-code"></i>
              <span>Terminal</span>
            </div>
            <div class="action-card" (click)="router.navigate(['/runbooks'])">
              <i class="pi pi-book"></i>
              <span>Runbooks</span>
            </div>
            <div class="action-card" (click)="router.navigate(['/incident'])">
              <i class="pi pi-exclamation-circle"></i>
              <span>Incident</span>
            </div>
            <div class="action-card" (click)="router.navigate(['/secrets'])">
              <i class="pi pi-lock"></i>
              <span>Secrets</span>
            </div>
            <div class="action-card" (click)="router.navigate(['/cost'])">
              <i class="pi pi-dollar"></i>
              <span>Optimize</span>
            </div>
          </div>
        </div>
      </div>
    } @else {
      <!-- Skeleton -->
      <div class="skeleton-hero skeleton"></div>
      <div class="skeleton-grid">
        <div class="skeleton-card skeleton"></div>
        <div class="skeleton-card skeleton"></div>
        <div class="skeleton-card skeleton"></div>
      </div>
    }
  `,
  styles: [`
    /* Hero */
    .hero {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 24px 28px;
      border-radius: var(--radius);
      margin-bottom: 20px;
      position: relative;
    }
    .hero-healthy { background: linear-gradient(135deg, rgba(34,197,94,0.08), rgba(34,197,94,0.02)); border: 1px solid rgba(34,197,94,0.2); }
    .hero-degraded { background: linear-gradient(135deg, rgba(234,179,8,0.08), rgba(234,179,8,0.02)); border: 1px solid rgba(234,179,8,0.2); }
    .hero-critical { background: linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.02)); border: 1px solid rgba(239,68,68,0.2); }

    .hero-ring { position: relative; width: 64px; height: 64px; flex-shrink: 0; }
    .ring-svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    .ring-bg { fill: none; stroke: var(--bg-elevated); stroke-width: 3; }
    .ring-fill { fill: none; stroke-width: 3; stroke-linecap: round; transition: stroke-dasharray 0.6s ease; }
    .hero-healthy .ring-fill { stroke: var(--success); }
    .hero-degraded .ring-fill { stroke: var(--warning); }
    .hero-critical .ring-fill { stroke: var(--danger); }
    .ring-value {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 700;
    }

    .hero-info { flex: 1; }
    .hero-title { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; margin: 0; }
    .hero-sub { font-size: 13px; color: var(--text-secondary); margin: 4px 0 0; }
    .hero-time { font-size: 11px; color: var(--text-muted); }
    .hero-refresh { position: absolute; top: 16px; right: 16px; }

    /* Alert Banner */
    .alert-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      background: var(--danger-subtle);
      border: 1px solid var(--danger);
      border-radius: var(--radius-sm);
      margin-bottom: 20px;
      font-size: 13px;
    }
    .alert-banner i { color: var(--danger); font-size: 16px; }
    .alert-banner span { flex: 1; }

    /* Metric Cards */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
      margin-bottom: 28px;
    }
    .metric-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 20px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .metric-card:hover { border-color: var(--border-hover); transform: translateY(-1px); }
    .metric-top { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
    .metric-icon {
      width: 40px; height: 40px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center; font-size: 18px;
    }
    .metric-icon.pods { background: var(--accent-subtle); color: var(--accent); }
    .metric-icon.nodes { background: var(--success-subtle); color: var(--success); }
    .metric-icon.deploys { background: rgba(168,85,247,0.1); color: var(--purple); }
    .metric-numbers { display: flex; align-items: baseline; gap: 2px; }
    .metric-value { font-size: 32px; font-weight: 700; letter-spacing: -0.04em; }
    .metric-of { font-size: 16px; color: var(--text-muted); }
    .metric-label { font-size: 12px; color: var(--text-muted); margin-bottom: 12px; }
    .metric-bar {
      height: 6px; border-radius: 3px; background: var(--bg-elevated);
      display: flex; overflow: hidden; margin-bottom: 8px;
    }
    .bar-segment { height: 100%; transition: width 0.5s ease; }
    .bar-ok { background: var(--success); }
    .bar-warn { background: var(--warning); }
    .bar-crit { background: var(--danger); }
    .metric-legend { font-size: 11px; }
    .legend-item { display: inline-flex; align-items: center; gap: 4px; }
    .legend-item.ok { color: var(--success); }
    .legend-item.warn { color: var(--warning); }
    .legend-item.crit { color: var(--danger); }

    /* Bottom Grid */
    .bottom-grid {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 16px;
    }
    .section-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 10px;
    }
    .section-header h2 { font-size: 15px; font-weight: 600; margin: 0; }

    /* Events */
    .events-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
    }
    .event-row {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 14px; border-bottom: 1px solid var(--border);
      font-size: 12px; transition: background 0.1s;
    }
    .event-row:last-child { border-bottom: none; }
    .event-row:hover { background: var(--bg-hover); }
    .event-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); flex-shrink: 0; }
    .event-dot.warn { background: var(--warning); }
    .event-content { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .event-reason { font-weight: 500; font-size: 12px; }
    .event-msg { font-size: 11px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .event-obj { font-size: 10px; color: var(--text-muted); background: var(--bg-elevated); padding: 2px 6px; border-radius: 4px; white-space: nowrap; }
    .events-empty { padding: 24px; text-align: center; color: var(--text-muted); font-size: 12px; display: flex; align-items: center; justify-content: center; gap: 6px; }

    /* Actions */
    .actions-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }
    .action-card {
      display: flex; align-items: center; gap: 10px;
      padding: 14px 16px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-size: 13px;
      transition: all 0.12s;
    }
    .action-card:hover { border-color: var(--accent); background: var(--accent-subtle); }
    .action-card i { font-size: 16px; color: var(--text-muted); }
    .action-card:hover i { color: var(--accent); }

    /* Skeleton */
    .skeleton-hero { height: 100px; border-radius: var(--radius); margin-bottom: 20px; }
    .skeleton-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
    .skeleton-card { height: 160px; border-radius: var(--radius); }

    @media (max-width: 900px) {
      .metrics-grid { grid-template-columns: 1fr; }
      .bottom-grid { grid-template-columns: 1fr; }
    }
  `],
})
export class DashboardComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  router = inject(Router);
  data: OverviewResponse | null = null;
  recentEvents: KubeEvent[] = [];
  lastUpdated = '';
  private refreshInterval: any;

  get podTotal() {
    return (this.data?.pods.healthy || 0) + (this.data?.pods.warning || 0) + (this.data?.pods.critical || 0);
  }
  get nodeTotal() {
    return (this.data?.nodes.healthy || 0) + (this.data?.nodes.warning || 0);
  }
  get depTotal() {
    return (this.data?.deployments.healthy || 0) + (this.data?.deployments.unavailable || 0);
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

  pct(value: number, total: number): number {
    return total === 0 ? 0 : Math.round((value / total) * 100);
  }

  goToPods() { this.router.navigate(['/pods']); }

  refresh() {
    this.api.getOverview().subscribe(res => (this.data = res));
    this.api.getEvents(5).subscribe(res => (this.recentEvents = res.events));
    this.lastUpdated = new Date().toLocaleTimeString();
  }

  ngOnInit() {
    this.refresh();
    this.refreshInterval = setInterval(() => this.refresh(), 30000);
  }

  ngOnDestroy() {
    clearInterval(this.refreshInterval);
  }
}
