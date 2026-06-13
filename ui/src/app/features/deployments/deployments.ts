import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { ApiService } from '../../core/services/api.service';
import { Deployment } from '../../core/models';
import { ConfirmService } from '../../shared/services/confirm.service';
import { AiInsightDrawerComponent } from '../../shared/components/ai-insight-drawer.component';
import { HoloCardComponent } from '../../shared/components/futuristic/holo-card.component';
import { MetricTileComponent } from '../../shared/components/futuristic/metric-tile.component';
import { StatusBeaconComponent } from '../../shared/components/futuristic/status-beacon.component';
import { CommandBarComponent } from '../../shared/components/futuristic/command-bar.component';
import type { CommandPill } from '../../shared/components/futuristic/command-bar.component';
import { LiveIndicatorComponent } from '../../shared/components/futuristic/live-indicator.component';
import { ActionIconComponent } from '../../shared/components/futuristic/action-icon.component';
import { IntelHeaderComponent } from '../../shared/components/futuristic/intel-header.component';

interface DepHealth {
  deployment: string;
  health_score: number;
  severity: string;
  top_reason: string;
  trend_1h: number | null;
  available_replicas: number;
  desired_replicas: number;
}

@Component({
  selector: 'app-deployments',
  standalone: true,
  imports: [IntelHeaderComponent,
    FormsModule, TagModule, ButtonModule, TooltipModule, DialogModule,
    AiInsightDrawerComponent, HoloCardComponent, MetricTileComponent,
    StatusBeaconComponent, CommandBarComponent, LiveIndicatorComponent, ActionIconComponent,
  ],
  templateUrl: './deployments.html',
  styleUrl: './deployments.scss',
})
export class DeploymentsComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private http = inject(HttpClient);
  private router = inject(Router);
  private confirmService = inject(ConfirmService);

  deployments: Deployment[] = [];
  filtered: Deployment[] = [];
  healthMap: Map<string, DepHealth> = new Map();
  searchQuery = '';
  loading = false;
  loadError = false;
  autoRefresh = true;
  lastUpdated = '';
  private refreshTimer: any;

  rolloutVisible = false;
  rolloutName = '';
  rolloutData: any = null;

  scaleVisible = false;
  scaleName = '';
  scaleReplicas = 1;
  scaleCurrentReplicas = 1;

  aiDrawerVisible = false;
  aiLoading = false;
  selectedDepName = '';
  aiSummary = '';
  aiFindings: any[] = [];
  aiReasoning = '';
  operating = false;

  Math = Math;

  statusFilter = 'all';

  get criticalCount() {
    return this.deployments.filter(d => this.depSeverity(d) === 'critical').length;
  }
  get warningCount() {
    return this.deployments.filter(d => {
      const s = this.depSeverity(d);
      return s === 'warning' || s === 'degraded';
    }).length;
  }
  get healthyCount() {
    return this.deployments.filter(d => this.depSeverity(d) === 'healthy').length;
  }

  get filterPills(): CommandPill[] {
    const pills: CommandPill[] = [
      { label: 'All', value: 'all', count: this.deployments.length },
      { label: 'Healthy', value: 'healthy', count: this.healthyCount, color: 'green' },
    ];
    if (this.warningCount > 0) pills.push({ label: 'Warning', value: 'warning', count: this.warningCount, color: 'amber' });
    if (this.criticalCount > 0) pills.push({ label: 'Critical', value: 'critical', count: this.criticalCount, color: 'red' });
    return pills;
  }

  depSeverity(dep: Deployment): string {
    const h = this.healthMap.get(dep.name);
    if (h) return h.severity;
    return dep.available === dep.desired ? 'healthy' : 'critical';
  }

  depScore(dep: Deployment): number | null {
    return this.healthMap.get(dep.name)?.health_score ?? null;
  }

  depTrend(dep: Deployment): number | null {
    return this.healthMap.get(dep.name)?.trend_1h ?? null;
  }

  depReason(dep: Deployment): string {
    return this.healthMap.get(dep.name)?.top_reason ?? '';
  }

  depBeaconStatus(dep: Deployment): 'ok' | 'warning' | 'critical' {
    const sev = this.depSeverity(dep);
    if (sev === 'healthy') return 'ok';
    if (sev === 'warning' || sev === 'degraded') return 'warning';
    return 'critical';
  }

  severityLabel(dep: Deployment): string {
    const sev = this.depSeverity(dep);
    if (sev === 'degraded') return 'Warning';
    return sev.charAt(0).toUpperCase() + sev.slice(1);
  }

  severityTag(dep: Deployment): 'success' | 'warn' | 'danger' {
    const sev = this.depSeverity(dep);
    if (sev === 'healthy') return 'success';
    if (sev === 'warning' || sev === 'degraded') return 'warn';
    return 'danger';
  }

  onFilterChange(value: string) { this.statusFilter = value; this.filter(); }
  onSearchChange(value: string) { this.searchQuery = value; this.filter(); }

  replicaArray(n: number): number[] { return Array.from({ length: Math.min(n, 20) }, (_, i) => i); }

  filter() {
    const q = this.searchQuery.toLowerCase();
    let result = this.deployments;
    if (this.statusFilter === 'healthy') result = result.filter(d => this.depSeverity(d) === 'healthy');
    if (this.statusFilter === 'warning') result = result.filter(d => { const s = this.depSeverity(d); return s === 'warning' || s === 'degraded'; });
    if (this.statusFilter === 'critical') result = result.filter(d => this.depSeverity(d) === 'critical');
    if (q) result = result.filter(d => d.name.toLowerCase().includes(q));
    // Sort: critical → warning → healthy, then score ASC
    const sevOrder: Record<string, number> = { critical: 0, degraded: 1, warning: 1, healthy: 2 };
    this.filtered = [...result].sort((a, b) => {
      const sa = sevOrder[this.depSeverity(a)] ?? 2;
      const sb = sevOrder[this.depSeverity(b)] ?? 2;
      if (sa !== sb) return sa - sb;
      return (this.depScore(a) ?? 100) - (this.depScore(b) ?? 100);
    });
  }

  refresh() {
    this.loading = true;
    this.api.getDeployments().subscribe({
      next: (res) => {
        this.deployments = res.deployments;
        this.filter();
        this.loading = false;
        this.loadError = false;
        this.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      },
      error: () => { this.loading = false; this.loadError = true; },
    });
    this.fetchHealth();
  }

  private fetchHealth() {
    this.http.get<any>('/api/monitor/health').subscribe({
      next: (res) => {
        this.healthMap.clear();
        for (const d of res.deployments || []) {
          this.healthMap.set(d.deployment, d);
        }
        this.filter();
      },
    });
  }

  onRestart(dep: Deployment) {
    this.confirmService.confirm({ title: 'Restart Deployment', message: `Rolling restart "${dep.name}". Pods will be recreated.`, confirmLabel: 'Restart', severity: 'warning', productionGuard: true })
      .then(ok => { if (ok) { this.operating = true; this.api.restart(dep.name).subscribe({ next: () => { this.operating = false; this.refresh(); }, error: () => { this.operating = false; } }); } });
  }

  onRollback(dep: Deployment) {
    this.confirmService.confirm({ title: 'Rollback Deployment', message: `Rollback "${dep.name}" to previous revision. Cannot be undone.`, confirmLabel: 'Rollback', severity: 'danger', productionGuard: true })
      .then(ok => { if (ok) { this.operating = true; this.api.rollback(dep.name).subscribe({ next: () => { this.operating = false; this.refresh(); }, error: () => { this.operating = false; } }); } });
  }

  onScale(dep: Deployment) { this.scaleName = dep.name; this.scaleReplicas = dep.desired; this.scaleCurrentReplicas = dep.desired; this.scaleVisible = true; }

  confirmScale() {
    this.confirmService.confirm({ title: 'Scale Deployment', message: `Scale "${this.scaleName}" to ${this.scaleReplicas} replicas?`, confirmLabel: 'Scale', severity: 'warning', productionGuard: true })
      .then(ok => { if (ok) { this.api.scale(this.scaleName, this.scaleReplicas).subscribe(() => { this.scaleVisible = false; this.refresh(); }); } });
  }

  viewRollout(dep: Deployment) { this.rolloutName = dep.name; this.rolloutVisible = true; this.rolloutData = null; this.api.getRollout(dep.name).subscribe(res => (this.rolloutData = res)); }
  viewPods(dep: Deployment) { this.router.navigate(['/pods'], { queryParams: { filter: dep.name } }); }
  investigate(dep: Deployment) { this.router.navigateByUrl(`/pods?filter=${dep.name}`); }

  aiDiagnose(dep: Deployment) {
    this.selectedDepName = dep.name;
    this.aiDrawerVisible = true;
    this.aiLoading = true;
    this.aiFindings = []; this.aiSummary = ''; this.aiReasoning = '';
    this.api.diagnose(dep.name).subscribe({
      next: (res) => { this.aiFindings = res.findings || []; this.aiSummary = res.summary || `Analysis of ${dep.name} complete.`; this.aiReasoning = res.reasoning || ''; this.aiLoading = false; },
      error: () => { this.aiSummary = 'Failed to diagnose.'; this.aiLoading = false; }
    });
  }

  toggleAutoRefresh() { this.autoRefresh = !this.autoRefresh; if (this.autoRefresh) this.startAutoRefresh(); else clearInterval(this.refreshTimer); }
  private startAutoRefresh() { clearInterval(this.refreshTimer); this.refreshTimer = setInterval(() => this.refresh(), 30000); }

  ngOnInit() { this.refresh(); this.startAutoRefresh(); }
  ngOnDestroy() { clearInterval(this.refreshTimer); }
}
