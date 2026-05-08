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
    <div class="page-header">
      <div>
        <h1>Overview</h1>
        <p class="subtitle">Cluster health at a glance</p>
      </div>
      <button pButton icon="pi pi-refresh" label="Refresh" class="p-button-outlined p-button-sm" (click)="refresh()"></button>
    </div>
    @if (lastUpdated) {
      <span class="last-updated">Updated {{ lastUpdated }}</span>
    }

    @if (data) {
      <!-- Stat Cards - Clickable -->
      <div class="stat-cards">
        <div class="stat-card clickable" (click)="goToPods()">
          <div class="stat-header">
            <div class="stat-icon pods-icon"><i class="pi pi-box"></i></div>
            <i class="pi pi-arrow-right card-arrow"></i>
          </div>
          <div class="stat-value">{{ data.pods.healthy }}<span class="stat-total">/{{ podTotal }}</span></div>
          <div class="stat-label">pods running</div>
          <div class="stat-bar">
            <div class="bar-fill bar-success" [style.width.%]="pct(data.pods.healthy, podTotal)"></div>
          </div>
          <div class="stat-breakdown">
            <span class="stat-item success">{{ data.pods.healthy }} ready</span>
            @if (data.pods.warning! > 0) {
              <span class="stat-item warning">{{ data.pods.warning }} warn</span>
            }
            @if (data.pods.critical! > 0) {
              <span class="stat-item danger clickable-text" (click)="goToPods(); $event.stopPropagation()">{{ data.pods.critical }} critical →</span>
            }
          </div>
        </div>

        <div class="stat-card clickable" (click)="router.navigate(['/metrics'])">
          <div class="stat-header">
            <div class="stat-icon nodes-icon"><i class="pi pi-server"></i></div>
            <i class="pi pi-arrow-right card-arrow"></i>
          </div>
          <div class="stat-value">{{ data.nodes.healthy }}<span class="stat-total">/{{ nodeTotal }}</span></div>
          <div class="stat-label">nodes ready</div>
          <div class="stat-bar">
            <div class="bar-fill bar-success" [style.width.%]="pct(data.nodes.healthy, nodeTotal)"></div>
          </div>
          <div class="stat-breakdown">
            <span class="stat-item success">{{ data.nodes.healthy }} ready</span>
            @if (data.nodes.warning > 0) {
              <span class="stat-item warning">{{ data.nodes.warning }} not ready</span>
            }
          </div>
        </div>

        <div class="stat-card clickable" (click)="router.navigate(['/deployments'])">
          <div class="stat-header">
            <div class="stat-icon deploy-icon"><i class="pi pi-send"></i></div>
            <i class="pi pi-arrow-right card-arrow"></i>
          </div>
          <div class="stat-value">{{ data.deployments.healthy }}<span class="stat-total">/{{ depTotal }}</span></div>
          <div class="stat-label">deployments healthy</div>
          <div class="stat-bar">
            <div class="bar-fill bar-success" [style.width.%]="pct(data.deployments.healthy, depTotal)"></div>
          </div>
          <div class="stat-breakdown">
            <span class="stat-item success">{{ data.deployments.healthy }} available</span>
            @if (data.deployments.unavailable! > 0) {
              <span class="stat-item danger">{{ data.deployments.unavailable }} down</span>
            }
          </div>
        </div>
      </div>

      <!-- Recent Events -->
      <div class="section-header">
        <h2>Recent Events</h2>
        <button pButton label="View All" class="p-button-text p-button-sm" icon="pi pi-arrow-right" iconPos="right" (click)="router.navigate(['/events'])"></button>
      </div>
      <div class="events-list">
        @for (event of recentEvents; track $index) {
          <div class="event-row">
            <span class="event-type-dot" [class.warn]="event.type === 'Warning'"></span>
            <span class="event-reason">{{ event.reason }}</span>
            <code class="event-object">{{ event.object }}</code>
            <span class="event-message">{{ event.message }}</span>
            @if (event.count > 1) {
              <span class="event-count">{{ event.count }}×</span>
            }
          </div>
        }
        @if (recentEvents.length === 0) {
          <div class="events-empty">No recent events</div>
        }
      </div>

      <!-- Quick Actions -->
      <div class="section-header">
        <h2>Quick Actions</h2>
      </div>
      <div class="quick-actions">
        <button pButton label="AI Summary" icon="pi pi-sparkles" class="p-button-outlined p-button-sm" (click)="router.navigate(['/ai'])"></button>
        <button pButton label="Terminal" icon="pi pi-code" class="p-button-outlined p-button-sm" (click)="router.navigate(['/terminal'])"></button>
        <button pButton label="Security Scan" icon="pi pi-shield" class="p-button-outlined p-button-sm" (click)="router.navigate(['/rbac'])"></button>
        <button pButton label="Start Incident" icon="pi pi-exclamation-circle" class="p-button-outlined p-button-sm p-button-danger" (click)="router.navigate(['/incident'])"></button>
      </div>
    } @else {
      <div class="loading-state">
        <div class="skeleton-cards">
          <div class="skeleton-card">
            <div class="skeleton skeleton-line" style="width: 40%; height: 12px;"></div>
            <div class="skeleton skeleton-line" style="width: 60%; height: 32px; margin-top: 12px;"></div>
            <div class="skeleton skeleton-line" style="width: 80%; height: 8px; margin-top: 16px;"></div>
          </div>
          <div class="skeleton-card">
            <div class="skeleton skeleton-line" style="width: 40%; height: 12px;"></div>
            <div class="skeleton skeleton-line" style="width: 60%; height: 32px; margin-top: 12px;"></div>
            <div class="skeleton skeleton-line" style="width: 80%; height: 8px; margin-top: 16px;"></div>
          </div>
          <div class="skeleton-card">
            <div class="skeleton skeleton-line" style="width: 40%; height: 12px;"></div>
            <div class="skeleton skeleton-line" style="width: 60%; height: 32px; margin-top: 12px;"></div>
            <div class="skeleton skeleton-line" style="width: 80%; height: 8px; margin-top: 16px;"></div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 28px;
    }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .last-updated {
      font-size: 11px;
      color: var(--text-muted);
      position: absolute;
      top: 48px;
      right: 0;
    }
    .page-header { position: relative; }

    .stat-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }
    .stat-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 24px;
      transition: all 0.2s;
    }
    .stat-card.clickable {
      cursor: pointer;
    }
    .stat-card.clickable:hover {
      border-color: var(--accent);
      transform: translateY(-2px);
      box-shadow: 0 4px 20px rgba(59, 130, 246, 0.1);
    }
    .stat-card.clickable:hover .card-arrow {
      opacity: 1;
      transform: translateX(0);
    }
    .stat-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }
    .stat-icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    }
    .card-arrow {
      font-size: 12px;
      color: var(--accent);
      opacity: 0;
      transform: translateX(-4px);
      transition: all 0.2s;
    }
    .pods-icon { background: var(--accent-subtle); color: var(--accent); }
    .nodes-icon { background: var(--success-subtle); color: var(--success); }
    .deploy-icon { background: rgba(168, 85, 247, 0.1); color: var(--purple); }
    .stat-value {
      font-size: 40px;
      font-weight: 700;
      letter-spacing: -0.04em;
      line-height: 1;
    }
    .stat-total {
      font-size: 20px;
      color: var(--text-muted);
      font-weight: 500;
    }
    .stat-label {
      font-size: 13px;
      color: var(--text-muted);
      margin-top: 4px;
      margin-bottom: 16px;
    }
    .stat-bar {
      height: 4px;
      border-radius: 2px;
      background: var(--bg-elevated);
      overflow: hidden;
      margin-bottom: 12px;
    }
    .bar-fill {
      height: 100%;
      border-radius: 2px;
      transition: width 0.6s ease;
    }
    .bar-success { background: var(--success); }
    .stat-breakdown { display: flex; gap: 12px; font-size: 12px; }
    .stat-item { display: flex; align-items: center; gap: 4px; color: var(--text-secondary); }
    .stat-item::before { content: ''; width: 6px; height: 6px; border-radius: 50%; }
    .stat-item.success::before { background: var(--success); }
    .stat-item.warning::before { background: var(--warning); }
    .stat-item.danger::before { background: var(--danger); }
    .clickable-text { cursor: pointer; text-decoration: underline; }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .section-header h2 { font-size: 16px; font-weight: 600; }

    .events-list {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
      margin-bottom: 32px;
    }
    .event-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      border-bottom: 1px solid var(--border);
      font-size: 12px;
    }
    .event-row:last-child { border-bottom: none; }
    .event-row:hover { background: var(--bg-hover); }
    .event-type-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--accent);
      flex-shrink: 0;
    }
    .event-type-dot.warn { background: var(--warning); }
    .event-reason { font-weight: 500; white-space: nowrap; }
    .event-object {
      font-size: 11px;
      color: var(--text-muted);
      background: var(--bg-elevated);
      padding: 1px 5px;
      border-radius: 3px;
    }
    .event-message {
      flex: 1;
      color: var(--text-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .event-count {
      font-size: 10px;
      color: var(--text-muted);
      background: var(--bg-elevated);
      padding: 1px 5px;
      border-radius: 8px;
    }
    .events-empty { padding: 24px; text-align: center; color: var(--text-muted); font-size: 13px; }

    .quick-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .loading-state {
      padding: 0;
    }
    .skeleton-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
    }
    .skeleton-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 24px;
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
    return (this.data?.pods.healthy ?? 0) + (this.data?.pods.warning ?? 0) + (this.data?.pods.critical ?? 0);
  }
  get nodeTotal() {
    return (this.data?.nodes.healthy ?? 0) + (this.data?.nodes.warning ?? 0);
  }
  get depTotal() {
    return (this.data?.deployments.healthy ?? 0) + (this.data?.deployments.unavailable ?? 0);
  }

  pct(value: number, total: number): number {
    return total === 0 ? 0 : Math.round((value / total) * 100);
  }

  goToPods() {
    this.router.navigate(['/pods']);
  }

  refresh() {
    this.api.getOverview().subscribe(res => (this.data = res));
    this.api.getEvents(5).subscribe(res => (this.recentEvents = res.events));
    this.lastUpdated = new Date().toLocaleTimeString();
  }

  ngOnInit() {
    this.refresh();
    // Auto-refresh every 30s
    this.refreshInterval = setInterval(() => this.refresh(), 30000);
  }

  ngOnDestroy() {
    clearInterval(this.refreshInterval);
  }
}
