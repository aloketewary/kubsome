import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
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
  private router = inject(Router);
  private confirmService = inject(ConfirmService);

  deployments: Deployment[] = [];
  filtered: Deployment[] = [];
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

  get healthyCount() { return this.deployments.filter(d => d.available === d.desired).length; }
  get degradedCount() { return this.deployments.filter(d => d.available < d.desired).length; }

  get filterPills(): CommandPill[] {
    return [
      { label: 'All', value: 'all', count: this.deployments.length },
      { label: 'Healthy', value: 'healthy', count: this.healthyCount, color: 'green' },
      ...(this.degradedCount > 0 ? [{ label: 'Degraded', value: 'degraded', count: this.degradedCount, color: 'red' as const }] : []),
    ];
  }

  statusFilter = 'all';

  onFilterChange(value: string) { this.statusFilter = value; this.filter(); }
  onSearchChange(value: string) { this.searchQuery = value; this.filter(); }

  replicaArray(n: number): number[] { return Array.from({ length: Math.min(n, 20) }, (_, i) => i); }

  depStatus(dep: Deployment): 'ok' | 'critical' { return dep.available === dep.desired ? 'ok' : 'critical'; }

  filter() {
    const q = this.searchQuery.toLowerCase();
    let result = this.deployments;
    if (this.statusFilter === 'healthy') result = result.filter(d => d.available === d.desired);
    if (this.statusFilter === 'degraded') result = result.filter(d => d.available < d.desired);
    if (q) result = result.filter(d => d.name.toLowerCase().includes(q));
    this.filtered = [...result].sort((a, b) => {
      const aOk = a.available === a.desired ? 1 : 0;
      const bOk = b.available === b.desired ? 1 : 0;
      if (aOk !== bOk) return aOk - bOk;
      return a.name.localeCompare(b.name);
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
