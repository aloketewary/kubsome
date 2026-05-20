import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TabsModule } from 'primeng/tabs';
import { TitleCasePipe } from '@angular/common';
import { PageInfoComponent } from '../../shared/components/page-info.component';
import { SpotlightComponent } from '../../shared/components/spotlight.component';
import { RelatedPagesComponent } from '../../shared/components/related-pages.component';

@Component({
  selector: 'app-rightsizing',
  standalone: true,
  imports: [ButtonModule, TagModule, TabsModule, TitleCasePipe, PageInfoComponent, SpotlightComponent, RelatedPagesComponent],
  template: `
    <app-spotlight id="rightsizing" title="Right-Sizing" icon="pi pi-sliders-h"
      description="Data-driven CPU/memory recommendations based on actual P95 usage."
      [capabilities]="['P95-based requests', 'P99-based limits', 'Safe rollout phases', 'YAML patch export']" [compact]="true" />

    <div class="page-header">
      <div>
        <h1>Right-Sizing Recommendations</h1>
        <p class="subtitle">Based on {{ data?.methodology?.min_samples || 12 }}h+ of hourly metrics · Cache: {{ data?.methodology?.cache_ttl_hours || 6 }}h</p>
      </div>
      <div class="header-actions">
        <button pButton icon="pi pi-download" label="Export YAML" class="p-button-outlined p-button-sm" (click)="exportYaml()" [disabled]="!data?.recommendations?.length"></button>
        <button pButton icon="pi pi-refresh" class="p-button-outlined p-button-sm p-button-rounded" (click)="refresh()" [loading]="loading"></button>
        <app-page-info title="Right-Sizing" description="Analyzes hourly P95/P99 usage vs current requests/limits. Generates safe recommendations with confidence scoring and phased rollout."
          [tips]="['Green = safe to apply', 'Yellow = apply with monitoring', 'Red = manual review', 'Export YAML for kubectl apply']"
          [commands]="['rightsizing', 'cost-query', 'analytics']" />
      </div>
    </div>

    @if (!data && !loading) {
      <div class="empty-state">
        <i class="pi pi-sliders-h"></i>
        <h3>No Analytics Data</h3>
        <p>Run <code>collect</code> or wait for auto-collection (every 5 min).</p>
        <p>Need at least 12 hours of data for recommendations.</p>
      </div>
    }

    @if (loading && !data) {
      <div class="loading"><div class="spin"></div> Analyzing resource usage...</div>
    }

    @if (data) {
      <!-- Summary Cards -->
      <div class="summary-grid">
        <div class="summary-card">
          <span class="summary-value">{{ data.summary.deployments }}</span>
          <span class="summary-label">Deployments</span>
        </div>
        <div class="summary-card" [class.warn]="data.summary.cpu_util_pct < 40">
          <span class="summary-value">{{ data.summary.cpu_util_pct }}%</span>
          <span class="summary-label">CPU Utilization</span>
        </div>
        <div class="summary-card" [class.warn]="data.summary.mem_util_pct < 40">
          <span class="summary-value">{{ data.summary.mem_util_pct }}%</span>
          <span class="summary-label">Memory Utilization</span>
        </div>
        <div class="summary-card success">
          <span class="summary-value">{{ "$" + data.total_monthly_savings_usd?.toFixed(2) }}</span>
          <span class="summary-label">Potential Savings/mo</span>
        </div>
      </div>

      <!-- Tabs -->
      <p-tabs [value]="activeTab" (valueChange)="activeTab = '' + $event">
        <p-tablist>
          <p-tab value="0">Recommendations ({{ data.overprovisioned_count }})</p-tab>
          <p-tab value="1">At Risk ({{ data.underprovisioned_count }})</p-tab>
          <p-tab value="2">Rollout Plan</p-tab>
        </p-tablist>

        <p-tabpanels>
          <!-- Recommendations -->
          <p-tabpanel value="0">
            @if (!data.recommendations?.length) {
              <p class="empty-tab">All deployments are well-sized ✓</p>
            }
            @for (rec of data.recommendations; track rec.deployment) {
              <div class="rec-card" [class]="'risk-' + rec.risk">
                <div class="rec-header">
                  <div class="rec-title">
                    <span class="rec-risk-dot" [class]="rec.risk"></span>
                    <strong>{{ rec.deployment }}</strong>
                    <span class="rec-ns">{{ rec.namespace }}</span>
                    <p-tag [value]="rec.workload_type || 'deployment'" severity="secondary" [rounded]="true" size="small" />
                  </div>
                  <div class="rec-meta">
                    <span class="confidence">{{ rec.confidence }}% confidence</span>
                    <p-tag [value]="rec.risk + ' risk'" [severity]="riskSeverity(rec.risk)" [rounded]="true" size="small" />
                    <span class="savings">{{ "$" + rec.total_savings_monthly?.toFixed(2) }}/mo</span>
                  </div>
                </div>

                <div class="rec-body">
                  <div class="resource-row">
                    <span class="res-label">CPU</span>
                    <div class="res-values">
                      <span class="current">{{ rec.current.cpu_request }}m</span>
                      <span class="arrow">→</span>
                      <span class="recommended">{{ rec.recommended.cpu_request }}m</span>
                      <span class="limit">lim: {{ rec.recommended.cpu_limit }}m</span>
                    </div>
                    <div class="usage-stats">
                      avg={{ rec.usage.cpu_avg }}m · P95={{ rec.usage.cpu_p95 }}m · max={{ rec.usage.cpu_max }}m
                      @if (rec.usage.cpu_volatile) { <span class="volatile">⚡volatile</span> }
                    </div>
                  </div>
                  <div class="resource-row">
                    <span class="res-label">Mem</span>
                    <div class="res-values">
                      <span class="current">{{ rec.current.mem_request }}Mi</span>
                      <span class="arrow">→</span>
                      <span class="recommended">{{ rec.recommended.mem_request }}Mi</span>
                      <span class="limit">lim: {{ rec.recommended.mem_limit }}Mi</span>
                    </div>
                    <div class="usage-stats">
                      avg={{ rec.usage.mem_avg }}Mi · P95={{ rec.usage.mem_p95 }}Mi · max={{ rec.usage.mem_max }}Mi
                      @if (rec.usage.mem_volatile) { <span class="volatile">⚡volatile</span> }
                    </div>
                  </div>
                </div>

                @if (rec.vpa) {
                  <div class="vpa-row">
                    <span class="vpa-label">VPA:</span>
                    cpu={{ rec.vpa.cpu_target }}m, mem={{ rec.vpa.mem_target }}Mi
                    <p-tag [value]="rec.vpa_aligned" [severity]="rec.vpa_aligned === 'aligned' ? 'success' : 'warn'" [rounded]="true" size="small" />
                  </div>
                }
              </div>
            }
          </p-tabpanel>

          <!-- At Risk -->
          <p-tabpanel value="1">
            @if (!data.at_risk?.length) {
              <p class="empty-tab">No workloads at risk ✓</p>
            }
            @for (item of data.at_risk; track item.deployment) {
              <div class="risk-card">
                <div class="risk-header">
                  <strong>{{ item.deployment }}</strong>
                  <span class="rec-ns">{{ item.namespace }}</span>
                  <p-tag value="at risk" severity="danger" [rounded]="true" size="small" />
                </div>
                <div class="risk-body">
                  <span>CPU: {{ item.cpu_util_pct }}% of request ({{ item.cpu_p95 }}m / {{ item.cpu_request }}m)</span>
                  <span>Mem: {{ item.mem_util_pct }}% of request ({{ item.mem_p95 }}Mi / {{ item.mem_request }}Mi)</span>
                  <span class="restarts">{{ item.restarts }} restarts</span>
                </div>
              </div>
            }
          </p-tabpanel>

          <!-- Rollout Plan -->
          <p-tabpanel value="2">
            @if (data.rollout_plan) {
              @for (phase of phases; track phase.key) {
                <div class="phase-section">
                  <div class="phase-header">
                    <span class="phase-icon" [class]="phase.key"></span>
                    <strong>{{ phase.data.label }}</strong>
                    <span class="phase-count">({{ phase.data.count }})</span>
                    @if (phase.data.auto_apply) {
                      <p-tag value="auto-safe" severity="success" [rounded]="true" size="small" />
                    }
                  </div>
                  @for (item of phase.data.items; track item.deployment) {
                    <div class="phase-item">
                      {{ item.deployment }} · {{ "$" + item.total_savings_monthly?.toFixed(2) }}/mo
                    </div>
                  }
                  @if (!phase.data.items?.length) {
                    <div class="phase-item empty">No items in this phase</div>
                  }
                </div>
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
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .header-actions { display: flex; align-items: center; gap: 8px; }

    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
    .summary-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; text-align: center; }
    .summary-card.success { border-left: 3px solid var(--success); }
    .summary-card.warn { border-left: 3px solid var(--warning); }
    .summary-value { display: block; font-size: 28px; font-weight: 800; }
    .summary-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; }

    .rec-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; margin-bottom: 12px; }
    .rec-card.risk-low { border-left: 3px solid var(--success); }
    .rec-card.risk-medium { border-left: 3px solid var(--warning); }
    .rec-card.risk-high { border-left: 3px solid var(--danger); }
    .rec-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px; }
    .rec-title { display: flex; align-items: center; gap: 8px; }
    .rec-ns { font-size: 12px; color: var(--text-muted); }
    .rec-meta { display: flex; align-items: center; gap: 10px; font-size: 12px; }
    .confidence { color: var(--text-muted); }
    .savings { font-weight: 700; color: var(--success); }
    .rec-risk-dot { width: 8px; height: 8px; border-radius: 50%; }
    .rec-risk-dot.low { background: var(--success); }
    .rec-risk-dot.medium { background: var(--warning); }
    .rec-risk-dot.high { background: var(--danger); }

    .rec-body { display: flex; flex-direction: column; gap: 8px; }
    .resource-row { display: flex; align-items: center; gap: 12px; font-size: 13px; flex-wrap: wrap; }
    .res-label { font-weight: 600; min-width: 32px; }
    .res-values { display: flex; align-items: center; gap: 6px; }
    .current { color: var(--text-muted); text-decoration: line-through; }
    .arrow { color: var(--accent); }
    .recommended { font-weight: 700; color: var(--accent); }
    .limit { font-size: 11px; color: var(--text-muted); }
    .usage-stats { font-size: 11px; color: var(--text-muted); }
    .volatile { color: var(--warning); font-weight: 600; }

    .vpa-row { font-size: 11px; color: var(--text-muted); margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border); display: flex; align-items: center; gap: 8px; }
    .vpa-label { font-weight: 600; }

    .risk-card { background: var(--bg-card); border: 1px solid var(--border); border-left: 3px solid var(--danger); border-radius: var(--radius); padding: 12px 16px; margin-bottom: 8px; }
    .risk-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .risk-body { display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: var(--text-muted); }
    .restarts { color: var(--danger); }

    .phase-section { margin-bottom: 16px; }
    .phase-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 13px; }
    .phase-icon { width: 10px; height: 10px; border-radius: 50%; }
    .phase-icon.phase_1 { background: var(--success); }
    .phase-icon.phase_2 { background: var(--warning); }
    .phase-icon.phase_3 { background: var(--danger); }
    .phase-count { color: var(--text-muted); font-size: 12px; }
    .phase-item { font-size: 12px; padding: 4px 0 4px 18px; color: var(--text-secondary); }
    .phase-item.empty { color: var(--text-muted); font-style: italic; }

    .methodology { font-size: 11px; color: var(--text-muted); margin-top: 16px; padding: 12px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); }

    .empty-state { text-align: center; padding: 60px 20px; color: var(--text-muted); }
    .empty-state i { font-size: 48px; margin-bottom: 16px; opacity: 0.3; }
    .empty-state code { background: var(--bg-elevated); padding: 2px 6px; border-radius: 4px; font-size: 12px; }
    .empty-tab { color: var(--text-muted); font-size: 13px; padding: 20px 0; }
    .loading { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 60px; color: var(--text-muted); }
    .spin { width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (max-width: 768px) { .summary-grid { grid-template-columns: repeat(2, 1fr); } }
  `],
})
export class RightsizingComponent implements OnInit {
  private http = inject(HttpClient);
  data: any = null;
  loading = false;
  activeTab = '0';
  phases: { key: string; data: any }[] = [];

  relatedPages = [
    { path: '/analytics', icon: 'pi pi-chart-bar', label: 'Analytics', description: 'Raw metrics data and SQL queries' },
    { path: '/cost', icon: 'pi pi-dollar', label: 'Optimization', description: 'Resource optimization overview' },
    { path: '/cost-estimate', icon: 'pi pi-calculator', label: 'Cost Estimate', description: 'Per-deployment cost breakdown' },
    { path: '/deployments', icon: 'pi pi-send', label: 'Deployments', description: 'Apply changes to deployments' },
  ];

  ngOnInit() { this.refresh(); }

  refresh() {
    this.loading = true;
    this.http.get<any>('/api/analytics/rightsizing').subscribe({
      next: (res) => {
        this.data = res;
        this.loading = false;
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
      next: (res) => { alert(`Exported to: ${res.path}`); },
      error: () => { alert('Export failed'); },
    });
  }

  riskSeverity(risk: string): "success" | "warn" | "danger" | "info" | "secondary" | "contrast" | undefined {
    if (risk === 'low') return 'success';
    if (risk === 'medium') return 'warn';
    return 'danger';
  }
}
