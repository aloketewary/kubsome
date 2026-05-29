import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TabsModule } from 'primeng/tabs';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { SpotlightComponent } from '../../shared/components/spotlight.component';
import { RelatedPagesComponent } from '../../shared/components/related-pages.component';
import { ConfirmService } from '../../shared/services/confirm.service';
import { HoloCardComponent, MetricTileComponent, StatusBeaconComponent, CommandBarComponent, LiveIndicatorComponent } from '../../shared/components/futuristic';
import type { CommandPill } from '../../shared/components/futuristic/command-bar.component';

@Component({
  selector: 'app-rightsizing',
  standalone: true,
  imports: [ButtonModule, TagModule, TabsModule, TooltipModule, FormsModule, InputTextModule, SpotlightComponent, RelatedPagesComponent, HoloCardComponent, MetricTileComponent, StatusBeaconComponent, CommandBarComponent, LiveIndicatorComponent],
  template: `
    <app-spotlight id="rightsizing" title="Right-Sizing" icon="pi pi-sliders-h"
      description="Data-driven CPU/memory recommendations based on actual P95 usage."
      [capabilities]="['P95-based requests', 'P99-based limits', 'Safe rollout phases', 'YAML patch export']" [compact]="true" />

    <!-- Header -->
    <div class="intel-header">
      <div class="intel-title-block">
        <h1 class="intel-title"><span class="title-icon">⚙</span> Right-Sizing</h1>
        <p class="intel-subtitle">{{ (filteredRecs.length || 0) }} recommendations · {{ lastUpdated || 'loading...' }}</p>
      </div>
      <div class="intel-controls">
        <app-live-indicator [active]="autoRefresh" label="AUTO" offLabel="PAUSED" (click)="toggleAutoRefresh()" />
        <button class="ctrl-btn" (click)="dryRun()" pTooltip="Dry Run" [disabled]="!data?.recommendations?.length || dryRunning">
          <i class="pi pi-check-circle" [class.spinning]="dryRunning"></i>
        </button>
        <button class="ctrl-btn" (click)="exportGitops()" pTooltip="GitOps" [disabled]="!data?.recommendations?.length">
          <i class="pi pi-code"></i>
        </button>
        <button class="ctrl-btn" (click)="exportYaml()" pTooltip="Export YAML" [disabled]="!data?.recommendations?.length">
          <i class="pi pi-download"></i>
        </button>
        <button class="ctrl-btn" (click)="refresh()" pTooltip="Refresh">
          <i class="pi pi-refresh" [class.spinning]="loading"></i>
        </button>
      </div>
    </div>

    @if (!data && !loading) {
      <div class="empty-state"><div class="empty-icon"><i class="pi pi-sliders-h"></i></div><span>No analytics data</span><span class="empty-hint">Need at least 12 hours of metrics collection</span></div>
    }

    @if (loading && !data) {
      <div class="loading-state"><div class="loader-ring"></div><span>Analyzing resource usage...</span></div>
    }

    @if (data) {
      <!-- Metrics Strip -->
      <div class="metrics-strip">
        <app-metric-tile label="Deployments" [value]="'' + data.summary.deployments" accent="cyan" />
        <app-metric-tile label="CPU Util" [value]="data.summary.cpu_util_pct + '%'" [accent]="data.summary.cpu_util_pct < 40 ? 'amber' : 'green'" />
        <app-metric-tile label="Mem Util" [value]="data.summary.mem_util_pct + '%'" [accent]="data.summary.mem_util_pct < 40 ? 'amber' : 'green'" />
        <app-metric-tile label="Savings" [value]="'$' + data.total_monthly_savings_usd?.toFixed(0)" accent="green" />
      </div>

      <!-- Tabs -->
      <p-tabs [value]="activeTab" (valueChange)="activeTab = '' + $event">
        <p-tablist>
          <p-tab value="0">Recommendations ({{ filteredRecs.length }})</p-tab>
          <p-tab value="1">At Risk ({{ data.underprovisioned_count }})</p-tab>
          <p-tab value="2">Rollout Plan</p-tab>
        </p-tablist>

        <p-tabpanels>
          <!-- Recommendations -->
          <p-tabpanel value="0">
            <app-command-bar [pills]="filterPills" [activePill]="riskFilter" [search]="searchQuery" placeholder="Filter deployments..." (pillChange)="onRiskFilterChange($event)" (searchChange)="onSearchChange($event)" />

            @for (rec of filteredRecs; track rec.deployment) {
              <div class="rec-card" [class.risk-low]="rec.risk === 'low'" [class.risk-medium]="rec.risk === 'medium'" [class.risk-high]="rec.risk === 'high'">
                <div class="rec-header">
                  <div class="rec-title">
                    <app-status-beacon [status]="rec.risk === 'high' ? 'critical' : rec.risk === 'medium' ? 'warning' : 'ok'" size="sm" />
                    <strong>{{ rec.deployment }}</strong>
                    <span class="rec-ns">{{ rec.namespace }}</span>
                  </div>
                  <div class="rec-meta">
                    <span class="confidence">{{ rec.confidence }}%</span>
                    <p-tag [value]="rec.risk" [severity]="riskSeverity(rec.risk)" [rounded]="true" size="small" />
                    <span class="savings">{{'$' + rec.total_savings_monthly?.toFixed(2)}}/mo</span>
                  </div>
                </div>
                <div class="rec-body">
                  <div class="resource-row">
                    <span class="res-label">CPU</span>
                    <span class="current">{{ rec.current.cpu_request }}m</span>
                    <span class="arrow">→</span>
                    <span class="recommended">{{ rec.recommended.cpu_request }}m</span>
                    <span class="limit">lim {{ rec.recommended.cpu_limit }}m</span>
                    <span class="usage-stats">P95={{ rec.usage.cpu_p95 }}m</span>
                    @if (rec.usage.cpu_volatile) { <span class="volatile">⚡</span> }
                  </div>
                  <div class="resource-row">
                    <span class="res-label">Mem</span>
                    <span class="current">{{ rec.current.mem_request }}Mi</span>
                    <span class="arrow">→</span>
                    <span class="recommended">{{ rec.recommended.mem_request }}Mi</span>
                    <span class="limit">lim {{ rec.recommended.mem_limit }}Mi</span>
                    <span class="usage-stats">P95={{ rec.usage.mem_p95 }}Mi</span>
                    @if (rec.usage.mem_volatile) { <span class="volatile">⚡</span> }
                  </div>
                </div>
              </div>
            }
            @if (!filteredRecs.length && !searchQuery) {
              <div class="empty-state"><div class="empty-icon"><i class="pi pi-check-circle"></i></div><span>All deployments well-sized</span></div>
            }
            @if (!filteredRecs.length && searchQuery) {
              <div class="empty-state"><div class="empty-icon"><i class="pi pi-search"></i></div><span>No match for "{{ searchQuery }}"</span></div>
            }
          </p-tabpanel>

          <!-- At Risk -->
          <p-tabpanel value="1">
            @for (item of data.at_risk; track item.deployment) {
              <div class="rec-card risk-high">
                <div class="rec-header">
                  <div class="rec-title">
                    <app-status-beacon status="critical" size="sm" [pulse]="true" />
                    <strong>{{ item.deployment }}</strong>
                    <span class="rec-ns">{{ item.namespace }}</span>
                  </div>
                  <p-tag value="at risk" severity="danger" [rounded]="true" size="small" />
                </div>
                <div class="rec-body">
                  <div class="resource-row">
                    <span class="res-label">CPU</span>
                    <span class="usage-stats">{{ item.cpu_util_pct }}% · {{ item.cpu_p95 }}m / {{ item.cpu_request }}m</span>
                  </div>
                  <div class="resource-row">
                    <span class="res-label">Mem</span>
                    <span class="usage-stats">{{ item.mem_util_pct }}% · {{ item.mem_p95 }}Mi / {{ item.mem_request }}Mi</span>
                  </div>
                  @if (item.restarts > 0) { <span class="restarts">↻ {{ item.restarts }} restarts</span> }
                </div>
              </div>
            }
            @if (!data.at_risk?.length) {
              <div class="empty-state"><div class="empty-icon"><i class="pi pi-check-circle"></i></div><span>No workloads at risk</span></div>
            }
          </p-tabpanel>

          <!-- Rollout Plan -->
          <p-tabpanel value="2">
            @if (data.rollout_plan) {
              @for (phase of phases; track phase.key) {
                <app-holo-card [title]="phase.data.label" [glow]="phase.key === 'phase_1' ? 'green' : phase.key === 'phase_2' ? 'amber' : 'red'" [compact]="true">
                  @if (phase.data.auto_apply) { <span header-actions><p-tag value="auto-safe" severity="success" [rounded]="true" size="small" /></span> }
                  @for (item of phase.data.items; track item.deployment) {
                    <div class="phase-item">
                      <app-status-beacon status="ok" size="sm" />
                      <span class="phase-dep">{{ item.deployment }}</span>
                      <span class="phase-savings">{{'$' + item.total_savings_monthly?.toFixed(2)}}/mo</span>
                    </div>
                  }
                  @if (!phase.data.items?.length) {
                    <span class="empty-hint">No items in this phase</span>
                  }
                </app-holo-card>
              }
            }
          </p-tabpanel>
        </p-tabpanels>
      </p-tabs>

      <!-- Methodology -->
      <div class="methodology">
        <strong>Methodology:</strong>
        Request = {{ data.methodology?.request_formula }} · Limit = {{ data.methodology?.limit_formula }} · Source: {{ data.methodology?.data_source }}
      </div>
    }

    <app-related-pages label="Related" [pages]="relatedPages" />

    @if (toast) {
      <div class="inline-toast" [class.toast-success]="toast.severity === 'success'" [class.toast-danger]="toast.severity === 'danger'" [class.toast-info]="toast.severity === 'info'">
        <i class="pi" [class.pi-check-circle]="toast.severity === 'success'" [class.pi-times-circle]="toast.severity === 'danger'" [class.pi-info-circle]="toast.severity === 'info'"></i>
        <span>{{ toast.message }}</span>
        <button class="toast-close" (click)="toast = null"><i class="pi pi-times"></i></button>
      </div>
    }
  `,
  styles: [`
    @use '../../styles/futuristic' as *;
    :host { display: block; width: 100%; }
    .title-icon { color: #00d4ff; }

    /* ─── Rec Cards ───────────────────────────────────────────────── */
    .rec-card {
      padding: 14px 16px; margin-bottom: 6px; border-radius: 10px;
      background: linear-gradient(180deg, rgba(13,17,28,0.75) 0%, rgba(8,11,20,0.8) 100%);
      border: 1px solid rgba(255,255,255,0.04); transition: all 0.2s;
    }
    .rec-card:hover { border-color: rgba(255,255,255,0.08); transform: translateY(-1px); box-shadow: 0 4px 16px -4px rgba(0,0,0,0.4); }
    .risk-low { border-left: 3px solid #10b981; }
    .risk-medium { border-left: 3px solid #f59e0b; }
    .risk-high { border-left: 3px solid #f43f5e; }

    .rec-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px; }
    .rec-title { display: flex; align-items: center; gap: 8px; }
    .rec-title strong { font-size: 12px; font-family: 'JetBrains Mono', monospace; color: rgba(255,255,255,0.85); }
    .rec-ns { font-size: 10px; color: rgba(255,255,255,0.3); }
    .rec-meta { display: flex; align-items: center; gap: 8px; }
    .confidence { font-size: 9px; font-family: 'JetBrains Mono', monospace; color: rgba(255,255,255,0.3); }
    .savings { font-size: 11px; font-weight: 700; color: #10b981; font-family: 'JetBrains Mono', monospace; }

    .rec-body { display: flex; flex-direction: column; gap: 6px; }
    .resource-row { display: flex; align-items: center; gap: 8px; font-size: 11px; flex-wrap: wrap; }
    .res-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: rgba(255,255,255,0.3); min-width: 28px; }
    .current { color: rgba(255,255,255,0.35); text-decoration: line-through; font-family: 'JetBrains Mono', monospace; font-size: 10px; }
    .arrow { color: #00d4ff; font-size: 10px; }
    .recommended { font-weight: 700; color: #00d4ff; font-family: 'JetBrains Mono', monospace; font-size: 10px; }
    .limit { font-size: 9px; color: rgba(255,255,255,0.2); font-family: 'JetBrains Mono', monospace; }
    .usage-stats { font-size: 9px; color: rgba(255,255,255,0.25); font-family: 'JetBrains Mono', monospace; }
    .volatile { color: #f59e0b; font-weight: 700; }
    .restarts { font-size: 10px; color: #f43f5e; margin-top: 4px; }

    /* ─── Phase Items ────────────────────────────────────────────── */
    .phase-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; font-size: 11px; color: rgba(255,255,255,0.6); transition: background 0.12s; }
    .phase-item:hover { background: rgba(255,255,255,0.02); }
    .phase-dep { font-family: 'JetBrains Mono', monospace; font-size: 11px; flex: 1; }
    .phase-savings { font-size: 10px; color: #10b981; font-family: 'JetBrains Mono', monospace; }

    /* ─── Methodology ────────────────────────────────────────────── */
    .methodology {
      font-size: 10px; color: rgba(255,255,255,0.25); margin-top: 16px; padding: 10px 14px;
      background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.04); border-radius: 8px;
      font-family: 'JetBrains Mono', monospace;
    }
    .methodology strong { color: rgba(255,255,255,0.4); }

    /* ─── Toast ─────────────────────────────────────────────────── */
    .inline-toast {
      position: fixed; bottom: 24px; right: 24px; z-index: 9000;
      display: flex; align-items: center; gap: 10px;
      padding: 10px 14px; border-radius: 8px;
      background: linear-gradient(180deg, rgba(13,17,28,0.95) 0%, rgba(8,11,20,0.98) 100%);
      border: 1px solid rgba(255,255,255,0.06);
      box-shadow: 0 8px 30px rgba(0,0,0,0.5); font-size: 11px; color: rgba(255,255,255,0.7);
      animation: slideIn 0.2s ease-out;
    }
    @keyframes slideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    .toast-success { border-left: 3px solid #10b981; }
    .toast-success i { color: #10b981; }
    .toast-danger { border-left: 3px solid #f43f5e; }
    .toast-danger i { color: #f43f5e; }
    .toast-info { border-left: 3px solid #00d4ff; }
    .toast-info i { color: #00d4ff; }
    .toast-close { background: none; border: none; color: rgba(255,255,255,0.3); cursor: pointer; padding: 2px; }
    .toast-close:hover { color: rgba(255,255,255,0.7); }

    /* ─── Empty/Loading ──────────────────────────────────────────── */
    .empty-state { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 20px; color: rgba(255,255,255,0.3); font-size: 12px; }
    .empty-icon { width: 40px; height: 40px; border-radius: 10px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); display: flex; align-items: center; justify-content: center; font-size: 16px; }
    .empty-hint { font-size: 10px; opacity: 0.5; }
    .loading-state { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 48px 20px; color: rgba(255,255,255,0.3); font-size: 12px; }
    .loader-ring { width: 24px; height: 24px; border: 2px solid rgba(0,212,255,0.1); border-top-color: #00d4ff; border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class RightsizingComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private confirmService = inject(ConfirmService);

  data: any = null;
  loading = false;
  dryRunning = false;
  activeTab = '0';
  phases: { key: string; data: any }[] = [];
  searchQuery = '';
  riskFilter = 'all';
  filteredRecs: any[] = [];
  autoRefresh = true;
  lastUpdated = '';
  toast: { message: string; severity: 'success' | 'danger' | 'info' } | null = null;
  private timer: any;

  get filterPills(): CommandPill[] {
    const recs = this.data?.recommendations || [];
    const low = recs.filter((r: any) => r.risk === 'low').length;
    const med = recs.filter((r: any) => r.risk === 'medium').length;
    const high = recs.filter((r: any) => r.risk === 'high').length;
    const pills: CommandPill[] = [{ label: 'All', value: 'all', count: recs.length }];
    if (low > 0) pills.push({ label: 'Low', value: 'low', count: low, color: 'green' });
    if (med > 0) pills.push({ label: 'Medium', value: 'medium', count: med, color: 'amber' });
    if (high > 0) pills.push({ label: 'High', value: 'high', count: high, color: 'red' });
    return pills;
  }

  onRiskFilterChange(v: string) { this.riskFilter = v; this.filter(); }
  onSearchChange(v: string) { this.searchQuery = v; this.filter(); }

  relatedPages = [
    { path: '/analytics', icon: 'pi pi-chart-bar', label: 'Analytics', description: 'Raw metrics data and SQL queries' },
    { path: '/cost', icon: 'pi pi-dollar', label: 'Optimization', description: 'Resource optimization overview' },
    { path: '/cost-estimate', icon: 'pi pi-calculator', label: 'Cost Estimate', description: 'Per-deployment cost breakdown' },
    { path: '/deployments', icon: 'pi pi-send', label: 'Deployments', description: 'Apply changes to deployments' },
  ];

  ngOnInit() { this.refresh(); this.startAutoRefresh(); }
  ngOnDestroy() { clearInterval(this.timer); }

  toggleAutoRefresh() {
    this.autoRefresh = !this.autoRefresh;
    if (this.autoRefresh) this.startAutoRefresh();
    else clearInterval(this.timer);
  }

  private startAutoRefresh() {
    clearInterval(this.timer);
    this.timer = setInterval(() => this.refresh(), 60000);
  }

  filter() {
    const q = this.searchQuery.toLowerCase();
    let recs = this.data?.recommendations || [];
    if (this.riskFilter !== 'all') recs = recs.filter((r: any) => r.risk === this.riskFilter);
    this.filteredRecs = q
      ? recs.filter((r: any) => r.deployment.toLowerCase().includes(q) || r.namespace?.toLowerCase().includes(q))
      : recs;
  }

  private showToast(message: string, severity: 'success' | 'danger' | 'info') {
    this.toast = { message, severity };
    setTimeout(() => { if (this.toast?.message === message) this.toast = null; }, 5000);
  }

  refresh() {
    this.loading = true;
    this.http.get<any>('/api/analytics/rightsizing').subscribe({
      next: (res) => {
        this.data = res;
        this.loading = false;
        this.filter();
        this.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        if (res.rollout_plan) {
          this.phases = Object.entries(res.rollout_plan)
            .map(([key, data]) => ({ key, data }));
        }
      },
      error: () => { this.data = null; this.loading = false; },
    });
  }

  exportYaml() {
    this.http.post<any>('/api/analytics/rightsizing/export', {}).subscribe({
      next: (res) => { this.showToast(`YAML exported to: ${res.path}`, 'success'); },
      error: () => { this.showToast('YAML export failed', 'danger'); },
    });
  }

  dryRun() {
    this.dryRunning = true;
    this.http.post<any>('/api/rightsizing/dry-run', {}).subscribe({
      next: (res) => {
        this.dryRunning = false;
        this.showToast(`Dry Run: ${res.passed} passed, ${res.failed} failed out of ${res.total}`, res.failed > 0 ? 'danger' : 'success');
      },
      error: () => { this.dryRunning = false; this.showToast('Dry run failed', 'danger'); },
    });
  }

  exportGitops() {
    this.confirmService.confirm({
      title: 'Export GitOps Manifests',
      message: 'This will generate kustomization patches for all recommendations. Ready to create a PR?',
      confirmLabel: 'Export',
      severity: 'info',
    }).then(ok => {
      if (!ok) return;
      this.http.post<any>('/api/rightsizing/gitops', { format: 'kustomize' }).subscribe({
        next: (res) => {
          this.showToast(res.path ? `GitOps output: ${res.path}` : (res.message || 'No recommendations to export'), res.path ? 'success' : 'info');
        },
        error: () => { this.showToast('GitOps export failed', 'danger'); },
      });
    });
  }

  riskSeverity(risk: string): "success" | "warn" | "danger" | "info" | "secondary" | "contrast" | undefined {
    if (risk === 'low') return 'success';
    if (risk === 'medium') return 'warn';
    return 'danger';
  }
}
