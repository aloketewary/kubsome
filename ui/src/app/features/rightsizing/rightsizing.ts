import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TabsModule } from 'primeng/tabs';
import { TooltipModule } from 'primeng/tooltip';
import { IntelHeaderComponent } from '../../shared/components/futuristic/intel-header.component';
import { MetricTileComponent } from '../../shared/components/futuristic/metric-tile.component';
import { RelatedPagesComponent } from '../../shared/components/related-pages.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { ConfirmService } from '../../shared/services/confirm.service';
import { RightsizingOverview } from './rightsizing.models';


@Component({
  selector: 'app-rightsizing',
  standalone: true,
  imports: [
    ButtonModule, TagModule, TabsModule, TooltipModule, DecimalPipe,
    IntelHeaderComponent, MetricTileComponent, RelatedPagesComponent,
    SkeletonComponent,
  ],
  templateUrl: './rightsizing.html',
  styleUrl: './rightsizing.scss',
})
export class RightsizingComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private confirmService = inject(ConfirmService);

  data: RightsizingOverview | null = null;
  loading = false;
  loadError = false;
  activeTab = '0';
  dryRunning = false;
  toast: { message: string; severity: 'success' | 'danger' | 'info' } | null = null;
  private timer: any;

  relatedPages = [
    { path: '/analytics', icon: 'pi pi-chart-bar', label: 'Analytics', description: 'Cluster analytics overview' },
    { path: '/cost-estimate', icon: 'pi pi-calculator', label: 'Cost Estimate', description: 'Per-deployment cost' },
    { path: '/deployments', icon: 'pi pi-send', label: 'Deployments', description: 'Apply changes' },
  ];

  ngOnInit() { this.refresh(); this.startAutoRefresh(); }
  ngOnDestroy() { clearInterval(this.timer); }

  private startAutoRefresh() {
    clearInterval(this.timer);
    this.timer = setInterval(() => this.refresh(), 60000);
  }

  refresh() {
    this.loading = true;
    this.http.get<RightsizingOverview>('/api/analytics/rightsizing/overview').subscribe({
      next: (res) => { this.data = res; this.loading = false; this.loadError = false; },
      error: () => { this.data = null; this.loading = false; this.loadError = true; },
    });
  }

  // --- Actions ---

  dryRun() {
    this.dryRunning = true;
    this.http.post<any>('/api/rightsizing/dry-run', {}).subscribe({
      next: (res) => {
        this.dryRunning = false;
        this.showToast(`Dry Run: ${res.passed} passed, ${res.failed} failed`, res.failed > 0 ? 'danger' : 'success');
      },
      error: () => { this.dryRunning = false; this.showToast('Dry run failed', 'danger'); },
    });
  }

  exportGitops() {
    this.confirmService.confirm({
      title: 'Export GitOps Manifests',
      message: 'Generate kustomization patches for all recommendations?',
      confirmLabel: 'Export',
      severity: 'info',
    }).then(ok => {
      if (!ok) return;
      this.http.post<any>('/api/rightsizing/gitops', { format: 'kustomize' }).subscribe({
        next: (res) => { this.showToast(res.path ? `GitOps: ${res.path}` : 'No recommendations', res.path ? 'success' : 'info'); },
        error: () => { this.showToast('GitOps export failed', 'danger'); },
      });
    });
  }

  exportYaml() {
    this.http.post<any>('/api/analytics/rightsizing/export', {}).subscribe({
      next: (res) => { this.showToast(res.path ? `YAML: ${res.path}` : 'No recommendations', res.path ? 'success' : 'info'); },
      error: () => { this.showToast('Export failed', 'danger'); },
    });
  }

  private showToast(message: string, severity: 'success' | 'danger' | 'info') {
    this.toast = { message, severity };
    setTimeout(() => { if (this.toast?.message === message) this.toast = null; }, 5000);
  }

  // --- Helpers ---

  get freshnessLabel(): string {
    if (!this.data) return '';
    const s = this.data.data_freshness_seconds;
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.round(s / 60)}m ago`;
    return `${Math.round(s / 3600)}h ago`;
  }

  riskAccent(): 'green' | 'amber' | 'red' {
    if (!this.data) return 'green';
    if (this.data.at_risk_count === 0) return 'green';
    const hasC = this.data.risks.some(r => r.severity === 'critical');
    return hasC ? 'red' : 'amber';
  }

  sevTag(sev: string): 'success' | 'warn' | 'danger' {
    if (sev === 'low') return 'success';
    if (sev === 'medium') return 'warn';
    return 'danger';
  }
}
