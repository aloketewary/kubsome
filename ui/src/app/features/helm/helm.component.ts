import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SpotlightComponent } from '../../shared/components/spotlight.component';

@Component({
  selector: 'app-helm',
  standalone: true,
  imports: [ButtonModule, TagModule, SpotlightComponent],
  template: `
    <app-spotlight id="helm" title="Helm Releases" icon="pi pi-box"
      description="Manage Helm releases — status, history, values diff, and rollback."
      [capabilities]="['Release list', 'Revision history', 'Values diff', 'Safe rollback']" [compact]="true" />

    <div class="page-header">
      <div>
        <h1>Helm Releases</h1>
        <p class="subtitle">{{ releases.length }} releases</p>
      </div>
      <div class="header-actions">
        <button pButton icon="pi pi-refresh" class="p-button-outlined p-button-sm p-button-rounded" (click)="refresh()" [loading]="loading"></button>
      </div>
    </div>

    @if (!releases.length && !loading) {
      <div class="empty-state"><i class="pi pi-box"></i><h3>No Helm Releases</h3><p>No releases found. Is Helm installed?</p></div>
    }

    @if (releases.length) {
      <div class="releases-table">
        @for (rel of releases; track rel.name) {
          <div class="release-row" (click)="selectRelease(rel.name)" [class.selected]="selected?.name === rel.name">
            <div class="rel-main">
              <strong>{{ rel.name }}</strong>
              <span class="rel-chart">{{ rel.chart }}</span>
            </div>
            <div class="rel-meta">
              <p-tag [value]="rel.status" [severity]="statusSev(rel.status)" [rounded]="true" size="small" />
              <span class="rel-rev">rev {{ rel.revision }}</span>
              <span class="rel-ver">{{ rel.app_version }}</span>
              <span class="rel-time">{{ rel.updated?.substring(0, 16) }}</span>
            </div>
          </div>
        }
      </div>
    }

    @if (selected) {
      <div class="detail-panel">
        <div class="detail-header">
          <h3>{{ selected.name }}</h3>
          <div class="detail-actions">
            <button pButton label="History" icon="pi pi-history" class="p-button-outlined p-button-sm" (click)="loadHistory()"></button>
            <button pButton label="Diff" icon="pi pi-copy" class="p-button-outlined p-button-sm" (click)="loadDiff()"></button>
            <button pButton label="Rollback" icon="pi pi-undo" class="p-button-outlined p-button-sm p-button-danger" (click)="rollback()"></button>
          </div>
        </div>

        @if (history.length) {
          <h4>Revision History</h4>
          @for (rev of history; track rev.revision) {
            <div class="history-row">
              <span class="rev-num">{{ rev.revision }}</span>
              <p-tag [value]="rev.status" [severity]="statusSev(rev.status)" [rounded]="true" size="small" />
              <span class="rev-chart">{{ rev.chart }}</span>
              <span class="rev-desc">{{ rev.description }}</span>
              <span class="rev-time">{{ rev.updated?.substring(0, 16) }}</span>
            </div>
          }
        }

        @if (diff) {
          <h4>Changes (rev {{ diff.previous_revision }} → {{ diff.current_revision }})</h4>
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
          @if (!diff.changes?.length) { <p class="empty-tab">No value changes between revisions</p> }
        }
      </div>
    }

    @if (loading) { <div class="loading"><div class="spin"></div></div> }
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
    .page-header h1 { font-size: 24px; font-weight: 700; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .header-actions { display: flex; gap: 8px; }
    .releases-table { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
    .release-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); cursor: pointer; transition: all 0.15s; }
    .release-row:hover { border-color: var(--accent); transform: translateX(2px); }
    .release-row.selected { border-color: var(--accent); border-left: 3px solid var(--accent); }
    .rel-main { display: flex; flex-direction: column; }
    .rel-chart { font-size: 11px; color: var(--text-muted); }
    .rel-meta { display: flex; align-items: center; gap: 10px; font-size: 12px; }
    .rel-rev, .rel-ver { color: var(--text-muted); }
    .rel-time { font-size: 11px; color: var(--text-muted); }
    .detail-panel { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; }
    .detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .detail-header h3 { margin: 0; font-size: 16px; }
    .detail-actions { display: flex; gap: 6px; }
    h4 { font-size: 13px; font-weight: 600; margin: 16px 0 8px; }
    .history-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; font-size: 12px; border-bottom: 1px solid var(--border); }
    .rev-num { font-weight: 700; min-width: 24px; }
    .rev-chart { color: var(--text-muted); }
    .rev-desc { flex: 1; color: var(--text-secondary); }
    .rev-time { font-size: 11px; color: var(--text-muted); }
    .diff-row { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 12px; font-family: 'JetBrains Mono', monospace; }
    .diff-added { color: var(--success); }
    .diff-removed { color: var(--danger); }
    .diff-changed { color: var(--warning); }
    .diff-icon { font-weight: 700; min-width: 12px; }
    .diff-path { font-weight: 600; min-width: 150px; }
    .diff-old { text-decoration: line-through; color: var(--text-muted); }
    .diff-arrow { color: var(--accent); }
    .diff-new { color: var(--accent); }
    .diff-val { color: var(--text-secondary); }
    .empty-state { text-align: center; padding: 60px; color: var(--text-muted); }
    .empty-state i { font-size: 48px; opacity: 0.3; margin-bottom: 16px; }
    .empty-tab { color: var(--text-muted); font-size: 13px; }
    .loading { display: flex; justify-content: center; padding: 40px; }
    .spin { width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (max-width: 768px) {
      .page-header { flex-direction: column; gap: 12px; }
      .release-grid { grid-template-columns: 1fr; }
    }
  `],
})
export class HelmComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  releases: any[] = [];
  selected: any = null;
  history: any[] = [];
  diff: any = null;
  loading = false;
  private timer: any;

  ngOnInit() { this.refresh(); this.timer = setInterval(() => this.refresh(), 30000); }
  ngOnDestroy() { clearInterval(this.timer); }

  refresh() {
    this.loading = true;
    this.http.get<any>('/api/helm/list').subscribe({
      next: (res) => { this.releases = res.releases || []; this.loading = false; },
      error: () => { this.releases = []; this.loading = false; },
    });
  }

  selectRelease(name: string) {
    this.selected = this.releases.find(r => r.name === name);
    this.history = [];
    this.diff = null;
  }

  loadHistory() {
    if (!this.selected) return;
    this.http.get<any>(`/api/helm/history/${this.selected.name}`).subscribe({
      next: (res) => { this.history = res.revisions || []; },
    });
  }

  loadDiff() {
    if (!this.selected) return;
    this.http.get<any>(`/api/helm/diff/${this.selected.name}`).subscribe({
      next: (res) => { this.diff = res; },
    });
  }

  rollback() {
    if (!this.selected || !confirm(`Rollback ${this.selected.name}?`)) return;
    this.http.post<any>(`/api/helm/rollback/${this.selected.name}`, {}).subscribe({
      next: (res) => { alert(res.message || 'Rolled back'); this.refresh(); },
      error: (err) => { alert(err.error?.message || 'Rollback failed'); },
    });
  }

  statusSev(status: string): "success" | "warn" | "danger" | "info" | "secondary" | "contrast" | undefined {
    if (status === 'deployed') return 'success';
    if (status === 'failed') return 'danger';
    if (status?.startsWith('pending')) return 'warn';
    return 'secondary';
  }
}
