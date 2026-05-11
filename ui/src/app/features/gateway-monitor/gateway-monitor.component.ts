import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { PageInfoComponent } from '../../shared/components/page-info.component';
import { WsService } from '../../core/services/ws.service';
import { Subscription } from 'rxjs';

interface GatewayEntry {
  deployment: string;
  cluster: string;
  version: string;
  pods: number;
  pods_not_ready: number;
  cpu_req_per_pod: number;
  cpu_usage_per_pod: number;
  cpu_req_sum: number;
  cpu_usage_sum: number;
  hpa_cpu_target: number | null;
  hpa_cpu_current: number | null;
  hpa_mem_target: number | null;
  hpa_mem_current: number | null;
  mem_req_per_pod: number;
  mem_usage_per_pod: number;
  mem_limit_per_pod: number;
  mem_req_limit_ratio: number;
  workload: string;
  lba: string;
  note: string;
}

interface ColumnDef {
  key: string;
  label: string;
  group: string;
  visible: boolean;
}

@Component({
  selector: 'app-gateway-monitor',
  standalone: true,
  imports: [FormsModule, ButtonModule, TooltipModule, TagModule, InputTextModule, PageInfoComponent],
  template: `
    <div class="page-header">
      <div>
        <h1>Gateway Monitor</h1>
        <p class="subtitle">{{ filtered.length }} deployments · {{ visibleColumns.length }}/{{ columns.length }} columns</p>
      </div>
      <div class="header-actions">
        <div class="search-wrap">
          <i class="pi pi-search"></i>
          <input pInputText [(ngModel)]="searchQuery" placeholder="Filter..." (ngModelChange)="filter()" />
        </div>

        <!-- Refresh Interval -->
        <div class="interval-config">
          <span class="interval-label">Refresh</span>
          <div class="interval-btns">
            @for (opt of intervalOptions; track opt.value) {
              <button class="int-btn" [class.active]="refreshInterval === opt.value" (click)="setInterval(opt.value)">{{ opt.label }}</button>
            }
          </div>
        </div>

        <!-- Live -->
        <button pButton [class]="streaming ? 'p-button-danger p-button-sm' : 'p-button-outlined p-button-sm'" (click)="toggleStream()">
          <span class="live-dot" [class.pulsing]="streaming"></span>
          {{ streaming ? 'Live' : 'Connect' }}
        </button>

        <!-- Column Config -->
        <div class="col-config-wrap">
          <button pButton icon="pi pi-cog" class="p-button-outlined p-button-sm p-button-rounded" pTooltip="Configure columns" (click)="configOpen = !configOpen"></button>
          @if (configOpen) {
            <div class="col-config-panel">
              <div class="cfg-panel-header">
                <span>Columns</span>
                <div class="cfg-panel-actions">
                  <button class="cfg-link" (click)="showAll()">All</button>
                  <button class="cfg-link" (click)="showNone()">None</button>
                  <button class="cfg-link" (click)="resetColumns()">Reset</button>
                </div>
              </div>
              @for (group of columnGroups; track group) {
                <div class="cfg-group">
                  <span class="cfg-group-label">{{ group }}</span>
                  @for (col of columnsByGroup(group); track col.key) {
                    <label class="cfg-item">
                      <input type="checkbox" [(ngModel)]="col.visible" (ngModelChange)="saveColumns()" />
                      <span>{{ col.label }}</span>
                    </label>
                  }
                </div>
              }
            </div>
          }
        </div>

        <button pButton icon="pi pi-refresh" class="p-button-outlined p-button-sm p-button-rounded" (click)="manualRefresh()" pTooltip="Manual refresh"></button>
        <app-page-info title="Gateway Monitor" description="Deployment-level resource metrics. Configure visible columns via the gear icon."
          [tips]="['Click gear icon to show/hide columns', 'Column config is saved to browser', 'Red rows = pods not ready', 'Change refresh interval while live']"
          [commands]="['top pods', 'top nodes', 'overview']" />
      </div>
    </div>

    <!-- Summary -->
    <div class="summary-strip">
      <div class="summary-pill">
        <span class="pill-val">{{ entries.length }}</span>
        <span class="pill-label">Deployments</span>
      </div>
      <div class="summary-pill pill-ok">
        <span class="pill-dot dot-ok"></span>
        <span class="pill-val">{{ totalPods }}</span>
        <span class="pill-label">Pods</span>
      </div>
      @if (totalNotReady > 0) {
        <div class="summary-pill pill-bad">
          <span class="pill-dot dot-bad"></span>
          <span class="pill-val">{{ totalNotReady }}</span>
          <span class="pill-label">Not Ready</span>
        </div>
      }
      <div class="summary-pill">
        <span class="pill-val">{{ totalCpuUsage }}</span>
        <span class="pill-label">CPU cores</span>
      </div>
      @if (lastUpdated) {
        <div class="summary-pill pill-time">
          <i class="pi pi-clock"></i>
          <span class="pill-label">{{ lastUpdated }}</span>
        </div>
      }
    </div>

    <!-- Table -->
    <div class="table-container">
      <table class="gw-table">
        <thead>
          <tr>
            @for (col of visibleColumns; track col.key) {
              <th [class.sticky-col]="col.key === 'deployment'" (click)="sort(col.key)">
                {{ col.label }} <i class="pi pi-sort-alt"></i>
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @for (e of filtered; track e.deployment) {
            <tr [class.row-warn]="e.pods_not_ready > 0">
              @for (col of visibleColumns; track col.key) {
                <td [class.sticky-col]="col.key === 'deployment'" [class.cell-num]="isNumCol(col.key)" [class.cell-hot]="isCellHot(col.key, e)">
                  @switch (col.key) {
                    @case ('deployment') { <code class="cell-name-text">{{ e.deployment }}</code> }
                    @case ('cluster') { <span class="cell-mono">{{ shortCluster(e.cluster) }}</span> }
                    @case ('version') { <span class="version-tag">{{ e.version }}</span> }
                    @case ('pods') { {{ e.pods }} }
                    @case ('pods_not_ready') {
                      @if (e.pods_not_ready > 0) { <span class="not-ready-badge">{{ e.pods_not_ready }}</span> }
                      @else { <span class="all-ready">0</span> }
                    }
                    @case ('cpu_req_per_pod') { {{ e.cpu_req_per_pod }}m }
                    @case ('cpu_usage_per_pod') { {{ e.cpu_usage_per_pod }}m }
                    @case ('cpu_req_sum') { {{ e.cpu_req_sum }} }
                    @case ('cpu_usage_sum') { {{ e.cpu_usage_sum }} }
                    @case ('hpa_cpu') {
                      @if (e.hpa_cpu_target !== null) {
                        <span class="hpa-pair">
                          <span class="hpa-target">{{ e.hpa_cpu_target }}</span><span class="hpa-sep">/</span><span class="hpa-current" [class.hpa-over]="e.hpa_cpu_current! > e.hpa_cpu_target!">{{ e.hpa_cpu_current ?? '—' }}</span>
                        </span>
                      } @else { <span class="cell-na">—</span> }
                    }
                    @case ('hpa_mem') {
                      @if (e.hpa_mem_target !== null) {
                        <span class="hpa-pair">
                          <span class="hpa-target">{{ e.hpa_mem_target }}</span><span class="hpa-sep">/</span><span class="hpa-current" [class.hpa-over]="e.hpa_mem_current! > e.hpa_mem_target!">{{ e.hpa_mem_current ?? '—' }}</span>
                        </span>
                      } @else { <span class="cell-na">—</span> }
                    }
                    @case ('mem_req_per_pod') { {{ e.mem_req_per_pod }} }
                    @case ('mem_usage_per_pod') { {{ e.mem_usage_per_pod }} }
                    @case ('mem_limit_per_pod') { {{ e.mem_limit_per_pod }} }
                    @case ('mem_req_limit_ratio') {
                      <span class="ratio-bar"><span class="ratio-fill" [style.width.%]="e.mem_req_limit_ratio * 100"></span></span>
                      <span class="ratio-text">{{ e.mem_req_limit_ratio }}</span>
                    }
                    @case ('workload') { {{ e.workload || '—' }} }
                    @case ('lba') { {{ e.lba || '—' }} }
                    @case ('note') { {{ e.note || '' }} }
                  }
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>

    @if (filtered.length === 0 && searchQuery) {
      <div class="empty-state"><i class="pi pi-search"></i> No deployments matching "{{ searchQuery }}"</div>
    }
    @if (loading && entries.length === 0) {
      <div class="empty-state"><i class="pi pi-spin pi-spinner"></i> Loading...</div>
    }
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .header-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .search-wrap { position: relative; }
    .search-wrap i { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 12px; }
    .search-wrap input { padding-left: 30px !important; width: 160px; }

    /* Interval */
    .interval-config {
      display: flex; align-items: center; gap: 6px;
      padding: 4px 8px; border-radius: 8px;
      background: var(--bg-elevated); border: 1px solid var(--border);
    }
    .interval-label { font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .interval-btns { display: flex; gap: 2px; }
    .int-btn {
      padding: 4px 8px; border: 1px solid transparent; border-radius: 4px;
      background: none; color: var(--text-muted); font-size: 11px; font-weight: 500;
      cursor: pointer; transition: all 0.15s;
    }
    .int-btn:hover { color: var(--text); background: var(--bg-hover); }
    .int-btn.active { border-color: var(--accent); background: var(--accent-subtle); color: var(--accent); font-weight: 700; }

    /* Live */
    .live-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--text-muted); display: inline-block; margin-right: 6px; }
    .live-dot.pulsing { background: var(--danger); animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

    /* Column Config */
    .col-config-wrap { position: relative; }
    .col-config-panel {
      position: absolute; top: 40px; right: 0; z-index: 100;
      width: 280px; max-height: 400px; overflow-y: auto;
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,0.4);
      padding: 12px; animation: cfgIn 0.15s ease-out;
    }
    @keyframes cfgIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
    .cfg-panel-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid var(--border);
      font-size: 12px; font-weight: 700;
    }
    .cfg-panel-actions { display: flex; gap: 8px; }
    .cfg-link {
      background: none; border: none; color: var(--accent); font-size: 11px;
      cursor: pointer; font-weight: 500; padding: 0;
    }
    .cfg-link:hover { text-decoration: underline; }
    .cfg-group { margin-bottom: 10px; }
    .cfg-group-label {
      display: block; font-size: 9px; font-weight: 700; color: var(--text-muted);
      text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px;
    }
    .cfg-item {
      display: flex; align-items: center; gap: 8px;
      padding: 4px 6px; border-radius: 4px; cursor: pointer; font-size: 12px;
      color: var(--text-secondary); transition: background 0.1s;
    }
    .cfg-item:hover { background: var(--bg-hover); }
    .cfg-item input[type="checkbox"] {
      width: 14px; height: 14px; accent-color: var(--accent); cursor: pointer;
    }

    /* Summary */
    .summary-strip {
      display: flex; gap: 8px; margin-bottom: 16px;
      padding: 14px 18px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
    }
    .summary-pill { display: flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px; background: var(--bg-elevated); font-size: 12px; }
    .pill-ok { background: var(--success-subtle); }
    .pill-bad { background: var(--danger-subtle); }
    .pill-time { margin-left: auto; }
    .pill-time i { font-size: 11px; color: var(--text-muted); }
    .pill-dot { width: 6px; height: 6px; border-radius: 50%; }
    .dot-ok { background: var(--success); }
    .dot-bad { background: var(--danger); }
    .pill-val { font-weight: 700; }
    .pill-label { color: var(--text-muted); }

    /* Table */
    .table-container { overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg-card); }
    .gw-table { width: 100%; border-collapse: collapse; font-size: 12px; white-space: nowrap; }
    .gw-table thead { position: sticky; top: 0; z-index: 2; }
    .gw-table th {
      padding: 10px 12px; text-align: left; font-size: 10px;
      font-weight: 700; color: var(--text-muted); text-transform: uppercase;
      letter-spacing: 0.04em; background: var(--bg-elevated);
      border-bottom: 1px solid var(--border); cursor: pointer; user-select: none;
    }
    .gw-table th i { font-size: 9px; opacity: 0.4; margin-left: 2px; }
    .gw-table th:hover { color: var(--text); }
    .gw-table td { padding: 10px 12px; border-bottom: 1px solid var(--border); color: var(--text-secondary); }
    .gw-table tr:hover td { background: var(--bg-hover); }
    .gw-table tr:last-child td { border-bottom: none; }
    .sticky-col { position: sticky; left: 0; z-index: 1; background: var(--bg-card); }
    thead .sticky-col { background: var(--bg-elevated); z-index: 3; }
    tr:hover .sticky-col { background: var(--bg-hover); }

    /* Cells */
    .cell-name-text { font-size: 11px; font-weight: 600; color: var(--text); }
    .cell-mono { font-family: 'JetBrains Mono', monospace; font-size: 11px; }
    .cell-num { font-family: 'JetBrains Mono', monospace; text-align: right; }
    .cell-hot { color: var(--danger); font-weight: 600; }
    .cell-na { color: var(--text-muted); opacity: 0.5; }
    .version-tag { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: var(--bg-elevated); border: 1px solid var(--border); font-family: 'JetBrains Mono', monospace; }
    .not-ready-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; padding: 2px 6px; border-radius: 10px; background: var(--danger-subtle); color: var(--danger); font-weight: 700; font-size: 11px; }
    .all-ready { color: var(--text-muted); opacity: 0.5; }
    .hpa-pair { display: inline-flex; align-items: center; gap: 2px; }
    .hpa-target { color: var(--text-muted); }
    .hpa-sep { color: var(--border-hover); }
    .hpa-current { font-weight: 600; color: var(--success); }
    .hpa-over { color: var(--danger) !important; }
    .ratio-bar { display: inline-block; width: 32px; height: 4px; border-radius: 2px; background: var(--bg-elevated); overflow: hidden; vertical-align: middle; margin-right: 4px; }
    .ratio-fill { display: block; height: 100%; border-radius: 2px; background: var(--accent); }
    .ratio-text { font-size: 10px; color: var(--text-muted); }
    .row-warn { background: var(--danger-subtle); }
    .row-warn .sticky-col { background: var(--danger-subtle); }
    .row-warn:hover td, .row-warn:hover .sticky-col { background: rgba(239, 68, 68, 0.08); }
    .empty-state { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 48px; color: var(--text-muted); font-size: 13px; }
  `]
})
export class GatewayMonitorComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private ws = inject(WsService);

  entries: GatewayEntry[] = [];
  filtered: GatewayEntry[] = [];
  searchQuery = '';
  loading = false;
  streaming = false;
  lastUpdated = '';
  refreshInterval = 10;
  configOpen = false;
  private sortField = '';
  private sortAsc = true;
  private wsSub: Subscription | null = null;
  private wsSend: ((msg: string) => void) | null = null;
  private wsClose: (() => void) | null = null;

  private STORAGE_KEY = 'kubsome_gw_columns';

  intervalOptions = [
    { label: '5s', value: 5 },
    { label: '10s', value: 10 },
    { label: '30s', value: 30 },
    { label: '60s', value: 60 },
  ];

  columns: ColumnDef[] = [
    { key: 'deployment', label: 'Deployment', group: 'General', visible: true },
    { key: 'cluster', label: 'Cluster', group: 'General', visible: true },
    { key: 'version', label: 'Version', group: 'General', visible: true },
    { key: 'pods', label: 'Pods', group: 'General', visible: true },
    { key: 'pods_not_ready', label: 'Not Ready', group: 'General', visible: true },
    { key: 'cpu_req_per_pod', label: 'CPU req/pod', group: 'CPU', visible: true },
    { key: 'cpu_usage_per_pod', label: 'CPU use/pod', group: 'CPU', visible: true },
    { key: 'cpu_req_sum', label: 'CPU req Σ', group: 'CPU', visible: true },
    { key: 'cpu_usage_sum', label: 'CPU use Σ', group: 'CPU', visible: true },
    { key: 'hpa_cpu', label: 'HPA CPU %', group: 'HPA', visible: true },
    { key: 'hpa_mem', label: 'HPA MEM %', group: 'HPA', visible: true },
    { key: 'mem_req_per_pod', label: 'MEM req/pod', group: 'Memory', visible: true },
    { key: 'mem_usage_per_pod', label: 'MEM use/pod', group: 'Memory', visible: true },
    { key: 'mem_limit_per_pod', label: 'MEM limit/pod', group: 'Memory', visible: true },
    { key: 'mem_req_limit_ratio', label: 'Req/Limit', group: 'Memory', visible: true },
    { key: 'workload', label: 'Workload', group: 'Meta', visible: true },
    { key: 'lba', label: 'LBA', group: 'Meta', visible: true },
    { key: 'note', label: 'Note', group: 'Meta', visible: false },
  ];

  columnGroups: string[] = ['General', 'CPU', 'HPA', 'Memory', 'Meta'];

  get visibleColumns(): ColumnDef[] { return this.columns.filter(c => c.visible); }
  get totalPods() { return this.entries.reduce((s, e) => s + e.pods, 0); }
  get totalNotReady() { return this.entries.reduce((s, e) => s + e.pods_not_ready, 0); }
  get totalCpuUsage() { return this.entries.reduce((s, e) => s + e.cpu_usage_sum, 0).toFixed(1); }

  ngOnInit() {
    this.loadColumns();
    this.startStream();
  }

  ngOnDestroy() { this.stopStream(); }

  // Column config
  columnsByGroup(group: string): ColumnDef[] { return this.columns.filter(c => c.group === group); }

  showAll() { this.columns.forEach(c => c.visible = true); this.saveColumns(); }
  showNone() { this.columns.forEach(c => c.visible = c.key === 'deployment'); this.saveColumns(); }
  resetColumns() {
    const defaults = ['deployment', 'cluster', 'version', 'pods', 'pods_not_ready', 'cpu_req_per_pod', 'cpu_usage_per_pod', 'cpu_req_sum', 'cpu_usage_sum', 'hpa_cpu', 'hpa_mem', 'mem_req_per_pod', 'mem_usage_per_pod', 'mem_limit_per_pod', 'mem_req_limit_ratio', 'workload', 'lba'];
    this.columns.forEach(c => c.visible = defaults.includes(c.key));
    this.saveColumns();
  }

  saveColumns() {
    const visible = this.columns.filter(c => c.visible).map(c => c.key);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(visible));
  }

  private loadColumns() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const visible: string[] = JSON.parse(raw);
        this.columns.forEach(c => c.visible = visible.includes(c.key));
      }
    } catch {}
  }

  // Cell helpers
  isNumCol(key: string): boolean {
    return ['pods', 'pods_not_ready', 'cpu_req_per_pod', 'cpu_usage_per_pod', 'cpu_req_sum', 'cpu_usage_sum', 'hpa_cpu', 'hpa_mem', 'mem_req_per_pod', 'mem_usage_per_pod', 'mem_limit_per_pod', 'mem_req_limit_ratio'].includes(key);
  }

  isCellHot(key: string, e: GatewayEntry): boolean {
    if (key === 'cpu_usage_per_pod') return e.cpu_usage_per_pod > e.cpu_req_per_pod;
    if (key === 'cpu_usage_sum') return e.cpu_usage_sum > e.cpu_req_sum;
    if (key === 'mem_usage_per_pod') return e.mem_usage_per_pod > e.mem_req_per_pod;
    return false;
  }

  // Stream
  toggleStream() { this.streaming ? this.stopStream() : this.startStream(); }

  setInterval(val: number) {
    this.refreshInterval = val;
    if (this.streaming && this.wsSend) {
      this.wsSend(JSON.stringify({ interval: val }));
    }
  }

  startStream() {
    this.streaming = true;
    this.loading = true;
    const conn = this.ws.connect('/ws/gateway-monitor');
    this.wsSend = conn.send;
    this.wsClose = conn.close;
    setTimeout(() => conn.send(JSON.stringify({ interval: this.refreshInterval })), 100);
    this.wsSub = conn.messages$.subscribe({
      next: (data) => {
        this.entries = JSON.parse(data);
        this.filter();
        this.loading = false;
        this.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      },
      complete: () => { this.streaming = false; },
      error: () => { this.streaming = false; this.loading = false; },
    });
  }

  stopStream() {
    this.streaming = false;
    this.wsSub?.unsubscribe();
    this.wsClose?.();
    this.wsSub = null;
    this.wsSend = null;
    this.wsClose = null;
  }

  manualRefresh() {
    if (this.streaming) return;
    this.loading = true;
    this.http.get<any>('/api/gateway-monitor').subscribe({
      next: (res) => {
        this.entries = res.entries || [];
        this.filter();
        this.loading = false;
        this.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      },
      error: () => { this.loading = false; },
    });
  }

  filter() {
    const q = this.searchQuery.toLowerCase();
    if (!q) { this.filtered = this.entries; return; }
    this.filtered = this.entries.filter(e =>
      e.deployment.toLowerCase().includes(q) ||
      e.cluster.toLowerCase().includes(q) ||
      e.version.toLowerCase().includes(q) ||
      e.workload.toLowerCase().includes(q)
    );
  }

  sort(field: string) {
    if (this.sortField === field) { this.sortAsc = !this.sortAsc; }
    else { this.sortField = field; this.sortAsc = true; }
    const dir = this.sortAsc ? 1 : -1;
    this.filtered = [...this.filtered].sort((a: any, b: any) => {
      const av = a[field], bv = b[field];
      if (typeof av === 'number') return (av - bv) * dir;
      return String(av ?? '').localeCompare(String(bv ?? '')) * dir;
    });
  }

  shortCluster(ctx: string): string {
    if (ctx.length <= 25) return ctx;
    return '...' + ctx.slice(-22);
  }
}
