import { Component, inject, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { PageInfoComponent } from '../../shared/components/page-info.component';
import { IntelHeaderComponent } from '../../shared/components/futuristic/intel-header.component';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ButtonModule, TooltipModule, TagModule, InputTextModule, PageInfoComponent, IntelHeaderComponent],
  host: { '[class.gw-fullscreen]': 'fullscreen' },
  template: `
    <app-intel-header title="Gateway Monitor" icon="pi pi-server"
      [subtitle]="filtered.length + ' deployments · ' + visibleColumns.length + '/' + columns.length + ' columns'">
      <div class="search-wrap">
        <i class="pi pi-search"></i>
        <input pInputText [(ngModel)]="searchQuery" placeholder="Filter..." (ngModelChange)="filter()" />
      </div>
      <div class="interval-config">
        <span class="interval-label">Refresh</span>
        <div class="interval-btns">
          @for (opt of intervalOptions; track opt.value) {
            <button class="int-btn" [class.active]="refreshInterval === opt.value" (click)="setInterval(opt.value)">{{ opt.label }}</button>
          }
        </div>
      </div>
      <button class="ctrl-btn" [class.ctrl-btn-live]="streaming" (click)="toggleStream()" pTooltip="Live stream">
        <span class="live-dot" [class.pulsing]="streaming"></span>
      </button>
      <button class="ctrl-btn" (click)="configOpen = !configOpen; $event.stopPropagation()" pTooltip="Columns"><i class="pi pi-cog"></i></button>
      <button class="ctrl-btn" (click)="manualRefresh()" pTooltip="Refresh"><i class="pi pi-refresh"></i></button>
      <button class="ctrl-btn" (click)="fullscreen = !fullscreen" [pTooltip]="fullscreen ? 'Exit' : 'Fullscreen'"><i class="pi" [class.pi-window-minimize]="fullscreen" [class.pi-window-maximize]="!fullscreen"></i></button>
    </app-intel-header>

    <!-- Column Config Panel (outside header to avoid overflow clipping) -->
    @if (configOpen) {
      <div class="cfg-backdrop" (click)="configOpen = false"></div>
      <div class="col-config-panel" (click)="$event.stopPropagation()">
        <div class="cfg-panel-header">
          <span>Configure Columns</span>
          <div class="cfg-panel-actions">
            <button class="cfg-link" (click)="showAll()">All</button>
            <button class="cfg-link" (click)="showNone()">None</button>
            <button class="cfg-link" (click)="resetColumns()">Reset</button>
            <button class="cfg-close" (click)="configOpen = false"><i class="pi pi-times"></i></button>
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
        @if (cpuHistory.length > 1) {
          <svg class="sparkline" viewBox="0 0 80 24" preserveAspectRatio="none">
            <path [attr.d]="sparklinePath(cpuHistory)" />
          </svg>
        }
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
                <td [class.sticky-col]="col.key === 'deployment'" [class.cell-num]="isNumCol(col.key)" [class.cell-hot]="isCellHot(col.key, e)"
                    [class.cell-flash-up]="getCellChange(e.deployment, col.key) === 'up'"
                    [class.cell-flash-down]="getCellChange(e.deployment, col.key) === 'down'">
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
    :host.gw-fullscreen {
      position: fixed; inset: 0; z-index: 9999;
      background: var(--bg); overflow-y: auto;
      padding: 20px 24px;
    }
    .search-wrap { position: relative; }
    .search-wrap i { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 11px; }
    .search-wrap input { padding-left: 28px !important; width: 140px; }

    /* Interval */
    .interval-config {
      display: flex; align-items: center; gap: 6px;
      padding: 0; border: none;
    }
    .interval-label { font-size: 9px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; }
    .interval-btns { display: flex; gap: 0; border: 1px solid rgba(94, 84, 75, 0.15); }
    .int-btn {
      padding: 4px 8px; border: none; border-right: 1px solid rgba(94, 84, 75, 0.1);
      background: none; color: var(--text-muted); font-size: 10px; font-weight: 600;
      cursor: pointer; transition: all 0.12s;
    }
    .int-btn:last-child { border-right: none; }
    .int-btn:hover { color: var(--text-secondary); }
    .int-btn.active { background: var(--accent); color: #0B0908; font-weight: 700; }

    /* Live */
    .ctrl-btn-live { border-color: rgba(244, 63, 94, 0.3) !important; }
    .live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--text-muted); display: inline-block; }
    .live-dot.pulsing { background: var(--danger); animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

    /* Column Config */
    .cfg-backdrop { position: fixed; inset: 0; z-index: 999; }
    .col-config-panel {
      position: fixed; top: 80px; right: 24px; z-index: 1000;
      width: 280px; max-height: 70vh; overflow-y: auto;
      background: var(--bg); border: 1px solid rgba(94, 84, 75, 0.15);
      border-radius: 0; box-shadow: 0 16px 48px rgba(0,0,0,0.6);
      padding: 16px; animation: cfgIn 0.2s ease-out;
    }
    @keyframes cfgIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
    .cfg-panel-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid rgba(94, 84, 75, 0.1);
      font-size: 12px; font-weight: 700;
    }
    .cfg-panel-actions { display: flex; align-items: center; gap: 8px; }
    .cfg-link { background: none; border: none; color: var(--accent); font-size: 10px; cursor: pointer; font-weight: 600; }
    .cfg-link:hover { text-decoration: underline; }
    .cfg-close { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; font-size: 11px; }
    .cfg-close:hover { color: var(--text); }
    .cfg-group { margin-bottom: 12px; }
    .cfg-group-label { display: block; font-size: 9px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
    .cfg-item {
      display: flex; align-items: center; gap: 8px;
      padding: 4px 8px; cursor: pointer; font-size: 11px;
      color: var(--text-secondary); transition: background 0.1s;
    }
    .cfg-item:hover { background: rgba(208, 156, 96, 0.02); }
    .cfg-item input[type="checkbox"] { width: 13px; height: 13px; accent-color: var(--accent); cursor: pointer; }

    /* Summary */
    .summary-strip {
      display: flex; gap: 0; margin-bottom: 16px;
      padding: 12px 0; border-bottom: 1px solid rgba(94, 84, 75, 0.1);
    }
    .summary-pill { display: flex; align-items: center; gap: 6px; padding: 0 14px; border-right: 1px solid rgba(94, 84, 75, 0.1); font-size: 12px; }
    .summary-pill:last-child { border-right: none; }
    .pill-ok { }
    .pill-bad { }
    .pill-time { margin-left: auto; }
    .pill-time i { font-size: 11px; color: var(--text-muted); }
    .pill-dot { width: 6px; height: 6px; border-radius: 50%; }
    .dot-ok { background: var(--success); box-shadow: 0 0 4px rgba(74, 222, 128, 0.3); }
    .dot-bad { background: var(--danger); box-shadow: 0 0 4px rgba(244, 63, 94, 0.3); }
    .pill-val { font-weight: 300; font-size: 16px; font-family: 'JetBrains Mono', monospace; }
    .pill-label { color: var(--text-muted); font-size: 10px; }

    /* Table */
    .table-container { overflow-x: auto; border: none; border-top: 1px solid rgba(94, 84, 75, 0.08); background: transparent; }
    .gw-table { width: 100%; border-collapse: collapse; font-size: 11px; white-space: nowrap; }
    .gw-table thead { position: sticky; top: 0; z-index: 2; }
    .gw-table th {
      padding: 8px 12px; text-align: left; font-size: 9px;
      font-weight: 700; color: var(--text-muted); text-transform: uppercase;
      letter-spacing: 0.06em; background: var(--bg);
      border-bottom: 1px solid rgba(94, 84, 75, 0.1); cursor: pointer; user-select: none;
    }
    .gw-table th i { font-size: 8px; opacity: 0.4; margin-left: 2px; }
    .gw-table th:hover { color: var(--text-secondary); }
    .gw-table td { padding: 8px 12px; border-bottom: 1px solid rgba(94, 84, 75, 0.04); color: var(--text-secondary); }
    .gw-table tr:hover td { background: rgba(208, 156, 96, 0.02); }
    .gw-table tr:last-child td { border-bottom: none; }
    .sticky-col { position: sticky; left: 0; z-index: 1; background: var(--bg); }
    thead .sticky-col { z-index: 3; }
    tr:hover .sticky-col { background: rgba(208, 156, 96, 0.02); }

    /* Cells */
    .cell-name-text { font-size: 11px; font-weight: 600; color: var(--text); }
    .cell-mono { font-family: 'JetBrains Mono', monospace; font-size: 11px; }
    .cell-num { font-family: 'JetBrains Mono', monospace; text-align: right; }
    .cell-hot { color: var(--danger); font-weight: 600; }
    .cell-na { color: var(--text-muted); opacity: 0.4; }
    .version-tag { font-size: 10px; padding: 2px 6px; background: transparent; border: 1px solid rgba(94, 84, 75, 0.12); font-family: 'JetBrains Mono', monospace; }
    .not-ready-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; padding: 2px 6px; background: rgba(244, 63, 94, 0.06); color: var(--danger); font-weight: 700; font-size: 11px; border: 1px solid rgba(244, 63, 94, 0.15); }
    .all-ready { color: var(--text-muted); opacity: 0.4; }
    .hpa-pair { display: inline-flex; align-items: center; gap: 2px; }
    .hpa-target { color: var(--text-muted); }
    .hpa-sep { color: rgba(94, 84, 75, 0.3); }
    .hpa-current { font-weight: 600; color: var(--success); }
    .hpa-over { color: var(--danger) !important; }
    .ratio-bar { display: inline-block; width: 32px; height: 3px; background: rgba(94, 84, 75, 0.1); overflow: hidden; vertical-align: middle; margin-right: 4px; }
    .ratio-fill { display: block; height: 100%; background: var(--accent); }
    .ratio-text { font-size: 10px; color: var(--text-muted); }
    .row-warn { background: rgba(244, 63, 94, 0.02); }
    .row-warn .sticky-col { background: rgba(244, 63, 94, 0.02); }
    .row-warn:hover td, .row-warn:hover .sticky-col { background: rgba(244, 63, 94, 0.04); }

    /* Sparkline */
    .sparkline { width: 60px; height: 20px; margin-left: 4px; }
    .sparkline path { fill: none; stroke: var(--accent); stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }

    /* Cell flash */
    .cell-flash-up { animation: flashUp 2s ease-out; }
    .cell-flash-down { animation: flashDown 2s ease-out; }
    @keyframes flashUp { 0% { background: rgba(74, 222, 128, 0.15); } 100% { background: transparent; } }
    @keyframes flashDown { 0% { background: rgba(244, 63, 94, 0.15); } 100% { background: transparent; } }

    .empty-state { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 48px; color: var(--text-muted); font-size: 12px; }

    /* Light Mode */
    :host-context([data-theme="light"]) .int-btn.active { background: #9a5129; color: #fff; }
    :host-context([data-theme="light"]) .col-config-panel { background: #faf8f6; border-color: rgba(0,0,0,0.06); box-shadow: 0 12px 40px rgba(0,0,0,0.08); }
    :host-context([data-theme="light"]) .cfg-panel-header { border-bottom-color: rgba(0,0,0,0.05); }
    :host-context([data-theme="light"]) .cfg-item:hover { background: rgba(0,0,0,0.015); }
    :host-context([data-theme="light"]) .summary-strip { border-bottom-color: rgba(0,0,0,0.06); }
    :host-context([data-theme="light"]) .summary-pill { border-right-color: rgba(0,0,0,0.05); }
    :host-context([data-theme="light"]) .dot-ok { box-shadow: none; }
    :host-context([data-theme="light"]) .dot-bad { box-shadow: none; }
    :host-context([data-theme="light"]) .table-container { border-top-color: rgba(0,0,0,0.05); }
    :host-context([data-theme="light"]) .gw-table th { background: #faf8f6; border-bottom-color: rgba(0,0,0,0.06); }
    :host-context([data-theme="light"]) .gw-table td { border-bottom-color: rgba(0,0,0,0.03); }
    :host-context([data-theme="light"]) .gw-table tr:hover td { background: rgba(0,0,0,0.015); }
    :host-context([data-theme="light"]) .sticky-col { background: #faf8f6; }
    :host-context([data-theme="light"]) tr:hover .sticky-col { background: rgba(0,0,0,0.015); }
    :host-context([data-theme="light"]) .version-tag { border-color: rgba(0,0,0,0.06); }
    :host-context([data-theme="light"]) .not-ready-badge { background: rgba(220,38,38,0.04); border-color: rgba(220,38,38,0.1); }
    :host-context([data-theme="light"]) .interval-btns { border-color: rgba(0,0,0,0.08); }
    :host-context([data-theme="light"]) .int-btn { border-right-color: rgba(0,0,0,0.05); }
    :host-context([data-theme="light"]) .ratio-bar { background: rgba(0,0,0,0.04); }
  `]
})
export class GatewayMonitorComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private ws = inject(WsService);
  private cdr = inject(ChangeDetectorRef);

  entries: GatewayEntry[] = [];
  filtered: GatewayEntry[] = [];
  prevEntries: Map<string, GatewayEntry> = new Map();
  changedCells: Map<string, 'up' | 'down'> = new Map();
  cpuHistory: number[] = [];
  memHistory: number[] = [];
  searchQuery = '';
  loading = false;
  streaming = false;
  fullscreen = false;
  lastUpdated = '';
  refreshInterval = 10;
  configOpen = false;
  private sortField = '';
  private sortAsc = true;
  private wsSub: Subscription | null = null;
  private wsSend: ((msg: string) => void) | null = null;
  private wsClose: (() => void) | null = null;
  private flashTimer: any = null;

  // Cached computed values (avoid recalc on every CD cycle)
  cachedVisibleColumns: ColumnDef[] = [];
  cachedColumnsByGroup: Map<string, ColumnDef[]> = new Map();
  cachedSparkline = '';
  totalPods = 0;
  totalNotReady = 0;
  totalCpuUsage = '0.0';

  private static NUM_COLS = new Set(['pods', 'pods_not_ready', 'cpu_req_per_pod', 'cpu_usage_per_pod', 'cpu_req_sum', 'cpu_usage_sum', 'hpa_cpu', 'hpa_mem', 'mem_req_per_pod', 'mem_usage_per_pod', 'mem_limit_per_pod', 'mem_req_limit_ratio']);

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

  get visibleColumns(): ColumnDef[] { return this.cachedVisibleColumns; }

  ngOnInit() {
    this.loadColumns();
    this.rebuildColumnCache();
    this.startStream();
  }

  ngOnDestroy() { this.stopStream(); }

  // Column config
  columnsByGroup(group: string): ColumnDef[] { return this.cachedColumnsByGroup.get(group) || []; }

  showAll() { this.columns.forEach(c => c.visible = true); this.saveColumns(); this.rebuildColumnCache(); }
  showNone() { this.columns.forEach(c => c.visible = c.key === 'deployment'); this.saveColumns(); this.rebuildColumnCache(); }
  resetColumns() {
    const defaults = ['deployment', 'cluster', 'version', 'pods', 'pods_not_ready', 'cpu_req_per_pod', 'cpu_usage_per_pod', 'cpu_req_sum', 'cpu_usage_sum', 'hpa_cpu', 'hpa_mem', 'mem_req_per_pod', 'mem_usage_per_pod', 'mem_limit_per_pod', 'mem_req_limit_ratio', 'workload', 'lba'];
    this.columns.forEach(c => c.visible = defaults.includes(c.key));
    this.saveColumns();
    this.rebuildColumnCache();
  }

  saveColumns() {
    const visible = this.columns.filter(c => c.visible).map(c => c.key);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(visible));
    this.rebuildColumnCache();
  }

  private rebuildColumnCache() {
    this.cachedVisibleColumns = this.columns.filter(c => c.visible);
    this.cachedColumnsByGroup.clear();
    for (const g of this.columnGroups) {
      this.cachedColumnsByGroup.set(g, this.columns.filter(c => c.group === g));
    }
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

  // Change detection
  private detectChanges(newEntries: GatewayEntry[]) {
    this.changedCells.clear();
    const trackKeys: (keyof GatewayEntry)[] = ['cpu_usage_per_pod', 'cpu_usage_sum', 'mem_usage_per_pod', 'pods_not_ready', 'hpa_cpu_current', 'hpa_mem_current'];
    for (const entry of newEntries) {
      const prev = this.prevEntries.get(entry.deployment);
      if (!prev) continue;
      for (const k of trackKeys) {
        const oldVal = prev[k] as number | null;
        const newVal = entry[k] as number | null;
        if (oldVal == null || newVal == null) continue;
        if (newVal > oldVal) this.changedCells.set(`${entry.deployment}_${k}`, 'up');
        else if (newVal < oldVal) this.changedCells.set(`${entry.deployment}_${k}`, 'down');
      }
    }
    this.prevEntries.clear();
    for (const e of newEntries) this.prevEntries.set(e.deployment, { ...e });
    // Debounced clear — cancel previous timer
    if (this.flashTimer) clearTimeout(this.flashTimer);
    if (this.changedCells.size > 0) {
      this.flashTimer = setTimeout(() => {
        this.changedCells.clear();
        this.cdr.markForCheck();
      }, 2000);
    }
  }

  private updateHistory() {
    const cpu = this.entries.reduce((s, e) => s + e.cpu_usage_sum, 0);
    const mem = this.entries.reduce((s, e) => s + e.mem_usage_per_pod * e.pods, 0);
    this.cpuHistory.push(cpu);
    this.memHistory.push(mem);
    if (this.cpuHistory.length > 20) this.cpuHistory.shift();
    if (this.memHistory.length > 20) this.memHistory.shift();
    this.cachedSparkline = this.buildSparkline(this.cpuHistory);
  }

  private updateTotals() {
    this.totalPods = this.entries.reduce((s, e) => s + e.pods, 0);
    this.totalNotReady = this.entries.reduce((s, e) => s + e.pods_not_ready, 0);
    this.totalCpuUsage = this.entries.reduce((s, e) => s + e.cpu_usage_sum, 0).toFixed(1);
  }

  getCellChange(deployment: string, key: string): 'up' | 'down' | null {
    return this.changedCells.get(`${deployment}_${key}`) || null;
  }

  sparklinePath(data: number[]): string {
    return this.cachedSparkline;
  }

  private buildSparkline(data: number[]): string {
    if (data.length < 2) return '';
    const max = Math.max(...data, 1);
    const w = 80, h = 24;
    const step = w / (data.length - 1);
    return data.map((v, i) => `${i === 0 ? 'M' : 'L'}${i * step},${h - (v / max) * h}`).join(' ');
  }

  isNumCol(key: string): boolean {
    return GatewayMonitorComponent.NUM_COLS.has(key);
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
        const newEntries: GatewayEntry[] = JSON.parse(data);
        this.detectChanges(newEntries);
        this.entries = newEntries;
        this.filter();
        this.loading = false;
        this.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        this.updateHistory();
        this.updateTotals();
        this.cdr.markForCheck();
      },
      complete: () => { this.streaming = false; this.cdr.markForCheck(); },
      error: () => { this.streaming = false; this.loading = false; this.cdr.markForCheck(); },
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
        this.updateTotals();
        this.cdr.markForCheck();
      },
      error: () => { this.loading = false; this.cdr.markForCheck(); },
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
