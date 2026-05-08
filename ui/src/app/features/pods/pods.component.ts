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

interface PodGroup {
  deployment: string;
  pods: Pod[];
  expanded: boolean;
  unhealthyCount: number;
}

@Component({
  selector: 'app-pods',
  standalone: true,
  imports: [JsonPipe, TagModule, ButtonModule, TooltipModule, DialogModule, InputTextModule, FormsModule, PodDrawerComponent],
  template: `
    <div class="page-header">
      <div>
        <h1>Pods</h1>
        <p class="subtitle">{{ pods.length }} pods in {{ filteredGroups.length }} groups</p>
      </div>
      <div class="header-actions">
        <span class="search-wrap">
          <i class="pi pi-search"></i>
          <input pInputText [(ngModel)]="searchQuery" placeholder="Filter pods..." (ngModelChange)="filterGroups()" />
        </span>
        <button pButton [icon]="watching ? 'pi pi-stop' : 'pi pi-play'" [label]="watching ? 'Stop Watch' : 'Watch'"
                [class]="watching ? 'p-button-danger p-button-sm' : 'p-button-outlined p-button-sm'" (click)="toggleWatch()"></button>
        <button pButton icon="pi pi-refresh" label="Refresh" class="p-button-outlined p-button-sm" (click)="refresh()"></button>
      </div>
    </div>

    <!-- Context Actions Bar -->
    @if (selected.length > 0) {
      <div class="action-bar">
        <span class="action-count">{{ selected.length }} selected in <strong>{{ selectedGroup }}</strong></span>
        <div class="action-buttons">
          @if (selected.length === 1) {
            <button pButton icon="pi pi-align-left" label="Logs" class="p-button-sm" (click)="viewLogs()"></button>
            <button pButton icon="pi pi-play" label="Live Logs" class="p-button-sm p-button-success" (click)="viewLiveLogs()"></button>
            <button pButton icon="pi pi-search" label="Inspect" class="p-button-sm p-button-secondary" (click)="inspectPod()"></button>
            <button pButton icon="pi pi-exclamation-triangle" label="Diagnose" class="p-button-sm p-button-warning" (click)="diagnosePod()"></button>
          }
          @if (selected.length > 1) {
            <button pButton icon="pi pi-list" label="Combined Logs ({{ selected.length }} pods)" class="p-button-sm" (click)="viewLogcat()"></button>
          }
          <button pButton icon="pi pi-times" class="p-button-sm p-button-text" pTooltip="Clear" (click)="clearSelection()"></button>
        </div>
      </div>
    }

    <!-- Grouped Pods -->
    @for (group of filteredGroups; track group.deployment) {
      <div class="pod-group" [class.group-unhealthy]="group.unhealthyCount > 0">
        <div class="group-header" (click)="group.expanded = !group.expanded">
          <i class="pi" [class.pi-chevron-down]="group.expanded" [class.pi-chevron-right]="!group.expanded"></i>
          <span class="group-name">{{ group.deployment }}</span>
          <span class="group-count">{{ group.pods.length }}</span>
          @if (group.unhealthyCount > 0) {
            <span class="group-alert">
              <i class="pi pi-exclamation-circle"></i>
              {{ group.unhealthyCount }} need{{ group.unhealthyCount === 1 ? 's' : '' }} attention
            </span>
          }
          @if (group.pods.length > 1) {
            <button pButton label="Select All" class="p-button-text p-button-sm select-all-btn"
                    (click)="selectGroup(group, $event)"></button>
          }
        </div>
        @if (group.expanded) {
          <div class="group-body">
            @for (pod of group.pods; track pod.name) {
              <div class="pod-row" [class.pod-selected]="isSelected(pod)" [class.pod-unhealthy]="!isHealthy(pod)" (click)="togglePod(pod, group)">
                <div class="pod-check">
                  <i class="pi" [class.pi-check-square]="isSelected(pod)" [class.pi-stop]="!isSelected(pod)"></i>
                </div>
                <code class="pod-name mono clickable" (click)="openDrawer(pod, $event)">{{ pod.name }}</code>
                <p-tag [value]="pod.status" [severity]="statusSeverity(pod.status)" />
                @if (pod.restarts > 0) {
                  <span class="pod-restarts" [class.high]="pod.restarts > 5">
                    <i class="pi pi-replay"></i> {{ pod.restarts }}
                  </span>
                }
              </div>
            }
          </div>
        }
      </div>
    }

    @if (filteredGroups.length === 0 && searchQuery) {
      <div class="empty-state">No pods matching "{{ searchQuery }}"</div>
    }

    <!-- Pod Detail Drawer -->
    <app-pod-drawer [podName]="drawerPod" [podStatus]="drawerStatus" (closed)="drawerPod = ''" />

    <!-- Logs Dialog -->
    <p-dialog [(visible)]="logsVisible" [header]="logsTitle" [modal]="true" [style]="{ width: '80vw', height: '70vh' }" [maximizable]="true">
      <div class="log-viewer">
        @for (line of logLines; track $index) {
          <div class="log-line" [class.error-line]="isError(line)">
            <span class="line-num">{{ $index + 1 }}</span>
            <span class="line-text">{{ line }}</span>
          </div>
        }
        @if (logLines.length === 0 && !logsLoading) {
          <div class="log-empty">No log lines</div>
        }
        @if (logsLoading) {
          <div class="log-empty"><i class="pi pi-spin pi-spinner"></i> Loading...</div>
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
    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 24px;
    }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .header-actions { display: flex; align-items: center; gap: 10px; }
    .search-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }
    .search-wrap i {
      position: absolute;
      left: 10px;
      color: var(--text-muted);
      font-size: 13px;
    }
    .search-wrap input {
      padding-left: 32px !important;
      width: 200px;
    }

    .action-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      margin-bottom: 12px;
      background: var(--accent-subtle);
      border: 1px solid var(--accent);
      border-radius: var(--radius-sm);
    }
    .action-count { font-size: 13px; color: var(--accent); }
    .action-buttons { display: flex; gap: 8px; }

    .pod-group {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      margin-bottom: 8px;
      overflow: hidden;
      transition: border-color 0.15s;
    }
    .pod-group:hover { border-color: var(--border-hover); }
    .group-unhealthy {
      border-color: var(--danger) !important;
      border-left: 3px solid var(--danger);
    }
    .group-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      cursor: pointer;
      transition: background 0.1s;
    }
    .group-header:hover { background: var(--bg-hover); }
    .group-header > i { color: var(--text-muted); font-size: 12px; width: 14px; }
    .group-name { font-size: 14px; font-weight: 600; }
    .group-count {
      font-size: 11px;
      color: var(--text-muted);
      background: var(--bg-elevated);
      padding: 1px 6px;
      border-radius: 4px;
    }
    .group-alert {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      color: var(--danger);
      font-weight: 500;
    }
    .group-alert i { font-size: 12px; }
    .select-all-btn { margin-left: auto !important; }

    .group-body { border-top: 1px solid var(--border); }
    .pod-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 16px 10px 40px;
      cursor: pointer;
      transition: background 0.1s;
    }
    .pod-row:hover { background: var(--bg-hover); }
    .pod-row.pod-selected { background: var(--accent-subtle); }
    .pod-row.pod-unhealthy { background: var(--danger-subtle); }
    .pod-row.pod-unhealthy.pod-selected { background: var(--accent-subtle); }
    .pod-check i { color: var(--text-muted); font-size: 14px; }
    .pod-selected .pod-check i { color: var(--accent); }
    .pod-name.clickable {
      cursor: pointer;
      transition: color 0.12s;
    }
    .pod-name.clickable:hover {
      color: var(--accent);
      text-decoration: underline;
    }
    .pod-restarts {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      color: var(--text-muted);
      margin-left: auto;
    }
    .pod-restarts i { font-size: 10px; }
    .pod-restarts.high { color: var(--danger); font-weight: 600; }

    .empty-state {
      text-align: center;
      padding: 48px;
      color: var(--text-muted);
      font-size: 13px;
    }

    .log-viewer {
      height: 100%;
      overflow-y: auto;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      line-height: 1.7;
    }
    .log-line { display: flex; gap: 12px; padding: 1px 12px; }
    .log-line:hover { background: var(--bg-hover); }
    .error-line { background: var(--danger-subtle); }
    .line-num { color: var(--text-muted); min-width: 32px; text-align: right; user-select: none; }
    .line-text { white-space: pre-wrap; word-break: break-all; }
    .log-empty { text-align: center; padding: 40px; color: var(--text-muted); }

    .inspect-output {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      white-space: pre-wrap;
      max-height: 500px;
      overflow-y: auto;
      background: var(--bg-elevated);
      padding: 16px;
      border-radius: var(--radius-sm);
    }
    .finding {
      padding: 16px;
      border-radius: var(--radius-sm);
      margin-bottom: 12px;
      border: 1px solid var(--border);
    }
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
  inspectVisible = false;
  inspectData: any = null;
  diagnoseVisible = false;
  diagnoseFindings: any[] = [];

  // Drawer
  drawerPod = '';
  drawerStatus = '';

  statusSeverity(status: string): 'success' | 'warn' | 'danger' | 'secondary' | undefined {
    switch (status) {
      case 'Running': return 'success';
      case 'Pending': return 'warn';
      default: return 'danger';
    }
  }

  isHealthy(pod: Pod): boolean {
    return pod.status === 'Running' && pod.restarts <= 5;
  }

  isError(line: string): boolean {
    const l = line.toLowerCase();
    return l.includes('error') || l.includes('fatal') || l.includes('panic');
  }

  isSelected(pod: Pod): boolean {
    return this.selected.some(p => p.name === pod.name);
  }

  togglePod(pod: Pod, group: PodGroup) {
    if (this.selectedGroup && this.selectedGroup !== group.deployment) {
      this.selected = [];
    }
    this.selectedGroup = group.deployment;
    const idx = this.selected.findIndex(p => p.name === pod.name);
    if (idx >= 0) {
      this.selected.splice(idx, 1);
      this.selected = [...this.selected];
      if (this.selected.length === 0) this.selectedGroup = '';
    } else {
      this.selected = [...this.selected, pod];
    }
  }

  selectGroup(group: PodGroup, event: Event) {
    event.stopPropagation();
    this.selected = [...group.pods];
    this.selectedGroup = group.deployment;
  }

  clearSelection() {
    this.selected = [];
    this.selectedGroup = '';
  }

  openDrawer(pod: Pod, event: Event) {
    event.stopPropagation(); // Don't trigger row selection
    this.drawerPod = pod.name;
    this.drawerStatus = pod.status;
  }

  filterGroups() {
    const q = this.searchQuery.toLowerCase();
    if (!q) {
      this.filteredGroups = this.groups;
      return;
    }
    this.filteredGroups = this.groups
      .map(g => ({
        ...g,
        pods: g.pods.filter(p => p.name.toLowerCase().includes(q)),
      }))
      .filter(g => g.pods.length > 0 || g.deployment.toLowerCase().includes(q));
  }

  viewLogs() {
    const pod = this.selected[0];
    this.logsTitle = `Logs — ${pod.name}`;
    this.logsVisible = true;
    this.logsLoading = true;
    this.logLines = [];
    this.api.getLogs(pod.name, 200).subscribe(res => {
      this.logLines = res.lines;
      this.logsLoading = false;
    });
  }

  viewLogcat() {
    const names = this.selected.map(p => p.name);
    this.logsTitle = `Combined Logs — ${this.selectedGroup} (${names.length} pods)`;
    this.logsVisible = true;
    this.logsLoading = true;
    this.logLines = [];
    const allLines: string[] = [];
    let done = 0;
    for (const name of names) {
      this.api.getLogs(name, 50).subscribe(res => {
        const short = name.slice(name.lastIndexOf('-') + 1);
        for (const line of res.lines) {
          allLines.push(`[${short}] ${line}`);
        }
        done++;
        if (done === names.length) {
          this.logLines = allLines;
          this.logsLoading = false;
        }
      });
    }
  }

  inspectPod() {
    const pod = this.selected[0];
    this.inspectVisible = true;
    this.inspectData = null;
    this.api.inspect(pod.name).subscribe(res => { this.inspectData = res; });
  }

  diagnosePod() {
    const pod = this.selected[0];
    this.diagnoseVisible = true;
    this.diagnoseFindings = [];
    this.api.diagnose(pod.name).subscribe(res => { this.diagnoseFindings = res.findings; });
  }

  refresh() {
    this.api.getPods().subscribe(res => {
      this.pods = res.pods;
      this.groupPods();
      this.filterGroups();
    });
  }

  private groupPods() {
    const map = new Map<string, Pod[]>();
    for (const pod of this.pods) {
      const dep = this.extractDeployment(pod.name);
      if (!map.has(dep)) map.set(dep, []);
      map.get(dep)!.push(pod);
    }
    this.groups = Array.from(map.entries())
      .map(([deployment, pods]) => ({
        deployment,
        pods,
        expanded: true,
        unhealthyCount: pods.filter(p => !this.isHealthy(p)).length,
      }))
      // Sort: unhealthy groups first, then alphabetical
      .sort((a, b) => {
        if (a.unhealthyCount > 0 && b.unhealthyCount === 0) return -1;
        if (a.unhealthyCount === 0 && b.unhealthyCount > 0) return 1;
        return a.deployment.localeCompare(b.deployment);
      });
  }

  private extractDeployment(podName: string): string {
    const parts = podName.split('-');
    if (parts.length > 2) {
      return parts.slice(0, -2).join('-');
    }
    return podName;
  }

  ngOnInit() {
    this.refresh();
    // Read filter from query params (e.g. from deployments page)
    this.route.queryParams.subscribe(params => {
      if (params['filter']) {
        this.searchQuery = params['filter'];
        this.filterGroups();
      }
    });
  }

  ngOnDestroy() {
    this.stopWatch();
  }

  toggleWatch() {
    if (this.watching) {
      this.stopWatch();
    } else {
      this.startWatch();
    }
  }

  private startWatch() {
    this.watching = true;
    const conn = this.ws.connect('/ws/pods');
    this.watchClose = conn.close;
    this.watchSub = conn.messages$.subscribe({
      next: (data) => {
        this.pods = JSON.parse(data);
        this.groupPods();
        this.filterGroups();
      },
      complete: () => { this.watching = false; },
    });
  }

  private stopWatch() {
    this.watching = false;
    this.watchSub?.unsubscribe();
    this.watchClose?.();
    this.watchSub = null;
    this.watchClose = null;
  }

  viewLiveLogs() {
    const pod = this.selected[0];
    this.logsTitle = `Live Logs — ${pod.name}`;
    this.logsVisible = true;
    this.logsLoading = false;
    this.logLines = [];

    const conn = this.ws.connect(`/ws/logs/${pod.name}`);
    const sub = conn.messages$.subscribe({
      next: (line) => {
        this.logLines = [...this.logLines, line];
      },
      complete: () => {},
    });

    // Store for cleanup when dialog closes
    const origClose = this.logsVisible;
    const interval = setInterval(() => {
      if (!this.logsVisible) {
        sub.unsubscribe();
        conn.close();
        clearInterval(interval);
      }
    }, 500);
  }
}
