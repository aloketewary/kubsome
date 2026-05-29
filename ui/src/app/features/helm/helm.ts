import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { HoloCardComponent } from '../../shared/components/futuristic/holo-card.component';
import { MetricTileComponent } from '../../shared/components/futuristic/metric-tile.component';
import { StatusBeaconComponent } from '../../shared/components/futuristic/status-beacon.component';
import { CommandBarComponent } from '../../shared/components/futuristic/command-bar.component';
import type { CommandPill } from '../../shared/components/futuristic/command-bar.component';
import { LiveIndicatorComponent } from '../../shared/components/futuristic/live-indicator.component';
import { ActionIconComponent } from '../../shared/components/futuristic/action-icon.component';
import { IntelHeaderComponent } from '../../shared/components/futuristic/intel-header.component';
import { AiInsightDrawerComponent } from '../../shared/components/ai-insight-drawer.component';
import { ConfirmService } from '../../shared/services/confirm.service';

@Component({
  selector: 'app-helm',
  standalone: true,
  imports: [IntelHeaderComponent, FormsModule, TagModule, ButtonModule, TooltipModule, DialogModule, HoloCardComponent, MetricTileComponent, StatusBeaconComponent, CommandBarComponent, LiveIndicatorComponent, ActionIconComponent, AiInsightDrawerComponent],
  templateUrl: './helm.html',
  styleUrl: './helm.scss',
})
export class HelmComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private confirmService = inject(ConfirmService);
  releases: any[] = []; filtered: any[] = []; searchQuery = ''; loading = false; autoRefresh = true; lastUpdated = ''; private timer: any;
  historyVisible = false; historyName = ''; history: any[] = [];
  aiDrawerVisible = false; aiLoading = false; aiReleaseName = ''; aiSummary = ''; aiFindings: any[] = []; aiReasoning = '';

  get deployedCount() { return this.releases.filter(r => r.status === 'deployed').length; }
  get failedCount() { return this.releases.filter(r => r.status === 'failed').length; }
  get filterPills(): CommandPill[] { return [{ label: 'All', value: 'all', count: this.releases.length }, { label: 'Deployed', value: 'deployed', count: this.deployedCount, color: 'green' }, ...(this.failedCount > 0 ? [{ label: 'Failed', value: 'failed', count: this.failedCount, color: 'red' as const }] : [])]; }
  statusFilter = 'all';
  onFilterChange(v: string) { this.statusFilter = v; this.filter(); }
  onSearchChange(v: string) { this.searchQuery = v; this.filter(); }

  ngOnInit() { this.refresh(); this.startAutoRefresh(); }
  ngOnDestroy() { clearInterval(this.timer); }
  toggleAutoRefresh() { this.autoRefresh = !this.autoRefresh; if (this.autoRefresh) this.startAutoRefresh(); else clearInterval(this.timer); }
  private startAutoRefresh() { clearInterval(this.timer); this.timer = setInterval(() => this.refresh(), 30000); }

  refresh() { this.loading = true; this.http.get<any>('/api/helm/list').subscribe({ next: (res) => { this.releases = res.releases || []; this.filter(); this.loading = false; this.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }, error: () => { this.loading = false; } }); }

  filter() {
    let result = this.releases;
    if (this.statusFilter !== 'all') result = result.filter(r => r.status === this.statusFilter);
    if (this.searchQuery) { const q = this.searchQuery.toLowerCase(); result = result.filter(r => r.name.toLowerCase().includes(q)); }
    this.filtered = [...result].sort((a, b) => { const p = (s: string) => s === 'failed' ? 0 : s?.startsWith('pending') ? 1 : 2; return p(a.status) - p(b.status); });
  }

  loadHistory(rel: any) { this.historyName = rel.name; this.historyVisible = true; this.history = []; this.http.get<any>(`/api/helm/history/${rel.name}`).subscribe({ next: (res) => { this.history = res.revisions || []; } }); }
  rollback(rel: any) { this.confirmService.confirm({ title: 'Rollback', message: `Rollback "${rel.name}"?`, confirmLabel: 'Rollback', severity: 'danger', productionGuard: true }).then(ok => { if (ok) this.http.post<any>(`/api/helm/rollback/${rel.name}`, {}).subscribe(() => this.refresh()); }); }
  aiDiagnose(rel: any) { this.aiReleaseName = rel.name; this.aiDrawerVisible = true; this.aiLoading = true; this.aiFindings = []; this.aiSummary = ''; this.http.get<any>(`/api/helm/history/${rel.name}`).subscribe({ next: (res) => { const revs = res.revisions || []; this.aiFindings = revs.filter((r: any) => r.status === 'failed').map((r: any) => ({ title: `Rev ${r.revision} failed`, severity: 'high', detail: r.description || '' })); this.aiSummary = `${rel.name}: ${rel.status} (rev ${rel.revision})`; this.aiReasoning = 'Analyzed revision history.'; this.aiLoading = false; }, error: () => { this.aiSummary = 'Failed'; this.aiLoading = false; } }); }
  helmBeacon(status: string): 'ok' | 'critical' | 'warning' { if (status === 'deployed') return 'ok'; if (status === 'failed') return 'critical'; return 'warning'; }
  statusSev(status: string): 'success' | 'warn' | 'danger' | 'secondary' { if (status === 'deployed') return 'success'; if (status === 'failed') return 'danger'; if (status?.startsWith('pending')) return 'warn'; return 'secondary'; }
}
