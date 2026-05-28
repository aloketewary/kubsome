import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TabsModule } from 'primeng/tabs';
import { SelectButtonModule } from 'primeng/selectbutton';
import { FormsModule } from '@angular/forms';
import { PageInfoComponent } from '../../shared/components/page-info.component';
import { SpotlightComponent } from '../../shared/components/spotlight.component';
import { RelatedPagesComponent } from '../../shared/components/related-pages.component';

@Component({
  selector: 'app-chargeback',
  standalone: true,
  imports: [CommonModule, ButtonModule, TagModule, TabsModule, SelectButtonModule, FormsModule, PageInfoComponent, SpotlightComponent, RelatedPagesComponent],
  template: `
    <app-spotlight id="chargeback" title="Cost Chargeback" icon="pi pi-wallet"
      description="Label-based cost attribution — map cloud spend to teams, apps, and environments."
      [capabilities]="['Team cost breakdown', 'App-level attribution', 'Namespace billing', 'OpenCost integration', 'CSV/Markdown export']" [compact]="true" />

    <div class="page-header">
      <div>
        <h1>Chargeback</h1>
        <p class="subtitle">Cost attribution across teams, apps & namespaces</p>
      </div>
      <div class="header-actions">
        <p-selectbutton [options]="periodOptions" [(ngModel)]="days" (onChange)="refresh()" optionLabel="label" optionValue="value" size="small" />
        <button pButton icon="pi pi-download" label="Export" class="p-button-outlined p-button-sm" (click)="exportReport('csv')" [disabled]="!hasData"></button>
        <button pButton icon="pi pi-refresh" class="p-button-outlined p-button-sm p-button-rounded" (click)="refresh()" [loading]="loading"></button>
      </div>
    </div>

    <app-page-info title="Chargeback" description="Maps resource usage to teams via Kubernetes labels. Blends with OpenCost or cloud billing CSV for accurate showback."
      [tips]="['Label pods with team/app/env for attribution', 'Import OpenCost data for real cloud costs', 'Unattributed = missing team label']"
      [commands]="['chargeback', 'chargeback team', 'chargeback app', 'chargeback namespace']" />

    <!-- Hero Metrics -->
    @if (hasData) {
      <div class="metrics-grid">
        <div class="metric-card primary">
          <div class="mc-icon"><i class="pi pi-dollar"></i></div>
          <div class="mc-body">
            <span class="mc-value">{{ '$' + totalCost.toFixed(2) }}</span>
            <span class="mc-label">Total Spend ({{ days }}d)</span>
          </div>
        </div>
        <div class="metric-card">
          <div class="mc-icon"><i class="pi pi-users"></i></div>
          <div class="mc-body">
            <span class="mc-value">{{ teamData.length }}</span>
            <span class="mc-label">Teams</span>
          </div>
        </div>
        <div class="metric-card">
          <div class="mc-icon"><i class="pi pi-box"></i></div>
          <div class="mc-body">
            <span class="mc-value">{{ appData.length }}</span>
            <span class="mc-label">Applications</span>
          </div>
        </div>
        <div class="metric-card" [class.warn]="unattributedPct > 30">
          <div class="mc-icon"><i class="pi pi-exclamation-triangle"></i></div>
          <div class="mc-body">
            <span class="mc-value">{{ unattributedPct }}%</span>
            <span class="mc-label">Unattributed</span>
          </div>
        </div>
      </div>
    }

    <!-- Treemap (top 6 teams) -->
    @if (teamData.length > 0) {
      <div class="treemap-section">
        <h3 class="section-title">Cost Distribution</h3>
        <div class="treemap">
          @for (item of teamData.slice(0, 8); track item.team; let i = $index) {
            <div class="treemap-block" [style.flex-grow]="item.cost_usd" [class]="'tm-color-' + (i % 6)">
              <span class="tm-name">{{ item.team }}</span>
              <span class="tm-cost">{{ '$' + item.cost_usd.toFixed(0) }}</span>
              <span class="tm-pct">{{ costPct(item.cost_usd) }}%</span>
            </div>
          }
        </div>
      </div>
    }

    <!-- Detail Tabs -->
    <p-tabs [value]="activeTab" (valueChange)="activeTab = '' + $event">
      <p-tablist>
        <p-tab value="0"><i class="pi pi-users"></i> By Team</p-tab>
        <p-tab value="1"><i class="pi pi-box"></i> By App</p-tab>
        <p-tab value="2"><i class="pi pi-server"></i> By Namespace</p-tab>
        <p-tab value="3"><i class="pi pi-globe"></i> By Environment</p-tab>
      </p-tablist>

      <p-tabpanels>
        <!-- By Team -->
        <p-tabpanel value="0">
          @if (!teamData.length && !loading) {
            <div class="empty-state">
              <i class="pi pi-tag"></i>
              <h4>No team attribution data</h4>
              <p>Add labels to your deployments:</p>
              <code>kubectl label deployment &lt;name&gt; team=&lt;team-name&gt;</code>
            </div>
          }
          @if (teamData.length) {
            <div class="data-table">
              <div class="dt-header">
                <span class="dt-col dt-col-name">Team</span>
                <span class="dt-col dt-col-num">Deployments</span>
                <span class="dt-col dt-col-num">CPU (avg)</span>
                <span class="dt-col dt-col-num">Memory (avg)</span>
                <span class="dt-col dt-col-num">Share</span>
                <span class="dt-col dt-col-cost">Cost</span>
              </div>
              @for (item of teamData; track item.team) {
                <div class="dt-row" [class.unattributed]="item.team === 'unattributed'">
                  <span class="dt-col dt-col-name">
                    <span class="dt-dot" [class]="'dot-' + (teamData.indexOf(item) % 6)"></span>
                    {{ item.team }}
                  </span>
                  <span class="dt-col dt-col-num">{{ item.deployments }}</span>
                  <span class="dt-col dt-col-num">{{ item.cpu_avg_m }}m</span>
                  <span class="dt-col dt-col-num">{{ item.mem_avg_mb }}Mi</span>
                  <span class="dt-col dt-col-num">
                    <div class="share-bar"><div class="share-fill" [style.width.%]="costPct(item.cost_usd)"></div></div>
                    {{ costPct(item.cost_usd) }}%
                  </span>
                  <span class="dt-col dt-col-cost">{{ '$' + item.cost_usd.toFixed(2) }}</span>
                </div>
              }
              <div class="dt-footer">
                <span class="dt-col dt-col-name"><strong>Total</strong></span>
                <span class="dt-col dt-col-num"></span>
                <span class="dt-col dt-col-num"></span>
                <span class="dt-col dt-col-num"></span>
                <span class="dt-col dt-col-num"></span>
                <span class="dt-col dt-col-cost"><strong>{{ '$' + totalCost.toFixed(2) }}</strong></span>
              </div>
            </div>
          }
        </p-tabpanel>

        <!-- By App -->
        <p-tabpanel value="1">
          @if (!appData.length && !loading) {
            <div class="empty-state">
              <i class="pi pi-box"></i>
              <h4>No app attribution data</h4>
              <p>Label deployments with <code>app</code> or <code>app.kubernetes.io/name</code></p>
            </div>
          }
          @if (appData.length) {
            <div class="data-table">
              <div class="dt-header">
                <span class="dt-col dt-col-name">Application</span>
                <span class="dt-col dt-col-tag">Team</span>
                <span class="dt-col dt-col-tag">Namespace</span>
                <span class="dt-col dt-col-num">Pods</span>
                <span class="dt-col dt-col-num">CPU</span>
                <span class="dt-col dt-col-num">Memory</span>
                <span class="dt-col dt-col-cost">Cost</span>
              </div>
              @for (item of appData; track item.app) {
                <div class="dt-row">
                  <span class="dt-col dt-col-name"><strong>{{ item.app }}</strong></span>
                  <span class="dt-col dt-col-tag"><p-tag [value]="item.team" severity="secondary" [rounded]="true" /></span>
                  <span class="dt-col dt-col-tag"><p-tag [value]="item.namespace" severity="info" [rounded]="true" /></span>
                  <span class="dt-col dt-col-num">{{ item.avg_pods }}</span>
                  <span class="dt-col dt-col-num">{{ item.cpu_avg_m }}m</span>
                  <span class="dt-col dt-col-num">{{ item.mem_avg_mb }}Mi</span>
                  <span class="dt-col dt-col-cost">{{ '$' + item.cost_usd.toFixed(2) }}</span>
                </div>
              }
            </div>
          }
        </p-tabpanel>

        <!-- By Namespace -->
        <p-tabpanel value="2">
          @if (!nsData.length && !loading) {
            <div class="empty-state">
              <i class="pi pi-server"></i>
              <h4>No namespace data</h4>
              <p>Requires 24h+ of metrics collection</p>
            </div>
          }
          @if (nsData.length) {
            <div class="data-table">
              <div class="dt-header">
                <span class="dt-col dt-col-name">Namespace</span>
                <span class="dt-col dt-col-num">Deployments</span>
                <span class="dt-col dt-col-num">Pods</span>
                <span class="dt-col dt-col-num">CPU</span>
                <span class="dt-col dt-col-num">Memory</span>
                <span class="dt-col dt-col-num">Share</span>
                <span class="dt-col dt-col-cost">Cost</span>
              </div>
              @for (item of nsData; track item.namespace) {
                <div class="dt-row">
                  <span class="dt-col dt-col-name"><strong>{{ item.namespace }}</strong></span>
                  <span class="dt-col dt-col-num">{{ item.deployments }}</span>
                  <span class="dt-col dt-col-num">{{ item.avg_pods }}</span>
                  <span class="dt-col dt-col-num">{{ item.cpu_avg_m }}m</span>
                  <span class="dt-col dt-col-num">{{ item.mem_avg_mb }}Mi</span>
                  <span class="dt-col dt-col-num">
                    <div class="share-bar"><div class="share-fill share-fill-ns" [style.width.%]="costPct(item.cost_usd)"></div></div>
                    {{ costPct(item.cost_usd) }}%
                  </span>
                  <span class="dt-col dt-col-cost">{{ '$' + item.cost_usd.toFixed(2) }}</span>
                </div>
              }
            </div>
          }
        </p-tabpanel>

        <!-- By Environment -->
        <p-tabpanel value="3">
          @if (!envData.length && !loading) {
            <div class="empty-state">
              <i class="pi pi-globe"></i>
              <h4>No environment data</h4>
              <p>Label with <code>env</code> or <code>app.kubernetes.io/env</code></p>
            </div>
          }
          @if (envData.length) {
            <div class="env-cards">
              @for (item of envData; track item.env) {
                <div class="env-card" [class]="'env-' + item.env.toLowerCase()">
                  <div class="ec-header">
                    <span class="ec-name">{{ item.env }}</span>
                    <span class="ec-cost">{{ '$' + item.cost_usd.toFixed(2) }}</span>
                  </div>
                  <div class="ec-bar"><div class="ec-fill" [style.width.%]="barPct(item.cost_usd, envMax)"></div></div>
                  <div class="ec-meta">{{ item.deployments }} deployments · {{ costPct(item.cost_usd) }}% of total</div>
                </div>
              }
            </div>
          }
        </p-tabpanel>
      </p-tabpanels>
    </p-tabs>

    @if (loading && !hasData) {
      <div class="loading-state">
        <div class="loader"></div>
        <span>Loading cost attribution data...</span>
      </div>
    }

    <app-related-pages label="Related" [pages]="relatedPages" />
  `,
  styles: [`
    :host { display: block; }

    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
    .page-header h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.04em; margin: 0; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 2px; }
    .header-actions { display: flex; align-items: center; gap: 10px; }

    /* Hero Metrics */
    .metrics-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px; margin-bottom: 24px;
    }
    .metric-card {
      display: flex; align-items: center; gap: 14px;
      padding: 18px 20px; border-radius: 12px;
      background: var(--bg-card); border: 1px solid var(--border);
      transition: all 0.15s;
    }
    .metric-card:hover { border-color: var(--accent); box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
    .metric-card.primary { border-color: var(--accent); background: var(--accent-subtle); }
    .metric-card.warn .mc-value { color: var(--warning); }
    .mc-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: var(--bg-elevated); font-size: 18px; color: var(--accent); }
    .metric-card.warn .mc-icon { color: var(--warning); }
    .mc-body { display: flex; flex-direction: column; }
    .mc-value { font-size: 24px; font-weight: 800; line-height: 1.1; color: var(--text); }
    .mc-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-top: 2px; }

    /* Treemap */
    .treemap-section { margin-bottom: 24px; }
    .section-title { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 10px; }
    .treemap { display: flex; gap: 4px; height: 80px; border-radius: 10px; overflow: hidden; }
    .treemap-block {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-width: 60px; padding: 8px 12px; border-radius: 6px;
      transition: all 0.2s; cursor: default; position: relative; overflow: hidden;
    }
    .treemap-block:hover { filter: brightness(1.1); transform: scaleY(1.04); }
    .tm-color-0 { background: var(--accent); color: white; }
    .tm-color-1 { background: #06b6d4; color: white; }
    .tm-color-2 { background: var(--success); color: white; }
    .tm-color-3 { background: var(--warning); color: white; }
    .tm-color-4 { background: var(--danger); color: white; }
    .tm-color-5 { background: var(--purple); color: white; }
    .tm-name { font-size: 11px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
    .tm-cost { font-size: 14px; font-weight: 800; }
    .tm-pct { font-size: 10px; opacity: 0.8; }

    /* Data Table */
    .data-table { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
    .dt-header { display: flex; padding: 10px 16px; background: var(--bg-elevated); border-bottom: 1px solid var(--border); }
    .dt-header .dt-col { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); }
    .dt-row { display: flex; padding: 12px 16px; border-bottom: 1px solid var(--border); align-items: center; transition: background 0.1s; }
    .dt-row:last-child { border-bottom: none; }
    .dt-row:hover { background: var(--bg-elevated); }
    .dt-row.unattributed { opacity: 0.6; }
    .dt-footer { display: flex; padding: 12px 16px; background: var(--bg-elevated); border-top: 1px solid var(--border); }
    .dt-col { font-size: 13px; }
    .dt-col-name { flex: 2; display: flex; align-items: center; gap: 8px; }
    .dt-col-tag { flex: 1.2; }
    .dt-col-num { flex: 1; text-align: right; font-variant-numeric: tabular-nums; }
    .dt-col-cost { flex: 1; text-align: right; font-weight: 700; color: var(--success); font-variant-numeric: tabular-nums; font-family: 'JetBrains Mono', monospace; font-size: 12px; }

    .dt-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .dot-0 { background: var(--accent); }
    .dot-1 { background: #06b6d4; }
    .dot-2 { background: var(--success); }
    .dot-3 { background: var(--warning); }
    .dot-4 { background: var(--danger); }
    .dot-5 { background: var(--purple); }

    .share-bar { width: 48px; height: 6px; border-radius: 3px; background: var(--bg-elevated); display: inline-block; vertical-align: middle; margin-right: 6px; overflow: hidden; }
    .share-fill { height: 100%; border-radius: 3px; background: var(--accent); transition: width 0.3s; }
    .share-fill-ns { background: var(--success); }

    /* Environment Cards */
    .env-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
    .env-card { padding: 20px; border-radius: 12px; background: var(--bg-card); border: 1px solid var(--border); }
    .env-card:hover { border-color: var(--accent); }
    .ec-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
    .ec-name { font-size: 16px; font-weight: 700; text-transform: capitalize; color: var(--text); }
    .ec-cost { font-size: 18px; font-weight: 800; color: var(--success); }
    .ec-bar { height: 8px; border-radius: 4px; background: var(--bg-elevated); overflow: hidden; margin-bottom: 8px; }
    .ec-fill { height: 100%; border-radius: 4px; background: var(--accent); transition: width 0.3s; }
    .ec-meta { font-size: 11px; color: var(--text-muted); }
    .env-production .ec-fill, .env-prod .ec-fill { background: var(--danger); }
    .env-staging .ec-fill, .env-stg .ec-fill { background: var(--warning); }
    .env-development .ec-fill, .env-dev .ec-fill { background: var(--success); }

    /* Empty & Loading States */
    .empty-state { padding: 48px 24px; text-align: center; }
    .empty-state i { font-size: 32px; color: var(--text-muted); opacity: 0.4; margin-bottom: 12px; display: block; }
    .empty-state h4 { font-size: 15px; font-weight: 600; margin: 0 0 6px; color: var(--text); }
    .empty-state p { font-size: 13px; color: var(--text-muted); margin: 0 0 12px; }
    .empty-state code { display: inline-block; background: var(--bg-elevated); padding: 6px 12px; border-radius: 6px; font-size: 12px; color: var(--text-secondary); border: 1px solid var(--border); }

    .loading-state { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 80px; color: var(--text-muted); font-size: 13px; }
    .loader { width: 20px; height: 20px; border: 2.5px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.6s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (max-width: 768px) {
      .page-header { flex-direction: column; gap: 12px; }
      .header-actions { flex-wrap: wrap; }
      .summary-cards { grid-template-columns: repeat(2, 1fr); }
      .env-cards { grid-template-columns: 1fr; }
    }
  `],
})
export class ChargebackComponent implements OnInit {
  private http = inject(HttpClient);

