import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TabsModule } from 'primeng/tabs';
import { PageInfoComponent } from '../../shared/components/page-info.component';
import { SpotlightComponent } from '../../shared/components/spotlight.component';
import { RelatedPagesComponent } from '../../shared/components/related-pages.component';

@Component({
  selector: 'app-chargeback',
  standalone: true,
  imports: [ButtonModule, TagModule, TabsModule, PageInfoComponent, SpotlightComponent, RelatedPagesComponent],
  template: `
    <app-spotlight id="chargeback" title="Cost Chargeback" icon="pi pi-wallet"
      description="Label-based cost attribution — map cloud spend to teams, apps, and environments."
      [capabilities]="['Team cost breakdown', 'App-level attribution', 'Namespace billing', 'OpenCost integration', 'CSV/Markdown export']" [compact]="true" />

    <div class="page-header">
      <div>
        <h1>Chargeback</h1>
        <p class="subtitle">{{ totalCost ? '$' + totalCost.toFixed(2) + '/mo estimated' : 'Loading...' }} · {{ days }}d window</p>
      </div>
      <div class="header-actions">
        <button pButton icon="pi pi-file" label="Export CSV" class="p-button-outlined p-button-sm" (click)="exportReport('csv')" [disabled]="!hasData"></button>
        <button pButton icon="pi pi-file-edit" label="Export MD" class="p-button-outlined p-button-sm" (click)="exportReport('markdown')" [disabled]="!hasData"></button>
        <button pButton icon="pi pi-refresh" class="p-button-outlined p-button-sm p-button-rounded" (click)="refresh()" [loading]="loading"></button>
      </div>
      <app-page-info title="Chargeback" description="Maps resource usage to teams via Kubernetes labels. Blends with OpenCost or cloud billing CSV for accurate showback."
        [tips]="['Label pods with team/app/env for attribution', 'Import OpenCost data for real cloud costs', 'Unattributed = missing team label']"
        [commands]="['chargeback', 'chargeback team', 'chargeback app', 'chargeback namespace', 'showback']" />
    </div>

    <!-- Summary Strip -->
    @if (hasData) {
      <div class="summary-strip">
        <div class="ss-item">
          <span class="ss-value">{{ '$' + totalCost.toFixed(2) }}</span>
          <span class="ss-label">Total ({{ days }}d)</span>
        </div>
        <div class="ss-item">
          <span class="ss-value">{{ teamData.length }}</span>
          <span class="ss-label">Teams</span>
        </div>
        <div class="ss-item">
          <span class="ss-value">{{ appData.length }}</span>
          <span class="ss-label">Apps</span>
        </div>
        <div class="ss-item" [class.warn]="unattributedPct > 30">
          <span class="ss-value">{{ unattributedPct }}%</span>
          <span class="ss-label">Unattributed</span>
        </div>
      </div>
    }

    <!-- Tabs -->
    <p-tabs [value]="activeTab" (valueChange)="activeTab = '' + $event">
      <p-tablist>
        <p-tab value="0">By Team</p-tab>
        <p-tab value="1">By App</p-tab>
        <p-tab value="2">By Namespace</p-tab>
        <p-tab value="3">By Environment</p-tab>
      </p-tablist>

      <p-tabpanels>
        <!-- By Team -->
        <p-tabpanel value="0">
          @if (!teamData.length && !loading) {
            <div class="empty-tab">No team data. Label deployments with <code>team</code> or <code>app.kubernetes.io/team</code></div>
          }
          @for (item of teamData; track item.team) {
            <div class="cost-row">
              <div class="cr-bar-wrap">
                <div class="cr-bar" [style.width.%]="barPct(item.cost_usd)"></div>
              </div>
              <div class="cr-info">
                <strong>{{ item.team }}</strong>
                <span class="cr-meta">{{ item.deployments }} deployments · {{ item.cpu_avg_m }}m CPU · {{ item.mem_avg_mb }}Mi mem</span>
              </div>
              <div class="cr-cost">
                <span class="cr-amount">{{ '$' + item.cost_usd.toFixed(2) }}</span>
                <span class="cr-pct">{{ costPct(item.cost_usd) }}%</span>
              </div>
            </div>
          }
        </p-tabpanel>

        <!-- By App -->
        <p-tabpanel value="1">
          @if (!appData.length && !loading) {
            <div class="empty-tab">No app data. Label deployments with <code>app</code> or <code>app.kubernetes.io/name</code></div>
          }
          @for (item of appData; track item.app) {
            <div class="cost-row">
              <div class="cr-bar-wrap">
                <div class="cr-bar" [style.width.%]="barPct(item.cost_usd, appMax)"></div>
              </div>
              <div class="cr-info">
                <strong>{{ item.app }}</strong>
                <span class="cr-meta">
                  <p-tag [value]="item.team" severity="secondary" [rounded]="true" size="small" />
                  {{ item.namespace }} · {{ item.avg_pods }} pods
                </span>
              </div>
              <div class="cr-cost">
                <span class="cr-amount">{{ '$' + item.cost_usd.toFixed(2) }}</span>
              </div>
            </div>
          }
        </p-tabpanel>

        <!-- By Namespace -->
        <p-tabpanel value="2">
          @if (!nsData.length && !loading) {
            <div class="empty-tab">No namespace data yet. Need 24h+ of collection.</div>
          }
          @for (item of nsData; track item.namespace) {
            <div class="cost-row">
              <div class="cr-bar-wrap">
                <div class="cr-bar cr-bar-ns" [style.width.%]="barPct(item.cost_usd, nsMax)"></div>
              </div>
              <div class="cr-info">
                <strong>{{ item.namespace }}</strong>
                <span class="cr-meta">{{ item.deployments }} deployments · {{ item.avg_pods }} pods</span>
              </div>
              <div class="cr-cost">
                <span class="cr-amount">{{ '$' + item.cost_usd.toFixed(2) }}</span>
                <span class="cr-pct">{{ costPct(item.cost_usd) }}%</span>
              </div>
            </div>
          }
        </p-tabpanel>

        <!-- By Environment -->
        <p-tabpanel value="3">
          @if (!envData.length && !loading) {
            <div class="empty-tab">No environment data. Label with <code>env</code> or <code>app.kubernetes.io/env</code></div>
          }
          @for (item of envData; track item.env) {
            <div class="cost-row">
              <div class="cr-bar-wrap">
                <div class="cr-bar cr-bar-env" [style.width.%]="barPct(item.cost_usd, envMax)"></div>
              </div>
              <div class="cr-info">
                <strong>{{ item.env }}</strong>
                <span class="cr-meta">{{ item.deployments }} deployments</span>
              </div>
              <div class="cr-cost">
                <span class="cr-amount">{{ '$' + item.cost_usd.toFixed(2) }}</span>
                <span class="cr-pct">{{ costPct(item.cost_usd) }}%</span>
              </div>
            </div>
          }
        </p-tabpanel>
      </p-tabpanels>
    </p-tabs>

    @if (loading && !hasData) {
      <div class="loading"><div class="spin"></div> Loading cost data...</div>
    }

    <app-related-pages label="Related" [pages]="relatedPages" />
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .header-actions { display: flex; align-items: center; gap: 8px; }

    .summary-strip {
      display: flex; gap: 24px; padding: 14px 20px; margin-bottom: 20px;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
    }
    .ss-item { text-align: center; }
    .ss-item.warn .ss-value { color: var(--warning); }
    .ss-value { display: block; font-size: 22px; font-weight: 800; }
    .ss-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }

    .cost-row {
      display: flex; align-items: center; gap: 16px;
      padding: 14px 16px; margin-bottom: 6px;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
      transition: all 0.1s;
    }
    .cost-row:hover { border-color: var(--accent); transform: translateX(2px); }

    .cr-bar-wrap { width: 80px; height: 8px; border-radius: 4px; background: var(--bg-elevated); overflow: hidden; flex-shrink: 0; }
    .cr-bar { height: 100%; border-radius: 4px; background: var(--accent); transition: width 0.3s; }
    .cr-bar-ns { background: var(--success); }
    .cr-bar-env { background: var(--warning); }

    .cr-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .cr-info strong { font-size: 14px; }
    .cr-meta { font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 6px; }

    .cr-cost { text-align: right; min-width: 90px; }
    .cr-amount { display: block; font-size: 15px; font-weight: 700; color: var(--success); }
    .cr-pct { font-size: 11px; color: var(--text-muted); }

    .empty-tab { padding: 32px; text-align: center; color: var(--text-muted); font-size: 13px; }
    .empty-tab code { background: var(--bg-elevated); padding: 2px 6px; border-radius: 4px; font-size: 11px; }

    .loading { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 60px; color: var(--text-muted); }
    .spin { width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
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
