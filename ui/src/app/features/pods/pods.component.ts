import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { JsonPipe } from '@angular/common';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { WsService } from '../../core/services/ws.service';
import { Pod } from '../../core/models';
import { PodDrawerComponent } from '../../shared/components/pod-drawer.component';
import { PageInfoComponent } from '../../shared/components/page-info.component';

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
  imports: [JsonPipe, TagModule, ButtonModule, TooltipModule, DialogModule, InputTextModule, FormsModule, PodDrawerComponent, PageInfoComponent],
  template: `
    <!-- Header -->
    <div class="page-header">
      <div>
        <h1>Pods</h1>
        <p class="subtitle">{{ pods.length }} pods across {{ filteredGroups.length }} deployments</p>
      </div>
      <div class="header-actions">
        <div class="search-wrap">
          <i class="pi pi-search"></i>
          <input pInputText [(ngModel)]="searchQuery" placeholder="Filter..." (ngModelChange)="filterGroups()" />
        </div>
        <button pButton [class]="watching ? 'p-button-danger p-button-sm watch-active' : 'p-button-outlined p-button-sm'" (click)="toggleWatch()">
          <span class="watch-dot" [class.pulsing]="watching"></span>
          {{ watching ? 'Live' : 'Watch' }}
        </button>
        <button pButton icon="pi pi-refresh" class="p-button-outlined p-button-sm p-button-rounded" (click)="refresh()" pTooltip="Refresh" aria-label="Refresh"></button>
        <app-page-info title="Pods" description="View all pods grouped by deployment. Click a pod to inspect, select multiple for logcat."
          [tips]="['Click pod name to open detail drawer', 'Select multiple pods for combined logs', 'Red border = unhealthy deployment', 'Watch mode streams live updates']"
          [commands]="['pods', 'pods watch', 'inspect <pod>', 'diagnose <pod>', 'logs <pod>']"
          [shortcuts]="[{key: 'G+P', action: 'Navigate to Pods'}]" />
      </div>
    </div>

    <!-- Summary Strip -->
    <div class="summary-strip">
      <div class="summary-pill">
        <span class="pill-value">{{ pods.length }}</span>
        <span class="pill-label">Total</span>
      </div>
      <div class="summary-pill pill-ok">
        <span class="pill-dot dot-ok"></span>
        <span class="pill-value">{{ healthyCount }}</span>
        <span class="pill-label">Healthy</span>
      </div>
      @if (warningCount > 0) {
        <div class="summary-pill pill-warn">
          <span class="pill-dot dot-warn"></span>
          <span class="pill-value">{{ warningCount }}</span>
          <span class="pill-label">Warning</span>
        </div>
      }
      @if (criticalCount > 0) {
        <div class="summary-pill pill-crit">
          <span class="pill-dot dot-crit"></span>
          <span class="pill-value">{{ criticalCount }}</span>
          <span class="pill-label">Critical</span>
        </div>
      }
    </div>

    <!-- Action Bar -->
    @if (selected.length > 0) {
      <div class="action-bar">
        <span class="action-count">{{ selected.length }} selected in <strong>{{ selectedGroup }}</strong></span>
        <div class="action-buttons">
          @if (selected.length === 1) {
            <button pButton icon="pi pi-align-left" label="Logs" class="p-button-sm" (click)="viewLogs()"></button>
            <button pButton icon="pi pi-play" label="Live" class="p-button-sm p-button-success" (click)="viewLiveLogs()"></button>
            <button pButton icon="pi pi-search" label="Inspect" class="p-button-sm p-button-secondary" (click)="inspectPod()"></button>
            <button pButton icon="pi pi-sparkles" label="AI Diagnose" class="p-button-sm p-button-warning" (click)="diagnosePod()"></button>
          }
          @if (selected.length > 1) {
            <button pButton icon="pi pi-list" label="Logcat ({{ selected.length }})" class="p-button-sm" (click)="viewLogcat()"></button>
          }
          <button pButton icon="pi pi-times" class="p-button-sm p-button-text" (click)="clearSelection()" aria-label="Clear Selection"></button>
        </div>
      </div>
    }

    <!-- Groups -->
    @for (group of filteredGroups; track group.deployment) {
      <div class="pod-group" [class.group-unhealthy]="group.unhealthyCount > 0">
        <div class="group-header" (click)="group.expanded = !group.expanded" tabindex="0" role="button" aria-label="Toggle deployment group"
             (keydown.enter)="group.expanded = !group.expanded" (keydown.space)="$event.preventDefault(); group.expanded = !group.expanded">
          <i class="pi" [class.pi-chevron-down]="group.expanded" [class.pi-chevron-right]="!group.expanded"></i>
          <span class="group-name">{{ group.deployment }}</span>
          <div class="group-health-bar">
            <div class="ghb-fill" [class.ghb-ok]="group.unhealthyCount === 0" [class.ghb-bad]="group.unhealthyCount > 0"
                 [style.width.%]="group.healthPct"></div>
          </div>
          <span class="group-ratio">{{ group.pods.length - group.unhealthyCount }}/{{ group.pods.length }}</span>
          @if (group.unhealthyCount > 0) {
            <p-tag [value]="group.unhealthyCount + ' unhealthy'" severity="danger" [rounded]="true" />
          }
          @if (group.pods.length > 1) {
            <button pButton icon="pi pi-check-square" class="p-button-text p-button-sm select-all-btn" pTooltip="Select all for logcat"
                    (click)="selectGroup(group, $event)" aria-label="Select all pods in group"></button>
          }
        </div>
        @if (group.expanded) {
          <div class="group-body">
            @for (pod of group.pods; track pod.name) {
              <div class="pod-row" [class.pod-selected]="isSelected(pod)" [class.pod-unhealthy]="!isHealthy(pod)"
                   (click)="togglePod(pod, group)" tabindex="0" role="button" aria-label="Select pod"
                   (keydown.enter)="togglePod(pod, group)" (keydown.space)="$event.preventDefault(); togglePod(pod, group)">
                <div class="pod-status-dot" [class.dot-running]="pod.status === 'Running'" [class.dot-pending]="pod.status === 'Pending'" [class.dot-error]="pod.status !== 'Running' && pod.status !== 'Pending'"></div>
                <span class="pod-name mono" (click)="openDrawer(pod, $event)" [pTooltip]="pod.name">{{ shortName(pod.name) }}</span>
                <p-tag [value]="pod.status" [severity]="statusSeverity(pod.status)" />
                @if (pod.restarts > 0) {
                  <span class="pod-restarts" [class.high]="pod.restarts > 5" [pTooltip]="pod.restarts + ' restarts'">
                    ↻ {{ pod.restarts }}
                  </span>
                }
                <div class="pod-actions">
                  <i class="pi pi-sparkles" pTooltip="AI Diagnose" aria-label="AI Diagnose" tabindex="0" role="button"
                     (click)="quickAiDiagnose(pod, $event)"></i>
                  <i class="pi pi-align-left" pTooltip="Logs" aria-label="Quick logs" tabindex="0" role="button"
                     (click)="quickLogs(pod, $event)"
                     (keydown.enter)="$event.stopPropagation(); quickLogs(pod, $event)"
                     (keydown.space)="$event.preventDefault(); $event.stopPropagation(); quickLogs(pod, $event)"></i>
                  <i class="pi pi-ellipsis-h" pTooltip="Details" aria-label="View details" tabindex="0" role="button"
                     (click)="openDrawer(pod, $event)"
                     (keydown.enter)="$event.stopPropagation(); openDrawer(pod, $event)"
                     (keydown.space)="$event.preventDefault(); $event.stopPropagation(); openDrawer(pod, $event)"></i>
                </div>
              </div>
            }
          </div>
        }
      </div>
    }

    @if (filteredGroups.length === 0 && searchQuery) {
      <div class="empty-state">
        <i class="pi pi-search"></i>
        <span>No pods matching "{{ searchQuery }}"</span>
      </div>
    }
    @if (filteredGroups.length === 0 && !searchQuery && pods.length === 0) {
      <div class="empty-state">
        <i class="pi pi-box"></i>
        <span>No pods in this namespace</span>
      </div>
    }

    <!-- Drawer -->
    <app-pod-drawer [podName]="drawerPod" [podStatus]="drawerStatus" (closed)="drawerPod = ''" />

    <!-- AI Insight Drawer -->
    <app-ai-insight-drawer
      [visible]="aiDrawerVisible"
      [loading]="aiLoading"
      [resourceName]="activePodName"
      [summary]="aiSummary"
      [findings]="aiFindings"
      [reasoning]="aiReasoning"
      (closed)="aiDrawerVisible = false" />

    <!-- Logs Dialog -->
    <p-dialog [(visible)]="logsVisible" [header]="logsTitle" [modal]="true" [style]="{ width: '85vw', height: '80vh' }" [maximizable]="true" (onHide)="onLogsHide()">
      <div class="log-viewer-container">
        @if (isLiveMode) {
          <app-log-terminal [podName]="activePodName" />
        } @else {
          <div class="log-viewer">
            @for (line of logLines; track $index) {
              <div class="log-line" [class.error-line]="isError(line)">
                <span class="line-num">{{ $index + 1 }}</span>
                <span class="line-text">{{ line }}</span>
              </div>
            }
            @if (logLines.length === 0 && !logsLoading) { <div class="log-empty">No log lines</div> }
            @if (logsLoading) { <div class="log-empty"><i class="pi pi-spin pi-spinner"></i> Loading...</div> }
          </div>
        }
      </div>
    </p-dialog>

    <!-- Inspect Dialog -->
    <p-dialog [(visible)]="inspectVisible" header="Pod Inspection" [modal]="true" [style]="{ width: '70vw' }">
      <pre class="inspect-output">{{ inspectData | json }}</pre>
    </p-dialog>

    <!-- Diagnose Dialog -->
    <p-dialog [(visible)]="diagnoseVisible" header="Diagnosis" [modal]="true" [style]="{ width: '60vw' }">
      @if (diagnoseFindings.length > 0) {
        @for (f of diagnoseFindings; track $index) {
          <div class="finding" [class]="'finding-' + f.severity">
            <div class="finding-header">
              <p-tag [value]="f.severity" [severity]="f.severity === 'critical' ? 'danger' : 'warn'" />
              <strong>{{ f.title }}</strong>
            </div>
            <p class="finding-detail">{{ f.detail }}</p>
            <p class="finding-action">→ {{ f.action }}</p>
          </div>
        }
      } @else {
        <p class="no-findings">No issues found — pod appears healthy.</p>
      }
    </p-dialog>
  `,
  styles: [`
    /* Header */
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .header-actions { display: flex; align-items: center; gap: 8px; }
    .search-wrap { position: relative; }
    .search-wrap i { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 13px; }
    .search-wrap input { padding-left: 32px !important; width: 180px; }
    .watch-dot {
      width: 8px; height: 8px; border-radius: 50%; background: var(--text-muted);
      display: inline-block; margin-right: 6px;
    }
    .watch-dot.pulsing { background: var(--danger); animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
    .watch-active { gap: 0 !important; }

    /* Summary Strip */
    .summary-strip {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
      padding: 12px 16px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
    }
    .summary-pill {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 20px;
      background: var(--bg-elevated);
      font-size: 12px;
    }
    .pill-ok { background: var(--success-subtle); }
    .pill-warn { background: var(--warning-subtle); }
    .pill-crit { background: var(--danger-subtle); }
    .pill-dot { width: 6px; height: 6px; border-radius: 50%; }
    .dot-ok { background: var(--success); }
    .dot-warn { background: var(--warning); }
    .dot-crit { background: var(--danger); }
    .pill-value { font-weight: 600; }
    .pill-label { color: var(--text-muted); }

    /* Action Bar */
    .action-bar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 16px; margin-bottom: 12px;
      background: var(--accent-subtle); border: 1px solid var(--accent); border-radius: var(--radius-sm);
    }
    .action-count { font-size: 13px; color: var(--accent); }
    .action-buttons { display: flex; gap: 6px; }

    /* Groups */
    .pod-group {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: var(--radius); margin-bottom: 8px; overflow: hidden;
      transition: border-color 0.15s;
    }
    .pod-group:hover { border-color: var(--border-hover); }
    .group-unhealthy { border-left: 3px solid var(--danger); }
    .group-header {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 16px; cursor: pointer; transition: background 0.1s;
      outline: none;
    }
    .group-header:focus-visible { background: var(--bg-hover); box-shadow: inset 0 0 0 2px var(--accent); }
    .group-header:hover { background: var(--bg-hover); }
    .group-header > i { color: var(--text-muted); font-size: 11px; width: 12px; }
    .group-name { font-size: 13px; font-weight: 600; }
    .group-health-bar {
      width: 48px; height: 4px; border-radius: 2px;
      background: var(--bg-elevated); overflow: hidden;
    }
    .ghb-fill { height: 100%; border-radius: 2px; transition: width 0.4s; }
    .ghb-ok { background: var(--success); }
    .ghb-bad { background: var(--danger); }
    .group-ratio { font-size: 11px; color: var(--text-muted); font-family: 'JetBrains Mono', monospace; }
    .select-all-btn { margin-left: auto !important; }

    /* Pod Rows */
    .group-body { border-top: 1px solid var(--border); }
    .pod-row {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 16px 8px 36px; cursor: pointer;
      transition: background 0.1s; position: relative;
      outline: none;
    }
    .pod-row:focus-visible { background: var(--bg-hover); box-shadow: inset 0 0 0 2px var(--accent); }
    .pod-row:hover { background: var(--bg-hover); }
    .pod-row:hover .pod-actions { opacity: 1; }
    .pod-row.pod-selected { background: var(--accent-subtle); }
    .pod-row.pod-unhealthy { background: var(--danger-subtle); }
    .pod-status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .dot-running { background: var(--success); }
    .dot-pending { background: var(--warning); animation: pulse 2s infinite; }
    .dot-error { background: var(--danger); }
    .pod-name {
      flex: 1; font-size: 12px; cursor: pointer;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      transition: color 0.12s;
    }
    .pod-name:hover { color: var(--accent); }
    .pod-restarts {
      font-size: 11px; color: var(--text-muted);
      font-family: 'JetBrains Mono', monospace;
    }
    .pod-restarts.high { color: var(--danger); font-weight: 600; }
    .pod-actions {
      display: flex; gap: 6px; opacity: 0; transition: opacity 0.15s;
      margin-left: auto;
    }
    .pod-actions i {
      font-size: 13px; color: var(--text-muted); cursor: pointer;
      padding: 4px; border-radius: 4px; transition: all 0.1s;
    }
    .pod-actions i:hover { color: var(--accent); background: var(--accent-subtle); }

    /* Empty */
    .empty-state {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      padding: 48px; color: var(--text-muted); font-size: 13px;
    }
    .empty-state i { font-size: 28px; opacity: 0.3; }

    /* Dialogs */
    .log-viewer-container { height: 100%; display: flex; flex-direction: column; overflow: hidden; background: #070708; border-radius: 8px; }
    .log-viewer { height: 100%; overflow-y: auto; font-family: 'JetBrains Mono', monospace; font-size: 12px; line-height: 1.7; }
    .log-line { display: flex; gap: 12px; padding: 1px 12px; }
    .log-line:hover { background: var(--bg-hover); }
    .error-line { background: var(--danger-subtle); }
    .line-num { color: var(--text-muted); min-width: 32px; text-align: right; user-select: none; }
    .line-text { white-space: pre-wrap; word-break: break-all; }
    .log-empty { text-align: center; padding: 40px; color: var(--text-muted); }
    .inspect-output { font-family: 'JetBrains Mono', monospace; font-size: 12px; white-space: pre-wrap; max-height: 500px; overflow-y: auto; background: var(--bg-elevated); padding: 16px; border-radius: var(--radius-sm); }
    .finding { padding: 16px; border-radius: var(--radius-sm); margin-bottom: 12px; border: 1px solid var(--border); }
    .finding-critical { border-left: 3px solid var(--danger); }
    .finding-warning { border-left: 3px solid var(--warning); }
    .finding-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
    .finding-detail { font-size: 13px; color: var(--text-secondary); margin: 4px 0; }
    .finding-action { font-size: 12px; color: var(--text-muted); margin: 4px 0; }
    .no-findings { text-align: center; padding: 24px; color: var(--text-muted); }
  `],
})
export class PodsComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private ws = inject(WsService);
  private route = inject(ActivatedRoute);
  private watchSub: Subscription | null = null;
  private watchClose: (() => void) | null = null;
  watching = false;
  pods: Pod[] = [];
  groups: PodGroup[] = [];
  filteredGroups: PodGroup[] = [];
  selected: Pod[] = [];
  selectedGroup = '';
  searchQuery = '';

  // Dialogs
  logsVisible = false;
  logsTitle = '';
  logLines: string[] = [];
  logsLoading = false;
  isLiveMode = false;
  activePodName = '';
  inspectVisible = false;
  inspectData: any = null;

  // AI Insight State
  aiDrawerVisible = false;
  aiLoading = false;
  aiSummary = '';
  aiFindings: any[] = [];
  aiReasoning = '';

  diagnoseVisible = false;
  diagnoseFindings: any[] = [];
  drawerPod = '';
  drawerStatus = '';

  get healthyCount() { return this.pods.filter(p => this.isHealthy(p)).length; }
  get warningCount() { return this.pods.filter(p => p.status === 'Running' && p.restarts > 5).length; }
  get criticalCount() { return this.pods.filter(p => p.status !== 'Running' && p.status !== 'Pending').length; }

  statusSeverity(status: string): 'success' | 'warn' | 'danger' | 'secondary' | undefined {
    switch (status) { case 'Running': return 'success'; case 'Pending': return 'warn'; default: return 'danger'; }
  }

  isHealthy(pod: Pod): boolean { return pod.status === 'Running' && pod.restarts <= 5; }
  isError(line: string): boolean { const l = line.toLowerCase(); return l.includes('error') || l.includes('fatal') || l.includes('panic'); }
  isSelected(pod: Pod): boolean { return this.selected.some(p => p.name === pod.name); }

  shortName(name: string): string {
    // Show last meaningful segment for readability
    if (name.length <= 40) return name;
    return '...' + name.slice(-37);
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
  openDrawer(pod: Pod, event: Event) { event.stopPropagation(); this.drawerPod = pod.name; this.drawerStatus = pod.status; }

  quickLogs(pod: Pod, event: Event) {
    event.stopPropagation();
    this.logsTitle = `Logs — ${pod.name}`;
    this.logsVisible = true;
    this.logsLoading = true;
    this.logLines = [];
    this.api.getLogs(pod.name, 100).subscribe(res => { this.logLines = res.lines; this.logsLoading = false; });
  }

  filterGroups() {
    const q = this.searchQuery.toLowerCase();
    if (!q) { this.filteredGroups = this.groups; return; }
    this.filteredGroups = this.groups.map(g => ({ ...g, pods: g.pods.filter(p => p.name.toLowerCase().includes(q)) })).filter(g => g.pods.length > 0 || g.deployment.toLowerCase().includes(q));
  }

  viewLogs() { const pod = this.selected[0]; this.logsTitle = `Logs — ${pod.name}`; this.logsVisible = true; this.logsLoading = true; this.logLines = []; this.api.getLogs(pod.name, 200).subscribe(res => { this.logLines = res.lines; this.logsLoading = false; }); }

  viewLogcat() {
    const names = this.selected.map(p => p.name);
    this.logsTitle = `Logcat — ${this.selectedGroup} (${names.length})`;
    this.logsVisible = true; this.logsLoading = true; this.logLines = [];
    const allLines: string[] = []; let done = 0;
    for (const name of names) { this.api.getLogs(name, 50).subscribe(res => { const short = name.slice(name.lastIndexOf('-') + 1); for (const line of res.lines) { allLines.push(`[${short}] ${line}`); } done++; if (done === names.length) { this.logLines = allLines; this.logsLoading = false; } }); }
  }

  inspectPod() { const pod = this.selected[0]; this.inspectVisible = true; this.inspectData = null; this.api.inspect(pod.name).subscribe(res => { this.inspectData = res; }); }

  diagnosePod() {
    const pod = this.selected[0];
    this.openAiDiagnose(pod.name);
  }

  quickAiDiagnose(pod: Pod, event: Event) {
    event.stopPropagation();
    this.openAiDiagnose(pod.name);
  }

  private openAiDiagnose(name: string) {
    this.activePodName = name;
    this.aiDrawerVisible = true;
    this.aiLoading = true;
    this.aiFindings = [];
    this.aiSummary = '';
    this.aiReasoning = '';

    this.api.diagnose(name).subscribe({
      next: (res) => {
        this.aiFindings = res.findings || [];
        this.aiSummary = res.summary || `Analysis of ${name} complete. ${this.aiFindings.length} issues identified.`;
        this.aiReasoning = res.reasoning || 'AI checked pod events, container states, and recent log patterns.';
        this.aiLoading = false;
      },
      error: () => {
        this.aiSummary = 'Failed to perform AI diagnosis. Please check cluster connectivity.';
        this.aiLoading = false;
      }
    });
  }

  refresh() { this.api.getPods().subscribe(res => { this.pods = res.pods; this.groupPods(); this.filterGroups(); }); }

  private groupPods() {
    const map = new Map<string, Pod[]>();
    for (const pod of this.pods) { const dep = this.extractDeployment(pod.name); if (!map.has(dep)) map.set(dep, []); map.get(dep)!.push(pod); }
    this.groups = Array.from(map.entries()).map(([deployment, pods]) => {
      const unhealthyCount = pods.filter(p => !this.isHealthy(p)).length;
      return { deployment, pods, expanded: true, unhealthyCount, healthPct: pods.length > 0 ? Math.round(((pods.length - unhealthyCount) / pods.length) * 100) : 100 };
    }).sort((a, b) => { if (a.unhealthyCount > 0 && b.unhealthyCount === 0) return -1; if (a.unhealthyCount === 0 && b.unhealthyCount > 0) return 1; return a.deployment.localeCompare(b.deployment); });
  }

  private extractDeployment(podName: string): string { const parts = podName.split('-'); return parts.length > 2 ? parts.slice(0, -2).join('-') : podName; }

  ngOnInit() { this.refresh(); this.route.queryParams.subscribe(params => { if (params['filter']) { this.searchQuery = params['filter']; this.filterGroups(); } }); }
  ngOnDestroy() { this.stopWatch(); }
  toggleWatch() { this.watching ? this.stopWatch() : this.startWatch(); }
  private startWatch() { this.watching = true; const conn = this.ws.connect('/ws/pods'); this.watchClose = conn.close; this.watchSub = conn.messages$.subscribe({ next: (data) => { this.pods = JSON.parse(data); this.groupPods(); this.filterGroups(); }, complete: () => { this.watching = false; } }); }
  private stopWatch() { this.watching = false; this.watchSub?.unsubscribe(); this.watchClose?.(); this.watchSub = null; this.watchClose = null; }
  viewLiveLogs() {
    const pod = this.selected[0];
    this.activePodName = pod.name;
    this.logsTitle = `Live — ${pod.name}`;
    this.isLiveMode = true;
    this.logsVisible = true;
  }

  onLogsHide() {
    this.isLiveMode = false;
    this.activePodName = '';
  }
}
