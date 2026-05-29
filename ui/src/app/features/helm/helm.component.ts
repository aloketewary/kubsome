import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SpotlightComponent } from '../../shared/components/spotlight.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { ConfirmService } from '../../shared/services/confirm.service';
import { AiInsightDrawerComponent } from '../../shared/components/ai-insight-drawer.component';

@Component({
  selector: 'app-helm',
  standalone: true,
  imports: [ButtonModule, TagModule, TooltipModule, DialogModule, FormsModule, InputTextModule, SpotlightComponent, PageHeaderComponent, SkeletonComponent, AiInsightDrawerComponent],
  template: `
    <app-spotlight id="helm" title="Helm Releases" icon="pi pi-box"
      description="Manage Helm releases — status, history, values diff, and rollback."
      [capabilities]="['Release list', 'Revision history', 'Values diff', 'Safe rollback']" [compact]="true" />

    <app-page-header title="Helm Releases" [subtitle]="releases.length + ' releases · ' + lastUpdated">
        <button class="ar-btn" [class.ar-active]="autoRefresh" (click)="toggleAutoRefresh()" [pTooltip]="autoRefresh ? 'Auto-refresh on (30s)' : 'Auto-refresh off'">
          <i class="pi" [class.pi-sync]="autoRefresh" [class.pi-pause]="!autoRefresh"></i>
        </button>
        <div class="search-wrap">
          <i class="pi pi-search"></i>
          <input pInputText [(ngModel)]="searchQuery" placeholder="Filter releases..." (ngModelChange)="filter()" />
        </div>
        <button pButton icon="pi pi-refresh" class="p-button-outlined p-button-sm p-button-rounded" (click)="refresh()" pTooltip="Refresh" [loading]="loading"></button>
    </app-page-header>

    <!-- Summary Strip -->
    @if (releases.length) {
      <div class="summary-strip">
        <div class="summary-pill">
          <span class="pill-val">{{ releases.length }}</span>
          <span class="pill-label">Total</span>
        </div>
        <div class="summary-pill pill-ok">
          <span class="pill-dot dot-ok"></span>
          <span class="pill-val">{{ deployedCount }}</span>
          <span class="pill-label">Deployed</span>
        </div>
        @if (failedCount > 0) {
          <div class="summary-pill pill-bad">
            <span class="pill-dot dot-bad"></span>
            <span class="pill-val">{{ failedCount }}</span>
            <span class="pill-label">Failed</span>
          </div>
        }
        @if (pendingCount > 0) {
          <div class="summary-pill pill-warn">
            <span class="pill-dot dot-warn"></span>
            <span class="pill-val">{{ pendingCount }}</span>
            <span class="pill-label">Pending</span>
          </div>
        }
      </div>
    }

    <!-- Loading Skeleton -->
    @if (loading && !releases.length) {
      <app-skeleton variant="list" [count]="5" />
    }

    <!-- Error State -->
    @if (loadError && !releases.length) {
      <div class="error-state">
        <i class="pi pi-exclamation-triangle"></i>
        <span>Failed to load Helm releases</span>
        <button pButton label="Retry" icon="pi pi-refresh" class="p-button-outlined p-button-sm" (click)="refresh()"></button>
      </div>
    }

    <!-- Empty State -->
    @if (!filtered.length && !loading && !loadError) {
      <div class="empty-state">
        <i class="pi pi-box"></i>
        @if (searchQuery) {
          <span>No releases matching "{{ searchQuery }}"</span>
        } @else {
          <h3>No Helm Releases</h3>
          <p>No releases found in this namespace. Is Helm installed?</p>
        }
      </div>
    }

    <!-- Release List -->
    @if (filtered.length) {
      <div class="releases-list">
        @for (rel of filtered; track rel.name) {
          <div class="release-row" (click)="selectRelease(rel)" [class.selected]="selected?.name === rel.name" [class.release-failed]="rel.status === 'failed'">
            <div class="rel-status-dot" [class.dot-deployed]="rel.status === 'deployed'" [class.dot-failed]="rel.status === 'failed'" [class.dot-pending]="rel.status?.startsWith('pending')"></div>
            <div class="rel-body">
              <div class="rel-top">
                <code class="rel-name">{{ rel.name }}</code>
                <p-tag [value]="rel.status" [severity]="statusSev(rel.status)" [rounded]="true" size="small" />
              </div>
              <span class="rel-chart">{{ rel.chart }} · v{{ rel.app_version }}</span>
            </div>
            <div class="rel-meta">
              <span class="rel-rev">rev {{ rel.revision }}</span>
              <span class="rel-time">{{ rel.updated?.substring(0, 16) }}</span>
            </div>
            <div class="rel-actions">
              <button pButton icon="pi pi-sparkles" class="p-button-sm p-button-text p-button-warning" pTooltip="AI Diagnose" (click)="aiDiagnose(rel); $event.stopPropagation()"></button>
              <button pButton icon="pi pi-history" class="p-button-sm p-button-text" pTooltip="History" (click)="loadHistory(rel); $event.stopPropagation()"></button>
              <button pButton icon="pi pi-copy" class="p-button-sm p-button-text" pTooltip="Values Diff" (click)="loadDiff(rel); $event.stopPropagation()"></button>
              <button pButton icon="pi pi-undo" class="p-button-sm p-button-text p-button-danger" pTooltip="Rollback" (click)="rollback(rel); $event.stopPropagation()"></button>
            </div>
          </div>
        }
      </div>
    }

    <!-- History Dialog -->
    <p-dialog [(visible)]="historyVisible" [header]="'History — ' + historyName" [modal]="true" [maximizable]="true" styleClass="fullscreen-dialog" [appendTo]="'body'">
      @if (history.length) {
        <div class="history-list">
          @for (rev of history; track rev.revision) {
            <div class="history-row">
              <span class="rev-num">{{ rev.revision }}</span>
              <p-tag [value]="rev.status" [severity]="statusSev(rev.status)" [rounded]="true" size="small" />
              <span class="rev-chart">{{ rev.chart }}</span>
              <span class="rev-desc">{{ rev.description }}</span>
              <span class="rev-time">{{ rev.updated?.substring(0, 16) }}</span>
            </div>
          }
        </div>
      } @else {
        <div class="dialog-loading"><i class="pi pi-spin pi-spinner"></i> Loading...</div>
      }
    </p-dialog>

    <!-- Diff Dialog -->
    <p-dialog [(visible)]="diffVisible" [header]="'Values Diff — ' + diffName" [modal]="true" [maximizable]="true" styleClass="fullscreen-dialog" [appendTo]="'body'">
      @if (diff) {
        <h4>Changes (rev {{ diff.previous_revision }} → {{ diff.current_revision }})</h4>
        @if (diff.changes?.length) {
          @for (c of diff.changes; track c.path) {
            <div class="diff-row" [class]="'diff-' + c.type">
              <span class="diff-icon">{{ c.type === 'added' ? '+' : c.type === 'removed' ? '-' : '~' }}</span>
              <span class="diff-path">{{ c.path }}</span>
              @if (c.type === 'changed') {
                <span class="diff-old">{{ c.old }}</span>
                <span class="diff-arrow">→</span>
                <span class="diff-new">{{ c.new }}</span>
              } @else {
                <span class="diff-val">{{ c.new || c.old }}</span>
              }
            </div>
          }
        } @else {
          <p class="empty-tab">No value changes between revisions</p>
        }
      } @else {
        <div class="dialog-loading"><i class="pi pi-spin pi-spinner"></i> Loading...</div>
      }
    </p-dialog>

    <!-- AI Insight Drawer -->
    <app-ai-insight-drawer
      [visible]="aiDrawerVisible"
      [loading]="aiLoading"
      [resourceName]="aiReleaseName"
      [summary]="aiSummary"
      [findings]="aiFindings"
      [reasoning]="aiReasoning"
      (closed)="aiDrawerVisible = false" />
  `,
  styles: [`
    .ar-btn {
      width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--border);
      background: var(--bg-card); color: var(--text-muted); cursor: pointer; transition: all 0.15s;
      display: flex; align-items: center; justify-content: center;
    }
    .ar-btn:hover { border-color: var(--accent); color: var(--accent); }
    .ar-btn.ar-active { border-color: var(--success); color: var(--success); background: var(--success-subtle); }
    .ar-btn.ar-active i { animation: spin 2s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
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
    .pill-warn { background: var(--warning-subtle); }
    .pill-dot { width: 6px; height: 6px; border-radius: 50%; }
    .dot-ok { background: var(--success); }
    .dot-bad { background: var(--danger); }
    .dot-warn { background: var(--warning); }
    .pill-val { font-weight: 700; }
    .pill-label { color: var(--text-muted); }

    /* Release List */
    .releases-list { display: flex; flex-direction: column; gap: 6px; }
    .release-row {
      display: flex; align-items: center; gap: 12px;
      padding: 14px 18px; background: var(--bg-card);
      border: 1px solid var(--border); border-radius: var(--radius);
      cursor: pointer; transition: all 0.2s cubic-bezier(0.34,1.56,0.64,1);
    }
    .release-row:hover { border-color: var(--border-hover); transform: translateY(-1px); box-shadow: 0 6px 20px -6px rgba(0,0,0,0.15); }
    .release-row:hover .rel-actions { opacity: 1; }
    .release-row.selected { border-color: var(--accent); border-left: 3px solid var(--accent); }
    .release-failed { border-left: 3px solid var(--danger); background: var(--danger-subtle); }

    .rel-status-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .dot-deployed { background: var(--success); }
    .dot-failed { background: var(--danger); box-shadow: 0 0 6px var(--danger); }
    .dot-pending { background: var(--warning); }

    .rel-body { flex: 1; min-width: 0; }
    .rel-top { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .rel-name { font-size: 13px; font-weight: 600; }
    .rel-chart { font-size: 11px; color: var(--text-muted); }

    .rel-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; font-size: 11px; color: var(--text-muted); }
    .rel-rev { font-family: 'JetBrains Mono', monospace; }

    .rel-actions { display: flex; gap: 2px; opacity: 0.4; transition: opacity 0.15s; flex-shrink: 0; }
    @media (hover: none) { .rel-actions { opacity: 1; } }

    /* History */
    .history-list { display: flex; flex-direction: column; gap: 0; }
    .history-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; font-size: 12px; border-bottom: 1px solid var(--border); }
    .rev-num { font-weight: 700; min-width: 28px; font-family: 'JetBrains Mono', monospace; }
    .rev-chart { color: var(--text-muted); }
    .rev-desc { flex: 1; color: var(--text-secondary); }
    .rev-time { font-size: 11px; color: var(--text-muted); }

    /* Diff */
    h4 { font-size: 13px; font-weight: 600; margin: 0 0 12px; }
    .diff-row { display: flex; align-items: center; gap: 8px; padding: 6px 8px; font-size: 12px; font-family: 'JetBrains Mono', monospace; border-radius: 4px; }
    .diff-added { color: var(--success); background: var(--success-subtle); }
    .diff-removed { color: var(--danger); background: var(--danger-subtle); }
    .diff-changed { color: var(--warning); background: var(--warning-subtle); }
    .diff-icon { font-weight: 700; min-width: 12px; }
    .diff-path { font-weight: 600; min-width: 150px; }
    .diff-old { text-decoration: line-through; color: var(--text-muted); }
    .diff-arrow { color: var(--accent); }
    .diff-new { color: var(--accent); }
    .diff-val { color: var(--text-secondary); }

    /* States */
    .empty-state { text-align: center; padding: 60px; color: var(--text-muted); display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .empty-state i { font-size: 48px; opacity: 0.3; }
    .empty-state h3 { margin: 8px 0 0; }
    .empty-state p { margin: 0; font-size: 13px; }
    .empty-tab { color: var(--text-muted); font-size: 13px; }
    .error-state {
      display: flex; flex-direction: column; align-items: center; gap: 12px;
      padding: 48px; color: var(--text-muted); font-size: 13px;
      background: var(--bg-card); border: 1px solid var(--danger); border-radius: var(--radius);
    }
    .error-state i { font-size: 24px; color: var(--danger); }
    .dialog-loading { text-align: center; padding: 24px; color: var(--text-muted); }
  `],
})
export class HelmComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private confirmService = inject(ConfirmService);

  releases: any[] = [];
  filtered: any[] = [];
  selected: any = null;
  searchQuery = '';
  loading = false;
  loadError = false;
  autoRefresh = true;
  lastUpdated = '';
  private timer: any;

  // History dialog
  historyVisible = false;
  historyName = '';
  history: any[] = [];

  // Diff dialog
  diffVisible = false;
  diffName = '';
  diff: any = null;

  // AI Insight
  aiDrawerVisible = false;
  aiLoading = false;
  aiReleaseName = '';
  aiSummary = '';
  aiFindings: any[] = [];
  aiReasoning = '';

  get deployedCount() { return this.releases.filter(r => r.status === 'deployed').length; }
  get failedCount() { return this.releases.filter(r => r.status === 'failed').length; }
  get pendingCount() { return this.releases.filter(r => r.status?.startsWith('pending')).length; }

  ngOnInit() { this.refresh(); this.startAutoRefresh(); }
  ngOnDestroy() { clearInterval(this.timer); }

  toggleAutoRefresh() {
    this.autoRefresh = !this.autoRefresh;
    if (this.autoRefresh) this.startAutoRefresh();
    else clearInterval(this.timer);
  }

  private startAutoRefresh() {
    clearInterval(this.timer);
    this.timer = setInterval(() => this.refresh(), 30000);
  }

  refresh() {
    this.loading = true;
    this.loadError = false;
    this.http.get<any>('/api/helm/list').subscribe({
      next: (res) => {
        this.releases = res.releases || [];
        this.filter();
        this.loading = false;
        this.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      },
      error: () => { this.releases = []; this.filtered = []; this.loading = false; this.loadError = true; },
    });
  }

  filter() {
    const q = this.searchQuery.toLowerCase();
    const list = q
      ? this.releases.filter(r => r.name.toLowerCase().includes(q) || r.chart?.toLowerCase().includes(q))
      : this.releases;
    // Sort: failed first, then pending, then deployed
    this.filtered = [...list].sort((a, b) => {
      const priority = (s: string) => s === 'failed' ? 0 : s?.startsWith('pending') ? 1 : 2;
      return priority(a.status) - priority(b.status) || a.name.localeCompare(b.name);
    });
  }

  selectRelease(rel: any) {
    this.selected = this.selected?.name === rel.name ? null : rel;
  }

  loadHistory(rel: any) {
    this.historyName = rel.name;
    this.historyVisible = true;
    this.history = [];
    this.http.get<any>(`/api/helm/history/${rel.name}`).subscribe({
      next: (res) => { this.history = res.revisions || []; },
    });
  }

  loadDiff(rel: any) {
    this.diffName = rel.name;
    this.diffVisible = true;
    this.diff = null;
    this.http.get<any>(`/api/helm/diff/${rel.name}`).subscribe({
      next: (res) => { this.diff = res; },
    });
  }

  rollback(rel: any) {
    this.confirmService.confirm({
      title: 'Rollback Helm Release',
      message: `This will rollback "${rel.name}" to the previous revision. This cannot be undone.`,
      confirmLabel: 'Rollback',
      severity: 'danger',
      productionGuard: true,
    }).then(ok => {
      if (ok) {
        this.http.post<any>(`/api/helm/rollback/${rel.name}`, {}).subscribe({
          next: () => this.refresh(),
          error: () => {},
        });
      }
    });
  }

  aiDiagnose(rel: any) {
    this.aiReleaseName = rel.name;
    this.aiDrawerVisible = true;
    this.aiLoading = true;
    this.aiFindings = [];
    this.aiSummary = '';
    this.aiReasoning = '';

    this.http.get<any>(`/api/helm/history/${rel.name}`).subscribe({
      next: (res) => {
        const revisions = res.revisions || [];
        const failedRevs = revisions.filter((r: any) => r.status === 'failed');
        this.aiFindings = failedRevs.map((r: any) => ({
          title: `Revision ${r.revision} failed`,
          severity: 'high',
          detail: r.description || 'No description',
        }));
        this.aiSummary = rel.status === 'deployed'
          ? `Release "${rel.name}" is healthy (rev ${rel.revision}).`
          : `Release "${rel.name}" is in ${rel.status} state. ${failedRevs.length} failed revision(s) found.`;
        this.aiReasoning = 'Analyzed revision history and current release status.';
        this.aiLoading = false;
      },
      error: () => { this.aiSummary = 'Failed to analyze release.'; this.aiLoading = false; },
    });
  }

  statusSev(status: string): "success" | "warn" | "danger" | "info" | "secondary" | "contrast" | undefined {
    if (status === 'deployed') return 'success';
    if (status === 'failed') return 'danger';
    if (status?.startsWith('pending')) return 'warn';
    return 'secondary';
  }
}
