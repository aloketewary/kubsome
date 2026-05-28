import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { SpotlightComponent } from '../../shared/components/spotlight.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';

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
  imports: [FormsModule, TagModule, ButtonModule, TooltipModule, SpotlightComponent, SkeletonComponent, PageHeaderComponent],
  template: `
    <app-spotlight id="namespace" title="Namespace Overview" icon="pi pi-folder"
      description="Summary of resources in the current namespace."
      [capabilities]="['Resource counts', 'Service listing', 'ConfigMap overview']" [compact]="true" />

    <app-page-header title="Namespace" [subtitle]="'Resource inventory for ' + (data?.namespace || '...') + ' · ' + lastUpdated">
        <button class="ar-btn" [class.ar-active]="autoRefresh" (click)="toggleAutoRefresh()" [pTooltip]="autoRefresh ? 'Auto-refresh on (30s)' : 'Auto-refresh off'">
          <i class="pi" [class.pi-sync]="autoRefresh" [class.pi-pause]="!autoRefresh"></i>
        </button>
        <button pButton icon="pi pi-refresh" class="p-button-outlined p-button-sm p-button-rounded" (click)="load()" [loading]="loading" pTooltip="Refresh"></button>
    </app-page-header>

    @if (data) {
      <!-- Summary Hero -->
      <div class="ns-hero">
        <div class="hero-stat">
          <span class="hero-value">{{ totalResources }}</span>
          <span class="hero-label">Total Resources</span>
        </div>
        <div class="hero-divider"></div>
        <div class="hero-stat">
          <span class="hero-value">{{ resourceList.length }}</span>
          <span class="hero-label">Resource Types</span>
        </div>
        <div class="hero-divider"></div>
        <div class="hero-stat">
          <span class="hero-value">{{ totalPods }}</span>
          <span class="hero-label">Pods</span>
        </div>

        <!-- Pod Status Ring -->
        @if (totalPods > 0) {
          <div class="pod-ring">
            <svg viewBox="0 0 36 36" class="ring-svg">
              <path class="ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path class="ring-running" [attr.stroke-dasharray]="runningPct + ', 100'" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            </svg>
            <div class="ring-label">{{ runningPct }}% </div>
            <small class="ring-label small">running</small>
          </div>
        }
      </div>

      <!-- Resource Composition Bar -->
      <div class="composition-section">
        <h3 class="section-title">Composition</h3>
        <div class="composition-bar">
          @for (item of resourceList; track item.type) {
            <div class="comp-segment" [style.flex]="item.count" [style.background]="item.color" [title]="item.type + ': ' + item.count"></div>
          }
        </div>
        <div class="composition-legend">
          @for (item of resourceList; track item.type) {
            <span class="legend-item">
              <span class="legend-dot" [style.background]="item.color"></span>
              {{ item.type }} ({{ item.count }})
            </span>
          }
        </div>
      </div>

      <!-- Resource Cards -->
      <div class="resources-header">
        <h3 class="section-title">Resources</h3>
        <div class="resource-search">
          <i class="pi pi-search"></i>
          <input type="text" [(ngModel)]="resourceSearch" placeholder="Filter resources..." />
        </div>
      </div>
      <div class="resource-grid">
        @for (item of filteredResources; track item.type) {
          <div class="resource-card" [class.clickable]="item.route" (click)="item.route && router.navigate([item.route])">
            <div class="rc-icon" [style.background]="item.color + '18'" [style.color]="item.color">
              <i [class]="item.icon"></i>
            </div>
            <div class="rc-info">
              <span class="rc-count">{{ item.count }}</span>
              <span class="rc-type">{{ item.type }}</span>
            </div>
            @if (item.route) {
              <i class="pi pi-arrow-right rc-arrow"></i>
            }
          </div>
        }
      </div>

      <!-- Pod Status Breakdown -->
      @if (podStatuses.length > 0) {
        <h3 class="section-title">Pod Status</h3>
        <div class="status-cards">
          @for (s of podStatuses; track s.status) {
            <div class="status-card" [class]="'sc-' + statusClass(s.status)">
              <span class="sc-dot" [class]="'dot-' + statusClass(s.status)"></span>
              <span class="sc-count">{{ s.count }}</span>
              <span class="sc-label">{{ s.status }}</span>
            </div>
          }
        </div>
      }
    } @else {
      <app-skeleton variant="stats" />
      <app-skeleton variant="list" [count]="6" />
    }
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .subtitle strong { color: var(--text); }
    .header-actions { display: flex; align-items: center; gap: 8px; }
    .ar-btn {
      width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--border);
      background: var(--bg-card); color: var(--text-muted); cursor: pointer; transition: all 0.15s;
      display: flex; align-items: center; justify-content: center;
    }
    .ar-btn:hover { border-color: var(--accent); color: var(--accent); }
    .ar-btn.ar-active { border-color: var(--success); color: var(--success); background: var(--success-subtle); }
    .ar-btn.ar-active i { animation: spin 2s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Hero */
    .ns-hero {
      display: flex; align-items: center; gap: 24px;
      padding: 20px 24px; margin-bottom: 24px;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
    }
    .hero-stat { text-align: center; }
    .hero-value { display: block; font-size: 32px; font-weight: 700; letter-spacing: -0.03em; }
    .hero-label { display: block; font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-top: 2px; }
    .hero-divider { width: 1px; height: 40px; background: var(--border); }
    .pod-ring { position: relative; width: 64px; height: 64px; margin-left: auto; }
    .ring-svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    .ring-bg { fill: none; stroke: var(--bg-elevated); stroke-width: 3; }
    .ring-running { fill: none; stroke: var(--success); stroke-width: 3; stroke-linecap: round; }
    .ring-label {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700; text-align: center; line-height: 1.2;
    }
    .ring-label.small { font-size: 8px; font-weight: 400; color: var(--text-muted); margin-top: 1.5rem;}

    /* Composition */
    .composition-section { margin-bottom: 24px; }
    .section-title { font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 10px; }
    .composition-bar {
      display: flex; height: 8px; border-radius: 4px; overflow: hidden;
      background: var(--bg-elevated); margin-bottom: 10px;
    }
    .comp-segment { transition: flex 0.4s; min-width: 2px; }
    .composition-legend { display: flex; flex-wrap: wrap; gap: 12px; }
    .legend-item { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--text-secondary); }
    .legend-dot { width: 8px; height: 8px; border-radius: 2px; }

    /* Resource Cards */
    .resources-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .resource-search {
      display: flex; align-items: center; gap: 6px;
      padding: 5px 10px; border: 1px solid var(--border); border-radius: 6px;
      background: var(--bg-elevated); transition: border-color 0.12s;
    }
    .resource-search:focus-within { border-color: var(--accent); }
    .resource-search i { font-size: 12px; color: var(--text-muted); }
    .resource-search input {
      border: none; background: transparent; outline: none; color: var(--text);
      font-size: 12px; width: 120px;
    }
    .resource-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 10px; margin-bottom: 28px;
    }
    .resource-card {
      display: flex; align-items: center; gap: 12px;
      padding: 14px 16px; background: var(--bg-card);
      border: 1px solid var(--border); border-radius: var(--radius-sm);
      transition: all 0.12s;
    }
    .resource-card.clickable { cursor: pointer; }
    .resource-card.clickable:hover { border-color: var(--accent); transform: translateY(-1px); }
    .rc-icon {
      width: 36px; height: 36px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center; font-size: 16px;
    }
    .rc-info { flex: 1; }
    .rc-count { display: block; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
    .rc-type { display: block; font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .rc-arrow { font-size: 11px; color: var(--text-muted); opacity: 0; transition: opacity 0.12s; }
    .resource-card.clickable:hover .rc-arrow { opacity: 1; color: var(--accent); }

    /* Pod Status */
    .status-cards { display: flex; gap: 10px; flex-wrap: wrap; }
    .status-card {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 16px; border-radius: var(--radius-sm);
      background: var(--bg-card); border: 1px solid var(--border);
    }
    .sc-dot { width: 8px; height: 8px; border-radius: 50%; }
    .dot-ok { background: var(--success); }
    .dot-warn { background: var(--warning); }
    .dot-crit { background: var(--danger); }
    .sc-count { font-size: 18px; font-weight: 700; }
    .sc-label { font-size: 12px; color: var(--text-secondary); }
    .sc-ok { border-left: 3px solid var(--success); }
    .sc-warn { border-left: 3px solid var(--warning); }
    .sc-crit { border-left: 3px solid var(--danger); }

    .loading { display: flex; align-items: center; gap: 10px; padding: 40px; color: var(--text-muted); }
  `],
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
    pods: '#3b82f6',
    deployments: '#a855f7',
    services: '#22c55e',
    configmaps: '#eab308',
    secrets: '#ef4444',
    ingress: '#f472b6',
    jobs: '#06b6d4',
    cronjobs: '#8b5cf6',
    statefulsets: '#14b8a6',
    daemonsets: '#f97316',
  };

  private iconMap: Record<string, string> = {
    pods: 'pi pi-box',
    deployments: 'pi pi-send',
    services: 'pi pi-globe',
    configmaps: 'pi pi-file',
    secrets: 'pi pi-lock',
    ingress: 'pi pi-link',
    jobs: 'pi pi-clock',
    cronjobs: 'pi pi-history',
    statefulsets: 'pi pi-database',
    daemonsets: 'pi pi-server',
  };

  private routeMap: Record<string, string> = {
    pods: '/pods',
    deployments: '/deployments',
    services: '/network',
    jobs: '/jobs',
    cronjobs: '/jobs',
    ingress: '/network',
    secrets: '/secrets',
  };

  get totalResources() { return this.resourceList.reduce((sum, r) => sum + r.count, 0); }
  get totalPods() { return this.podStatuses.reduce((sum, s) => sum + s.count, 0); }
  get runningPct() {
    const running = this.podStatuses.find(s => s.status === 'Running')?.count || 0;
    return this.totalPods > 0 ? Math.round((running / this.totalPods) * 100) : 0;
  }

  statusClass(status: string): string {
    if (status === 'Running' || status === 'Succeeded') return 'ok';
    if (status === 'Pending') return 'warn';
    return 'crit';
  }

  get filteredResources(): ResourceItem[] {
    if (!this.resourceSearch) return this.resourceList;
    const q = this.resourceSearch.toLowerCase();
    return this.resourceList.filter(r => r.type.toLowerCase().includes(q));
  }

  ngOnInit() {
    this.load();
    this.startAutoRefresh();
  }

  ngOnDestroy() { clearInterval(this.refreshTimer); }

  toggleAutoRefresh() {
    this.autoRefresh = !this.autoRefresh;
    if (this.autoRefresh) this.startAutoRefresh();
    else clearInterval(this.refreshTimer);
  }

  private startAutoRefresh() {
    clearInterval(this.refreshTimer);
    this.refreshTimer = setInterval(() => this.load(), 30000);
  }

  load() {
    this.loading = true;
    this.http.get<any>('/api/ns-overview').subscribe(res => {
      this.data = res;
      this.resourceList = Object.entries(res.resources || {})
        .map(([type, count]) => ({
          type,
          count: count as number,
          icon: this.iconMap[type] || 'pi pi-th-large',
          color: this.colorMap[type] || '#6b7280',
          route: this.routeMap[type],
        }))
        .sort((a, b) => b.count - a.count);
      this.podStatuses = Object.entries(res.pod_statuses || {}).map(([status, count]) => ({ status, count: count as number }));
      this.loading = false;
      this.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    });
  }
}
