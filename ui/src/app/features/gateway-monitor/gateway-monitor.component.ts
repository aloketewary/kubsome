import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { PageInfoComponent } from '../../shared/components/page-info.component';

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

@Component({
  selector: 'app-gateway-monitor',
  standalone: true,
  imports: [FormsModule, ButtonModule, TooltipModule, TagModule, InputTextModule, PageInfoComponent],
  template: `
    <div class="page-header">
      <div>
        <h1>Gateway Monitor</h1>
        <p class="subtitle">{{ filtered.length }} deployments · Resource & HPA overview</p>
      </div>
      <div class="header-actions">
        <div class="search-wrap">
          <i class="pi pi-search"></i>
          <input pInputText [(ngModel)]="searchQuery" placeholder="Filter..." (ngModelChange)="filter()" />
        </div>
        <button pButton icon="pi pi-refresh" class="p-button-outlined p-button-sm p-button-rounded" (click)="refresh()" pTooltip="Refresh"></button>
        <app-page-info title="Gateway Monitor" description="Deployment-level resource metrics with HPA status, CPU/memory usage, and pod readiness."
          [tips]="['Red rows indicate pods not ready', 'HPA columns show target vs current utilization', 'CPU values in millicores, memory in Mi']"
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
        <span class="pill-label">CPU cores used</span>
      </div>
    </div>

    <!-- Table -->
    <div class="table-container">
      <table class="gw-table">
        <thead>
          <tr>
            <th class="sticky-col" (click)="sort('deployment')">Deployment <i class="pi pi-sort-alt"></i></th>
            <th>Cluster</th>
            <th>Version</th>
            <th (click)="sort('pods')">Pods <i class="pi pi-sort-alt"></i></th>
            <th>Not Ready</th>
            <th class="col-group-start">CPU req/pod</th>
            <th>CPU use/pod</th>
            <th>CPU req Σ</th>
            <th>CPU use Σ</th>
            <th class="col-group-start">HPA CPU %</th>
            <th>HPA MEM %</th>
            <th class="col-group-start">MEM req/pod</th>
            <th>MEM use/pod</th>
            <th>MEM limit/pod</th>
            <th>Req/Limit</th>
            <th class="col-group-start">Workload</th>
            <th>LBA</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          @for (e of filtered; track e.deployment) {
            <tr [class.row-warn]="e.pods_not_ready > 0">
              <td class="sticky-col cell-name">
                <code>{{ e.deployment }}</code>
              </td>
              <td class="cell-mono">{{ shortCluster(e.cluster) }}</td>
              <td><span class="version-tag">{{ e.version }}</span></td>
              <td class="cell-num">{{ e.pods }}</td>
              <td class="cell-num">
                @if (e.pods_not_ready > 0) {
                  <span class="not-ready-badge">{{ e.pods_not_ready }}</span>
                } @else {
                  <span class="all-ready">0</span>
                }
              </td>
              <!-- CPU -->
              <td class="cell-num col-group-start">{{ e.cpu_req_per_pod }}m</td>
              <td class="cell-num" [class.cell-hot]="e.cpu_usage_per_pod > e.cpu_req_per_pod">{{ e.cpu_usage_per_pod }}m</td>
              <td class="cell-num">{{ e.cpu_req_sum }}</td>
              <td class="cell-num" [class.cell-hot]="e.cpu_usage_sum > e.cpu_req_sum">{{ e.cpu_usage_sum }}</td>
              <!-- HPA -->
              <td class="cell-num col-group-start">
                @if (e.hpa_cpu_target !== null) {
                  <span class="hpa-pair">
                    <span class="hpa-target">{{ e.hpa_cpu_target }}</span>
                    <span class="hpa-sep">/</span>
                    <span class="hpa-current" [class.hpa-over]="e.hpa_cpu_current! > e.hpa_cpu_target!">{{ e.hpa_cpu_current ?? '—' }}</span>
                  </span>
                } @else { <span class="cell-na">—</span> }
              </td>
              <td class="cell-num">
                @if (e.hpa_mem_target !== null) {
                  <span class="hpa-pair">
                    <span class="hpa-target">{{ e.hpa_mem_target }}</span>
                    <span class="hpa-sep">/</span>
                    <span class="hpa-current" [class.hpa-over]="e.hpa_mem_current! > e.hpa_mem_target!">{{ e.hpa_mem_current ?? '—' }}</span>
                  </span>
                } @else { <span class="cell-na">—</span> }
              </td>
              <!-- MEM -->
              <td class="cell-num col-group-start">{{ e.mem_req_per_pod }}</td>
              <td class="cell-num" [class.cell-hot]="e.mem_usage_per_pod > e.mem_req_per_pod">{{ e.mem_usage_per_pod }}</td>
              <td class="cell-num">{{ e.mem_limit_per_pod }}</td>
              <td class="cell-num">
                <span class="ratio-bar">
                  <span class="ratio-fill" [style.width.%]="e.mem_req_limit_ratio * 100"></span>
                </span>
                <span class="ratio-text">{{ e.mem_req_limit_ratio }}</span>
              </td>
              <!-- Meta -->
              <td class="col-group-start">{{ e.workload || '—' }}</td>
              <td>{{ e.lba || '—' }}</td>
              <td class="cell-note">{{ e.note || '' }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    @if (filtered.length === 0 && searchQuery) {
      <div class="empty-state"><i class="pi pi-search"></i> No deployments matching "{{ searchQuery }}"</div>
    }
    @if (loading) {
      <div class="empty-state"><i class="pi pi-spin pi-spinner"></i> Loading...</div>
    }
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .header-actions { display: flex; align-items: center; gap: 8px; }
    .search-wrap { position: relative; }
    .search-wrap i { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 12px; }
    .search-wrap input { padding-left: 30px !important; width: 180px; }

    /* Summary */
    .summary-strip {
      display: flex; gap: 8px; margin-bottom: 16px;
      padding: 14px 18px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
    }
    .summary-pill { display: flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px; background: var(--bg-elevated); font-size: 12px; }
    .pill-ok { background: var(--success-subtle); }
    .pill-bad { background: var(--danger-subtle); }
    .pill-dot { width: 6px; height: 6px; border-radius: 50%; }
    .dot-ok { background: var(--success); }
    .dot-bad { background: var(--danger); }
    .pill-val { font-weight: 700; }
    .pill-label { color: var(--text-muted); }

    /* Table */
    .table-container {
      overflow-x: auto; border: 1px solid var(--border);
      border-radius: var(--radius); background: var(--bg-card);
    }
    .gw-table {
      width: 100%; border-collapse: collapse; font-size: 12px;
      white-space: nowrap;
    }
    .gw-table thead { position: sticky; top: 0; z-index: 2; }
    .gw-table th {
      padding: 10px 12px; text-align: left; font-size: 10px;
      font-weight: 700; color: var(--text-muted); text-transform: uppercase;
      letter-spacing: 0.04em; background: var(--bg-elevated);
      border-bottom: 1px solid var(--border); cursor: pointer;
      user-select: none;
    }
    .gw-table th i { font-size: 9px; opacity: 0.4; margin-left: 2px; }
    .gw-table th:hover { color: var(--text); }
    .gw-table td {
      padding: 10px 12px; border-bottom: 1px solid var(--border);
      color: var(--text-secondary);
    }
    .gw-table tr:hover td { background: var(--bg-hover); }
    .gw-table tr:last-child td { border-bottom: none; }

    .col-group-start { border-left: 1px solid var(--border) !important; }

    .sticky-col {
      position: sticky; left: 0; z-index: 1;
      background: var(--bg-card);
    }
    thead .sticky-col { background: var(--bg-elevated); z-index: 3; }
    tr:hover .sticky-col { background: var(--bg-hover); }

    /* Cells */
    .cell-name code { font-size: 11px; font-weight: 600; color: var(--text); }
    .cell-mono { font-family: 'JetBrains Mono', monospace; font-size: 11px; }
    .cell-num { font-family: 'JetBrains Mono', monospace; text-align: right; }
    .cell-hot { color: var(--danger); font-weight: 600; }
    .cell-na { color: var(--text-muted); opacity: 0.5; }
    .cell-note { max-width: 120px; overflow: hidden; text-overflow: ellipsis; }

    .version-tag {
      font-size: 10px; padding: 2px 6px; border-radius: 4px;
      background: var(--bg-elevated); border: 1px solid var(--border);
      font-family: 'JetBrains Mono', monospace;
    }

    .not-ready-badge {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 20px; padding: 2px 6px; border-radius: 10px;
      background: var(--danger-subtle); color: var(--danger);
      font-weight: 700; font-size: 11px;
    }
    .all-ready { color: var(--text-muted); opacity: 0.5; }

    /* HPA */
    .hpa-pair { display: inline-flex; align-items: center; gap: 2px; }
    .hpa-target { color: var(--text-muted); }
    .hpa-sep { color: var(--border-hover); }
    .hpa-current { font-weight: 600; color: var(--success); }
    .hpa-over { color: var(--danger) !important; }

    /* Ratio bar */
    .ratio-bar {
      display: inline-block; width: 32px; height: 4px; border-radius: 2px;
      background: var(--bg-elevated); overflow: hidden; vertical-align: middle;
      margin-right: 4px;
    }
    .ratio-fill { display: block; height: 100%; border-radius: 2px; background: var(--accent); }
    .ratio-text { font-size: 10px; color: var(--text-muted); }

    /* Row states */
    .row-warn { background: var(--danger-subtle); }
    .row-warn .sticky-col { background: var(--danger-subtle); }
    .row-warn:hover td, .row-warn:hover .sticky-col { background: rgba(239, 68, 68, 0.08); }

    .empty-state {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      padding: 48px; color: var(--text-muted); font-size: 13px;
    }
  `]
})
export class GatewayMonitorComponent implements OnInit {
  private http = inject(HttpClient);

  entries: GatewayEntry[] = [];
  filtered: GatewayEntry[] = [];
  searchQuery = '';
  loading = false;
  private sortField = '';
  private sortAsc = true;

  get totalPods() { return this.entries.reduce((s, e) => s + e.pods, 0); }
  get totalNotReady() { return this.entries.reduce((s, e) => s + e.pods_not_ready, 0); }
  get totalCpuUsage() { return this.entries.reduce((s, e) => s + e.cpu_usage_sum, 0).toFixed(1); }

  ngOnInit() { this.refresh(); }

  refresh() {
    this.loading = true;
    this.http.get<any>('/api/gateway-monitor').subscribe({
      next: (res) => { this.entries = res.entries || []; this.filter(); this.loading = false; },
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
      return String(av).localeCompare(String(bv)) * dir;
    });
  }

  shortCluster(ctx: string): string {
    if (ctx.length <= 25) return ctx;
    return '...' + ctx.slice(-22);
  }
}
