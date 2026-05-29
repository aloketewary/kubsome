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
  templateUrl: './rightsizing.html',
  styleUrl: './rightsizing.scss',
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