  teamData: any[] = [];
  appData: any[] = [];
  nsData: any[] = [];
  envData: any[] = [];
  loading = false;
  activeTab = '0';
  days = 30;
  totalCost = 0;
  appMax = 0;
  nsMax = 0;
  envMax = 0;
  unattributedPct = 0;

  periodOptions = [
    { label: '7d', value: 7 },
    { label: '14d', value: 14 },
    { label: '30d', value: 30 },
    { label: '90d', value: 90 },
  ];

  get hasData() { return this.teamData.length > 0 || this.nsData.length > 0; }

  relatedPages = [
    { path: '/analytics', icon: 'pi pi-chart-bar', label: 'Analytics', description: 'Raw metrics and SQL queries' },
    { path: '/cost', icon: 'pi pi-dollar', label: 'Optimization', description: 'Resource optimization' },
    { path: '/rightsizing', icon: 'pi pi-sliders-h', label: 'Right-Sizing', description: 'Reduce waste per deployment' },
    { path: '/cost-estimate', icon: 'pi pi-calculator', label: 'Cost Estimate', description: 'Per-deployment cost' },
  ];

  ngOnInit() { this.refresh(); }

  refresh() {
    this.loading = true;
    this.http.get<any>(`/api/chargeback/by-team?days=${this.days}`).subscribe({
      next: (res) => {
        this.teamData = res.items || [];
        this.totalCost = this.teamData.reduce((s: number, i: any) => s + (i.cost_usd || 0), 0);
        const unattr = this.teamData.find((i: any) => i.team === 'unattributed');
        this.unattributedPct = this.totalCost > 0 && unattr
          ? Math.round((unattr.cost_usd / this.totalCost) * 100) : 0;
      },
      error: () => { this.teamData = []; },
    });
    this.http.get<any>(`/api/chargeback/by-app?days=${this.days}`).subscribe({
      next: (res) => {
        this.appData = res.items || [];
        this.appMax = Math.max(...this.appData.map((i: any) => i.cost_usd || 0), 1);
      },
      error: () => { this.appData = []; },
    });
    this.http.get<any>(`/api/chargeback/by-namespace?days=${this.days}`).subscribe({
      next: (res) => {
        this.nsData = res.items || [];
        this.nsMax = Math.max(...this.nsData.map((i: any) => i.cost_usd || 0), 1);
        this.loading = false;
      },
      error: () => { this.nsData = []; this.loading = false; },
    });
    this.http.get<any>(`/api/chargeback/by-environment?days=${this.days}`).subscribe({
      next: (res) => {
        this.envData = res.items || [];
        this.envMax = Math.max(...this.envData.map((i: any) => i.cost_usd || 0), 1);
      },
      error: () => { this.envData = []; },
    });
  }

  exportReport(format: string) {
    this.http.post<any>('/api/chargeback/report', {
      days: this.days, group_by: 'team', format
    }).subscribe({
      next: (res) => {
        if (typeof res === 'string') { alert(`Exported: ${res}`); }
        else if (res.error) { alert(res.error); }
        else { alert('Report generated'); }
      },
      error: () => { alert('Export failed'); },
    });
  }

  barPct(cost: number, max?: number): number {
    const m = max || this.totalCost;
    return m > 0 ? Math.round((cost / m) * 100) : 0;
  }

  costPct(cost: number): number {
    return this.totalCost > 0 ? Math.round((cost / this.totalCost) * 100) : 0;
  }
}
