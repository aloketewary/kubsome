import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { PageInfoComponent } from '../../shared/components/page-info.component';
import { SpotlightComponent } from '../../shared/components/spotlight.component';
import { RelatedPagesComponent } from '../../shared/components/related-pages.component';

@Component({
  selector: 'app-health-signals',
  standalone: true,
  imports: [ButtonModule, TagModule, PageInfoComponent, SpotlightComponent, RelatedPagesComponent],
  template: `
    <app-spotlight id="health-signals" title="Health Signals" icon="pi pi-wave-pulse"
      description="Cluster-wide health signals — OOMKills, HPA pressure, quota usage, and rollout state."
      [capabilities]="['OOMKill detection', 'HPA scaling pressure', 'Quota saturation', 'Stalled rollouts']" [compact]="true" />

    <div class="page-header">
      <div>
        <h1>Health Signals</h1>
        <p class="subtitle">{{ lastUpdated || 'Loading...' }}</p>
      </div>
      <div class="header-actions">
        <button pButton icon="pi pi-refresh" class="p-button-outlined p-button-sm p-button-rounded" (click)="refresh()" [loading]="loading"></button>
      </div>
      <app-page-info title="Health Signals" description="Aggregated health signals from enriched monitoring — OOMKills, HPA scaling limits, resource quota pressure, and deployment rollout issues."
        [tips]="['Red = immediate attention needed', 'Yellow = trending toward issue', 'Data collected every 5 min']"
        [commands]="['signals', 'oomkills', 'hpa', 'quotas']" />
    </div>

    <!-- Summary Cards -->
    @if (signals) {
      <div class="signal-cards">
        <div class="signal-card" [class.danger]="signals.oomkills_24h > 0" (click)="scrollTo('oom')">
          <div class="sc-icon danger-icon"><i class="pi pi-exclamation-circle"></i></div>
          <div class="sc-body">
            <span class="sc-value">{{ signals.oomkills_24h }}</span>
            <span class="sc-label">OOMKills (24h)</span>
          </div>
        </div>
        <div class="signal-card" [class.warn]="signals.hpa_at_max > 0" (click)="scrollTo('hpa')">
          <div class="sc-icon warn-icon"><i class="pi pi-arrows-v"></i></div>
          <div class="sc-body">
            <span class="sc-value">{{ signals.hpa_at_max }}</span>
            <span class="sc-label">HPA at Max</span>
          </div>
        </div>
        <div class="signal-card" [class.warn]="signals.quota_pressure > 0" (click)="scrollTo('quota')">
          <div class="sc-icon warn-icon"><i class="pi pi-gauge"></i></div>
          <div class="sc-body">
            <span class="sc-value">{{ signals.quota_pressure }}</span>
            <span class="sc-label">Quota &gt;80%</span>
          </div>
        </div>
        <div class="signal-card" [class.danger]="signals.stalled_rollouts > 0" (click)="scrollTo('rollout')">
          <div class="sc-icon danger-icon"><i class="pi pi-pause-circle"></i></div>
          <div class="sc-body">
            <span class="sc-value">{{ signals.stalled_rollouts }}</span>
            <span class="sc-label">Stalled Rollouts</span>
          </div>
        </div>
      </div>
    }

    <!-- OOMKills Section -->
    <div class="section" id="oom">
      <div class="section-header">
        <h2><i class="pi pi-exclamation-circle"></i> OOMKills</h2>
        <span class="section-hint">Last 48 hours</span>
      </div>
      @if (oomkills.length) {
        <div class="table-wrap">
          <div class="table-header">
            <span class="col-time">Time</span>
            <span class="col-pod">Pod</span>
            <span class="col-container">Container</span>
            <span class="col-limit">Memory Limit</span>
          </div>
          @for (item of oomkills; track $index) {
            <div class="table-row">
              <span class="col-time">{{ formatTime(item.ts) }}</span>
              <span class="col-pod mono">{{ item.pod }}</span>
              <span class="col-container">{{ item.container }}</span>
              <span class="col-limit"><p-tag [value]="item.mem_limit_mb + 'Mi'" severity="danger" [rounded]="true" size="small" /></span>
            </div>
          }
        </div>
      } @else {
        <div class="empty-section"><i class="pi pi-check-circle"></i> No OOMKills in the last 48h</div>
      }
    </div>

    <!-- HPA Section -->
    <div class="section" id="hpa">
      <div class="section-header">
        <h2><i class="pi pi-arrows-v"></i> HPA Scaling Pressure</h2>
        <span class="section-hint">Current state</span>
      </div>
      @if (hpa.length) {
        <div class="hpa-grid">
          @for (item of hpa; track item.name) {
            <div class="hpa-card" [class.at-max]="item.at_max" [class.scaling]="item.scaling_up">
              <div class="hpa-header">
                <strong>{{ item.target }}</strong>
                @if (item.at_max) { <p-tag value="AT MAX" severity="danger" [rounded]="true" size="small" /> }
                @if (item.scaling_up && !item.at_max) { <p-tag value="SCALING" severity="info" [rounded]="true" size="small" /> }
              </div>
              <div class="hpa-body">
                <div class="hpa-replicas">
                  <div class="replica-bar">
                    <div class="replica-fill" [style.width.%]="(item.current / item.max) * 100"></div>
                  </div>
                  <span class="replica-text">{{ item.current }}/{{ item.max }} replicas</span>
                </div>
                <div class="hpa-cpu">
                  <span class="cpu-label">CPU</span>
                  <div class="cpu-bar">
                    <div class="cpu-fill" [style.width.%]="item.cpu_current" [class.cpu-hot]="item.cpu_current > item.cpu_target"></div>
                  </div>
                  <span class="cpu-text">{{ item.cpu_current }}% / {{ item.cpu_target }}% target</span>
                </div>
              </div>
            </div>
          }
        </div>
      } @else {
        <div class="empty-section"><i class="pi pi-check-circle"></i> No HPAs under pressure</div>
      }
    </div>

    <!-- Quota Section -->
    <div class="section" id="quota">
      <div class="section-header">
        <h2><i class="pi pi-gauge"></i> Resource Quotas</h2>
        <span class="section-hint">Current namespace</span>
      </div>
      @if (quotas.length) {
        <div class="quota-grid">
          @for (item of quotas; track item.resource) {
            <div class="quota-card" [class.pressure]="item.pct > 80" [class.critical]="item.pct > 95">
              <div class="quota-header">
                <span class="quota-resource">{{ item.resource }}</span>
                <span class="quota-pct" [class.pct-warn]="item.pct > 80" [class.pct-crit]="item.pct > 95">{{ item.pct }}%</span>
              </div>
              <div class="quota-bar">
                <div class="quota-fill" [style.width.%]="item.pct" [class.fill-warn]="item.pct > 80" [class.fill-crit]="item.pct > 95"></div>
              </div>
              <div class="quota-detail">{{ item.used }} / {{ item.hard }}</div>
            </div>
          }
        </div>
      } @else {
        <div class="empty-section"><i class="pi pi-check-circle"></i> No quota pressure</div>
      }
    </div>

    <!-- Rollouts Section -->
    <div class="section" id="rollout">
      <div class="section-header">
        <h2><i class="pi pi-pause-circle"></i> Rollout State</h2>
        <span class="section-hint">Current namespace</span>
      </div>
      @if (rollouts.length) {
        <div class="table-wrap">
          <div class="table-header">
            <span class="col-deploy">Deployment</span>
            <span class="col-replicas">Replicas</span>
            <span class="col-state">State</span>
          </div>
          @for (item of rollouts; track item.deployment) {
            <div class="table-row">
              <span class="col-deploy mono">{{ item.deployment }}</span>
              <span class="col-replicas">{{ item.available }}/{{ item.desired }} ready · {{ item.unavailable }} unavailable</span>
              <span class="col-state">
                <p-tag [value]="item.state" [severity]="stateSeverity(item.state)" [rounded]="true" size="small" />
              </span>
            </div>
          }
        </div>
      } @else {
        <div class="empty-section"><i class="pi pi-check-circle"></i> All rollouts healthy</div>
      }
    </div>

    <app-related-pages label="Related" [pages]="relatedPages" />
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .header-actions { display: flex; align-items: center; gap: 8px; }

    .signal-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .signal-card {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 16px; display: flex; align-items: center; gap: 14px; cursor: pointer; transition: all 0.15s;
    }
    .signal-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .signal-card.danger { border-left: 3px solid var(--danger); }
    .signal-card.warn { border-left: 3px solid var(--warning); }
    .sc-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; }
    .danger-icon { background: var(--danger-subtle); color: var(--danger); }
    .warn-icon { background: var(--warning-subtle); color: var(--warning); }
    .sc-body { display: flex; flex-direction: column; }
    .sc-value { font-size: 28px; font-weight: 800; line-height: 1; }
    .sc-label { font-size: 11px; color: var(--text-muted); margin-top: 2px; }

    .section { margin-bottom: 28px; }
    .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .section-header h2 { font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px; margin: 0; }
    .section-header h2 i { font-size: 16px; color: var(--accent); }
    .section-hint { font-size: 11px; color: var(--text-muted); }

    .table-wrap { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
    .table-header, .table-row { display: grid; align-items: center; padding: 10px 16px; gap: 8px; }
    .table-header { font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); border-bottom: 1px solid var(--border); grid-template-columns: 140px 2fr 1fr 100px; }
    .table-row { font-size: 13px; border-bottom: 1px solid var(--border); grid-template-columns: 140px 2fr 1fr 100px; }
    .table-row:last-child { border-bottom: none; }
    #rollout .table-header, #rollout .table-row { grid-template-columns: 2fr 2fr 120px; }
    .mono { font-family: 'JetBrains Mono', monospace; font-size: 12px; }

    .hpa-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
    .hpa-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; }
    .hpa-card.at-max { border-left: 3px solid var(--danger); }
    .hpa-card.scaling { border-left: 3px solid var(--info); }
    .hpa-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .hpa-header strong { font-size: 14px; }
    .hpa-body { display: flex; flex-direction: column; gap: 10px; }
    .hpa-replicas, .hpa-cpu { display: flex; flex-direction: column; gap: 4px; }
    .replica-bar, .cpu-bar { height: 6px; border-radius: 3px; background: var(--bg-elevated); overflow: hidden; }
    .replica-fill { height: 100%; background: var(--accent); border-radius: 3px; transition: width 0.3s; }
    .cpu-fill { height: 100%; background: var(--success); border-radius: 3px; transition: width 0.3s; }
    .cpu-fill.cpu-hot { background: var(--danger); }
    .replica-text, .cpu-text { font-size: 11px; color: var(--text-muted); }
    .cpu-label { font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; }

    .quota-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
    .quota-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; }
    .quota-card.pressure { border-left: 3px solid var(--warning); }
    .quota-card.critical { border-left: 3px solid var(--danger); }
    .quota-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .quota-resource { font-size: 13px; font-weight: 600; }
    .quota-pct { font-size: 14px; font-weight: 800; }
    .pct-warn { color: var(--warning); }
    .pct-crit { color: var(--danger); }
    .quota-bar { height: 6px; border-radius: 3px; background: var(--bg-elevated); overflow: hidden; margin-bottom: 6px; }
    .quota-fill { height: 100%; background: var(--success); border-radius: 3px; transition: width 0.3s; }
    .fill-warn { background: var(--warning); }
    .fill-crit { background: var(--danger); }
    .quota-detail { font-size: 11px; color: var(--text-muted); }

    .empty-section {
      padding: 24px; text-align: center; color: var(--text-muted); font-size: 13px;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
      display: flex; align-items: center; justify-content: center; gap: 8px;
    }
    .empty-section i { color: var(--success); }

    @media (max-width: 768px) { .signal-cards { grid-template-columns: repeat(2, 1fr); } }
  `],
})
export class HealthSignalsComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private router = inject(Router);

  signals: any = null;
  oomkills: any[] = [];
  hpa: any[] = [];
  quotas: any[] = [];
  rollouts: any[] = [];
  loading = false;
  lastUpdated = '';
  private timer: any;

  relatedPages = [
    { path: '/monitor', icon: 'pi pi-desktop', label: 'Monitor', description: 'Multi-cluster card view' },
    { path: '/pods', icon: 'pi pi-box', label: 'Pods', description: 'Pod list and status' },
    { path: '/deployments', icon: 'pi pi-send', label: 'Deployments', description: 'Rollout management' },
    { path: '/rightsizing', icon: 'pi pi-sliders-h', label: 'Right-Sizing', description: 'Resource recommendations' },
  ];

  ngOnInit() { this.refresh(); this.timer = setInterval(() => this.refresh(), 60000); }
  ngOnDestroy() { clearInterval(this.timer); }

  refresh() {
    this.loading = true;
    this.http.get<any>('/api/monitor/health-signals').subscribe({
      next: (res) => { this.signals = res; },
      error: () => { this.signals = { oomkills_24h: 0, hpa_at_max: 0, quota_pressure: 0, stalled_rollouts: 0 }; },
    });
    this.http.get<any>('/api/monitor/oomkills?hours=48').subscribe({
      next: (res) => { this.oomkills = res.oomkills || []; },
      error: () => { this.oomkills = []; },
    });
    this.http.get<any>('/api/monitor/hpa').subscribe({
      next: (res) => { this.hpa = (res.hpa || []).slice(0, 20); },
      error: () => { this.hpa = []; },
    });
    this.http.get<any>('/api/monitor/quotas').subscribe({
      next: (res) => { this.quotas = res.quotas || []; },
      error: () => { this.quotas = []; },
    });
    this.http.get<any>('/api/monitor/rollouts').subscribe({
      next: (res) => { this.rollouts = (res.rollouts || []).filter((r: any) => r.state !== 'complete'); this.loading = false; this.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); },
      error: () => { this.rollouts = []; this.loading = false; },
    });
  }

  scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  formatTime(ts: string): string {
    if (!ts) return '—';
    try { return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return ts.substring(0, 16); }
  }

  stateSeverity(state: string): "success" | "warn" | "danger" | "info" | "secondary" | "contrast" | undefined {
    if (state === 'complete') return 'success';
    if (state === 'progressing') return 'info';
    if (state === 'degraded' || state === 'stalled') return 'danger';
    return 'warn';
  }
}
