import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { WsService } from '../../core/services/ws.service';
import { Pod } from '../../core/models';
import { PodDrawerComponent } from '../../shared/components/pod-drawer.component';
import { AiInsightDrawerComponent } from '../../shared/components/ai-insight-drawer.component';
import { LogTerminalComponent } from '../../shared/components/log-terminal.component';
import { ShellTerminalComponent } from '../../shared/components/shell-terminal.component';
import { StatusBeaconComponent } from '../../shared/components/futuristic/status-beacon.component';
import { MetricTileComponent } from '../../shared/components/futuristic/metric-tile.component';
import { CommandBarComponent } from '../../shared/components/futuristic/command-bar.component';
import type { CommandPill } from '../../shared/components/futuristic/command-bar.component';
import { LiveIndicatorComponent } from '../../shared/components/futuristic/live-indicator.component';
import { SectionGroupComponent } from '../../shared/components/futuristic/section-group.component';
import { ActionIconComponent } from '../../shared/components/futuristic/action-icon.component';
import { IntelHeaderComponent } from '../../shared/components/futuristic/intel-header.component';

interface PodGroup {
  deployment: string;
  pods: Pod[];
  expanded: boolean;
  unhealthyCount: number;
  healthPct: number;
}

@Component({
  selector: 'app-pods',
  standalone: true,
  imports: [
    JsonPipe, FormsModule, TagModule, ButtonModule, TooltipModule, DialogModule,
    PodDrawerComponent, AiInsightDrawerComponent, LogTerminalComponent, ShellTerminalComponent,
    StatusBeaconComponent, MetricTileComponent,
    CommandBarComponent, LiveIndicatorComponent, SectionGroupComponent, ActionIconComponent,
    IntelHeaderComponent,
  ],
  templateUrl: './pods.html',
  styleUrl: './pods.scss',
})
export class PodsComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private ws = inject(WsService);
  private route = inject(ActivatedRoute);
  router = inject(Router);
  private watchSub: Subscription | null = null;
  private watchClose: (() => void) | null = null;
  private searchTimeout: any = null;

  watching = false;
  pods: Pod[] = [];
  groups: PodGroup[] = [];
  filteredGroups: PodGroup[] = [];
  selected: Pod[] = [];
  selectedGroup = '';
  searchQuery = '';
  statusFilter: 'all' | 'healthy' | 'warning' | 'critical' | 'pending' = 'all';

  // Pagination
  currentPage = 1;
  pageSize = 50;
  totalPods = 0;
  loading = false;
  loadError = false;
  hasMore = false;

  // Dialogs
  logsVisible = false;
  logsTitle = '';
  logLines: string[] = [];
  logsLoading = false;
  isLiveMode = false;
  activePodName = '';
  inspectVisible = false;
  inspectData: any = null;
  shellVisible = false;
  shellPodName = '';
  diagnoseVisible = false;
  diagnoseFindings: any[] = [];
  drawerPod = '';
  drawerStatus = '';

  // AI
  aiDrawerVisible = false;
  aiLoading = false;
  aiSummary = '';
  aiFindings: any[] = [];
  aiReasoning = '';

  get healthyCount() { return this.pods.filter(p => this.isHealthy(p)).length; }
  get warningCount() { return this.pods.filter(p => p.status === 'Running' && p.restarts > 5).length; }
  get criticalCount() { return this.pods.filter(p => p.status !== 'Running' && p.status !== 'Pending' && p.status !== 'Succeeded').length; }
  get pendingCount() { return this.pods.filter(p => p.status === 'Pending').length; }
  get allExpanded() { return this.filteredGroups.length > 0 && this.filteredGroups.every(g => g.expanded); }

  get filterPills(): CommandPill[] {
    const pills: CommandPill[] = [
      { label: 'All', value: 'all', count: this.pods.length },
      { label: 'Healthy', value: 'healthy', count: this.healthyCount, color: 'green' },
    ];
    if (this.warningCount > 0) pills.push({ label: 'Warning', value: 'warning', count: this.warningCount, color: 'amber' });
    if (this.criticalCount > 0) pills.push({ label: 'Critical', value: 'critical', count: this.criticalCount, color: 'red' });
    if (this.pendingCount > 0) pills.push({ label: 'Pending', value: 'pending', count: this.pendingCount, color: 'amber' });
    return pills;
  }

  statusSeverity(status: string): 'success' | 'warn' | 'danger' | 'secondary' | undefined {
    switch (status) { case 'Running': return 'success'; case 'Succeeded': return 'secondary'; case 'Pending': return 'warn'; default: return 'danger'; }
  }

  podBeaconStatus(pod: Pod): 'ok' | 'warning' | 'critical' | 'idle' {
    if (pod.status === 'Running' && pod.restarts <= 5) return 'ok';
    if (pod.status === 'Pending') return 'warning';
    if (pod.status === 'Running' && pod.restarts > 5) return 'warning';
    return 'critical';
  }

  isHealthy(pod: Pod): boolean { return (pod.status === 'Running' || pod.status === 'Succeeded') && pod.restarts <= 5; }
  isError(line: string): boolean { const l = line.toLowerCase(); return l.includes('error') || l.includes('fatal') || l.includes('panic'); }
  isSelected(pod: Pod): boolean { return this.selected.some(p => p.name === pod.name); }

  podSecondary(pod: Pod): string {
    const parts = [pod.status];
    if (pod.age) parts.push(pod.age);
    if (pod.restarts > 0) parts.push(`${pod.restarts} restarts`);
    return parts.join(' · ');
  }

  onFilterChange(value: string) {
    this.statusFilter = value as any;
    this.applyStatusFilter();
  }

  onSearchChange(value: string) {
    this.searchQuery = value;
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.currentPage = 1;
      this.pods = [];
      this.fetchPods();
    }, 300);
  }

  togglePod(pod: Pod, group: PodGroup) {
    if (this.selectedGroup && this.selectedGroup !== group.deployment) this.selected = [];
    this.selectedGroup = group.deployment;
    const idx = this.selected.findIndex(p => p.name === pod.name);
    if (idx >= 0) { this.selected.splice(idx, 1); this.selected = [...this.selected]; if (this.selected.length === 0) this.selectedGroup = ''; }
    else { this.selected = [...this.selected, pod]; }
  }

  selectGroup(group: PodGroup, event: Event) { event.stopPropagation(); this.selected = [...group.pods]; this.selectedGroup = group.deployment; }
  clearSelection() { this.selected = []; this.selectedGroup = ''; }
  openDrawer(pod: Pod, event?: Event) { event?.stopPropagation(); this.drawerPod = pod.name; this.drawerStatus = pod.status; }

  toggleAllGroups() {
    const expand = !this.allExpanded;
    this.filteredGroups.forEach(g => g.expanded = expand);
  }

  quickLogs(pod: Pod) {
    this.logsTitle = `Logs — ${pod.name}`;
    this.logsVisible = true;
    this.logsLoading = true;
    this.logLines = [];
    this.isLiveMode = false;
    this.api.getLogs(pod.name, 100).subscribe(res => { this.logLines = res.lines; this.logsLoading = false; });
  }

  quickShell(pod: Pod) { this.shellPodName = pod.name; this.shellVisible = true; }

  quickAiDiagnose(pod: Pod) {
    this.activePodName = pod.name;
    this.aiDrawerVisible = true;
    this.aiLoading = true;
    this.aiFindings = [];
    this.aiSummary = '';
    this.aiReasoning = '';
    this.api.diagnose(pod.name).subscribe({
      next: (res) => {
        this.aiFindings = res.findings || [];
        this.aiSummary = res.summary || `Analysis of ${pod.name} complete. ${this.aiFindings.length} issues identified.`;
        this.aiReasoning = res.reasoning || 'AI checked pod events, container states, and recent log patterns.';
        this.aiLoading = false;
      },
      error: () => { this.aiSummary = 'Failed to perform AI diagnosis.'; this.aiLoading = false; }
    });
  }

  viewLogs() { if (this.selected.length === 1) this.quickLogs(this.selected[0]); }
  viewLiveLogs() {
    const pod = this.selected[0];
    this.activePodName = pod.name;
    this.logsTitle = `Live — ${pod.name}`;
    this.isLiveMode = true;
    this.logsVisible = true;
  }
  openShell() { if (this.selected.length === 1) this.quickShell(this.selected[0]); }
  inspectPod() { const pod = this.selected[0]; this.inspectVisible = true; this.inspectData = null; this.api.inspect(pod.name).subscribe(res => { this.inspectData = res; }); }
  diagnosePod() { if (this.selected.length === 1) this.quickAiDiagnose(this.selected[0]); }

  viewLogcat() {
    const names = this.selected.map(p => p.name);
    this.logsTitle = `Logcat — ${this.selectedGroup} (${names.length})`;
    this.logsVisible = true; this.logsLoading = true; this.logLines = []; this.isLiveMode = false;
    const allLines: string[] = []; let done = 0;
    for (const name of names) {
      this.api.getLogs(name, 50).subscribe(res => {
        const short = name.slice(name.lastIndexOf('-') + 1);
        for (const line of res.lines) allLines.push(`[${short}] ${line}`);
        done++;
        if (done === names.length) { this.logLines = allLines; this.logsLoading = false; }
      });
    }
  }

  onLogsHide() { this.isLiveMode = false; this.activePodName = ''; }
  onShellHide() { this.shellPodName = ''; }

  refresh() { this.currentPage = 1; this.pods = []; this.fetchPods(); }
  loadMore() { if (!this.hasMore || this.loading) return; this.currentPage++; this.fetchPods(true); }

  toggleWatch() { this.watching ? this.stopWatch() : this.startWatch(); }

  private startWatch() {
    this.watching = true;
    const conn = this.ws.connect('/ws/pods');
    this.watchClose = conn.close;
    this.watchSub = conn.messages$.subscribe({
      next: (data) => {
        const incoming = JSON.parse(data);
        this.pods = incoming.slice(0, this.currentPage * this.pageSize);
        this.totalPods = incoming.length;
        this.hasMore = this.pods.length < this.totalPods;
        this.groupPods();
        this.applyStatusFilter();
      },
      complete: () => { this.watching = false; }
    });
  }

  private stopWatch() {
    this.watching = false;
    this.watchSub?.unsubscribe();
    this.watchClose?.();
    this.watchSub = null;
    this.watchClose = null;
  }

  private fetchPods(append = false) {
    this.loading = true;
    const search = this.searchQuery || undefined;
    this.api.getPods(this.currentPage, this.pageSize, search).subscribe({
      next: (res) => {
        this.pods = append ? [...this.pods, ...res.pods] : res.pods;
        this.totalPods = res.total;
        this.hasMore = this.pods.length < res.total;
        this.groupPods();
        this.applyStatusFilter();
        this.loading = false;
        this.loadError = false;
      },
      error: () => { this.loading = false; this.loadError = true; },
    });
  }

  private applyStatusFilter() {
    if (this.statusFilter === 'all') { this.filteredGroups = this.groups; return; }
    this.filteredGroups = this.groups
      .map(g => {
        const filtered = g.pods.filter(p => {
          switch (this.statusFilter) {
            case 'healthy': return this.isHealthy(p);
            case 'warning': return p.status === 'Running' && p.restarts > 5;
            case 'critical': return p.status !== 'Running' && p.status !== 'Pending' && p.status !== 'Succeeded';
            case 'pending': return p.status === 'Pending';
            default: return true;
          }
        });
        if (filtered.length === 0) return null;
        return { ...g, pods: filtered, expanded: true, unhealthyCount: filtered.filter(p => !this.isHealthy(p)).length, healthPct: Math.round(((filtered.length - filtered.filter(p => !this.isHealthy(p)).length) / filtered.length) * 100) };
      })
      .filter((g): g is PodGroup => g !== null);
  }

  private groupPods() {
    const map = new Map<string, Pod[]>();
    for (const pod of this.pods) { const dep = this.extractDeployment(pod.name); if (!map.has(dep)) map.set(dep, []); map.get(dep)!.push(pod); }
    this.groups = Array.from(map.entries()).map(([deployment, pods]) => {
      const unhealthyCount = pods.filter(p => !this.isHealthy(p)).length;
      return { deployment, pods, expanded: unhealthyCount > 0 || pods.length <= 3, unhealthyCount, healthPct: pods.length > 0 ? Math.round(((pods.length - unhealthyCount) / pods.length) * 100) : 100 };
    }).sort((a, b) => {
      if (a.unhealthyCount > 0 && b.unhealthyCount === 0) return -1;
      if (a.unhealthyCount === 0 && b.unhealthyCount > 0) return 1;
      return a.deployment.localeCompare(b.deployment);
    });
  }

  private extractDeployment(podName: string): string {
    const parts = podName.split('-');
    return parts.length > 2 ? parts.slice(0, -2).join('-') : podName;
  }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['filter']) this.searchQuery = params['filter'];
      this.fetchPods();
    });
  }

  ngOnDestroy() { this.stopWatch(); }
}
