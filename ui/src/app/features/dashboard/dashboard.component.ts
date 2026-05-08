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

      <!-- Charts Row -->
      <div class="charts-row">
        <!-- Activity Bar Chart -->
        <div class="chart-card">
          <div class="chart-header">
            <h3>Event Activity</h3>
            <span class="chart-hint">Last {{ recentEvents.length }} events</span>
          </div>
          <div class="bar-chart">
            @for (bar of activityBars; track $index) {
              <div class="chart-bar-wrap">
                <div class="chart-bar" [style.height.%]="bar" [class.bar-high]="bar > 70" [class.bar-med]="bar > 40 && bar <= 70" [attr.title]="Math.round(bar) + '%'"></div>
              </div>
            }
          </div>
        </div>

        <!-- Pod Status Donut -->
        <div class="chart-card">
          <div class="chart-header">
            <h3>Pod Distribution</h3>
          </div>
          <div class="donut-chart">
            <svg viewBox="0 0 42 42" class="donut-svg">
              <circle class="donut-bg" cx="21" cy="21" r="15.9" />
              <circle class="donut-ok" cx="21" cy="21" r="15.9" [attr.stroke-dasharray]="podRunningDash" stroke-dashoffset="25" />
              <circle class="donut-warn" cx="21" cy="21" r="15.9" [attr.stroke-dasharray]="podWarnDash" [attr.stroke-dashoffset]="podWarnOffset" />
              <circle class="donut-crit" cx="21" cy="21" r="15.9" [attr.stroke-dasharray]="podCritDash" [attr.stroke-dashoffset]="podCritOffset" />
            </svg>
            <div class="donut-center">
              <span class="donut-total">{{ podTotal }}</span>
              <span class="donut-label">pods</span>
            </div>
          </div>
          <div class="donut-legend">
            <span class="dl-item"><span class="dl-dot dl-ok"></span> Running {{ data.pods.healthy }}</span>
            <span class="dl-item"><span class="dl-dot dl-warn"></span> Warning {{ data.pods.warning }}</span>
            <span class="dl-item"><span class="dl-dot dl-crit"></span> Critical {{ data.pods.critical }}</span>
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
    /* Charts */
    .charts-row {
      display: grid;
      grid-template-columns: 1.5fr 1fr;
      gap: 14px;
      margin-bottom: 24px;
    }
    .chart-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px 20px;
    }
    .chart-header {
      display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;
    }
    .chart-header h3 { font-size: 13px; font-weight: 600; margin: 0; }
    .chart-hint { font-size: 10px; color: var(--text-muted); }

    /* Bar Chart */
    .bar-chart {
      display: flex; align-items: flex-end; gap: 3px; height: 80px;
    }
    .chart-bar-wrap { flex: 1; height: 100%; display: flex; align-items: flex-end; }
    .chart-bar {
      width: 100%; border-radius: 3px 3px 0 0; background: var(--accent); opacity: 0.5;
      transition: all 0.2s; cursor: crosshair; min-height: 3px;
    }
    .chart-bar:hover { opacity: 0.9; }
    .chart-bar.bar-high { background: var(--danger); opacity: 0.7; }
    .chart-bar.bar-med { background: var(--warning); opacity: 0.6; }

    /* Donut Chart */
    .donut-chart { position: relative; width: 120px; height: 120px; margin: 0 auto 12px; }
    .donut-svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    .donut-bg { fill: none; stroke: var(--bg-elevated); stroke-width: 4; }
    .donut-ok { fill: none; stroke: var(--success); stroke-width: 4; stroke-linecap: round; }
    .donut-warn { fill: none; stroke: var(--warning); stroke-width: 4; stroke-linecap: round; }
    .donut-crit { fill: none; stroke: var(--danger); stroke-width: 4; stroke-linecap: round; }
    .donut-center {
      position: absolute; inset: 0; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
    }
    .donut-total { font-size: 22px; font-weight: 700; }
    .donut-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; }
    .donut-legend { display: flex; justify-content: center; gap: 12px; }
    .dl-item { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--text-secondary); }
    .dl-dot { width: 6px; height: 6px; border-radius: 50%; }
    .dl-ok { background: var(--success); }
    .dl-warn { background: var(--warning); }
    .dl-crit { background: var(--danger); }

    @media (max-width: 768px) { .charts-row { grid-template-columns: 1fr; } }

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
      /* Charts */
    .charts-row {
      display: grid;
      grid-template-columns: 1.5fr 1fr;
      gap: 14px;
      margin-bottom: 24px;
    }
    .chart-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px 20px;
    }
    .chart-header {
      display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;
    }
    .chart-header h3 { font-size: 13px; font-weight: 600; margin: 0; }
    .chart-hint { font-size: 10px; color: var(--text-muted); }

    /* Bar Chart */
    .bar-chart {
      display: flex; align-items: flex-end; gap: 3px; height: 80px;
    }
    .chart-bar-wrap { flex: 1; height: 100%; display: flex; align-items: flex-end; }
    .chart-bar {
      width: 100%; border-radius: 3px 3px 0 0; background: var(--accent); opacity: 0.5;
      transition: all 0.2s; cursor: crosshair; min-height: 3px;
    }
    .chart-bar:hover { opacity: 0.9; }
    .chart-bar.bar-high { background: var(--danger); opacity: 0.7; }
    .chart-bar.bar-med { background: var(--warning); opacity: 0.6; }

    /* Donut Chart */
    .donut-chart { position: relative; width: 120px; height: 120px; margin: 0 auto 12px; }
    .donut-svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    .donut-bg { fill: none; stroke: var(--bg-elevated); stroke-width: 4; }
    .donut-ok { fill: none; stroke: var(--success); stroke-width: 4; stroke-linecap: round; }
    .donut-warn { fill: none; stroke: var(--warning); stroke-width: 4; stroke-linecap: round; }
    .donut-crit { fill: none; stroke: var(--danger); stroke-width: 4; stroke-linecap: round; }
    .donut-center {
      position: absolute; inset: 0; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
    }
    .donut-total { font-size: 22px; font-weight: 700; }
    .donut-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; }
    .donut-legend { display: flex; justify-content: center; gap: 12px; }
    .dl-item { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--text-secondary); }
    .dl-dot { width: 6px; height: 6px; border-radius: 50%; }
    .dl-ok { background: var(--success); }
    .dl-warn { background: var(--warning); }
    .dl-crit { background: var(--danger); }

    @media (max-width: 768px) { .charts-row { grid-template-columns: 1fr; } }

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

  Math = Math;

  get activityBars(): number[] {
    const bars = new Array(16).fill(0);
    const total = this.recentEvents.length;
    if (total === 0) return bars.map(() => Math.random() * 15 + 5);
    for (let i = 0; i < total; i++) { bars[Math.floor((i / total) * 16)]++; }
    const max = Math.max(...bars, 1);
    return bars.map(b => Math.max((b / max) * 100, 5));
  }

  get podRunningDash(): string {
    const pct = this.podTotal > 0 ? (this.data!.pods.healthy / this.podTotal) * 100 : 0;
    return pct + ' ' + (100 - pct);
  }
  get podWarnDash(): string {
    const pct = this.podTotal > 0 ? (this.data!.pods.warning / this.podTotal) * 100 : 0;
    return pct + ' ' + (100 - pct);
  }
  get podWarnOffset(): string {
    const running = this.podTotal > 0 ? (this.data!.pods.healthy / this.podTotal) * 100 : 0;
    return String(25 - running);
  }
  get podCritDash(): string {
    const pct = this.podTotal > 0 ? (this.data!.pods.critical / this.podTotal) * 100 : 0;
    return pct + ' ' + (100 - pct);
  }
  get podCritOffset(): string {
    const running = this.podTotal > 0 ? (this.data!.pods.healthy / this.podTotal) * 100 : 0;
    const warn = this.podTotal > 0 ? (this.data!.pods.warning / this.podTotal) * 100 : 0;
    return String(25 - running - warn);
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
