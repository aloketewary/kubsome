import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TitleCasePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { PageInfoComponent } from '../../shared/components/page-info.component';
import { SpotlightComponent } from '../../shared/components/spotlight.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

@Component({
  selector: 'app-gitops',
  standalone: true,
  imports: [ButtonModule, TagModule, TitleCasePipe, PageInfoComponent, SpotlightComponent, PageHeaderComponent],
  template: `
    <app-spotlight id="gitops" title="GitOps Status" icon="pi pi-sync"
      description="ArgoCD/Flux sync status, drift detection, and deployment tracking."
      [capabilities]="['Sync status', 'Drift detection', 'Revision tracking', 'Health monitoring']" [compact]="true" />

    <app-page-header title="GitOps Status" [subtitle]="data?.provider ? (data.provider | titlecase) + ' · ' + data.total + ' apps · ' + lastUpdated : 'Detecting GitOps provider...'">
        <button pButton icon="pi pi-refresh" class="p-button-outlined p-button-sm p-button-rounded" (click)="refresh()" [loading]="loading"></button>
        <app-page-info title="GitOps" description="Shows ArgoCD or Flux application sync status, health, and drift detection."
          [tips]="['Green = synced with Git', 'Yellow = drifted from desired state', 'Click app name for details']"
          [commands]="['gitops', 'gitops <app>', 'argocd', 'flux']" />
    </app-page-header>

    @if (data && !data.provider) {
      <div class="empty-state">
        <i class="pi pi-sync"></i>
        <h3>No GitOps Tool Detected</h3>
        <p>ArgoCD or Flux not found in this cluster.</p>
        <div class="install-hint">
          <p><strong>Install ArgoCD:</strong></p>
          <code>kubectl create namespace argocd && kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml</code>
          <p><strong>Install Flux:</strong></p>
          <code>flux install</code>
        </div>
      </div>
    }

    @if (data?.provider) {
      <!-- Summary Cards -->
      <div class="summary-grid">
        <div class="summary-card">
          <span class="summary-value">{{ data.total }}</span>
          <span class="summary-label">Total Apps</span>
        </div>
        <div class="summary-card success">
          <span class="summary-value">{{ data.synced }}</span>
          <span class="summary-label">Synced</span>
        </div>
        <div class="summary-card warn">
          <span class="summary-value">{{ data.out_of_sync }}</span>
          <span class="summary-label">Drifted</span>
        </div>
        <div class="summary-card danger">
          <span class="summary-value">{{ data.degraded }}</span>
          <span class="summary-label">Degraded</span>
        </div>
      </div>

      <!-- Apps Table -->
      <div class="apps-table">
        <div class="table-header">
          <span class="col-icon"></span>
          <span class="col-name">Application</span>
          <span class="col-sync">Sync</span>
          <span class="col-health">Health</span>
          <span class="col-rev">Revision</span>
          <span class="col-ns">Namespace</span>
          <span class="col-time">Last Synced</span>
        </div>
        @for (app of data.apps; track app.name) {
          <div class="table-row" (click)="selectApp(app.name)">
            <span class="col-icon">
              @if (app.sync_status === 'Synced' || app.sync_status === 'Ready') {
                <i class="pi pi-check-circle status-ok"></i>
              } @else if (app.sync_status === 'OutOfSync' || app.sync_status === 'NotReady') {
                <i class="pi pi-exclamation-triangle status-warn"></i>
              } @else {
                <i class="pi pi-times-circle status-err"></i>
              }
            </span>
            <span class="col-name">{{ app.name }}</span>
            <span class="col-sync">
              <p-tag [value]="app.sync_status" [severity]="syncSeverity(app.sync_status)" [rounded]="true" />
            </span>
            <span class="col-health">
              <p-tag [value]="app.health" [severity]="healthSeverity(app.health)" [rounded]="true" />
            </span>
            <span class="col-rev mono">{{ app.revision || '—' }}</span>
            <span class="col-ns">{{ app.namespace }}</span>
            <span class="col-time">{{ formatTime(app.last_synced) }}</span>
          </div>
        }
      </div>

      <!-- Detail Panel -->
      @if (detail) {
        <div class="detail-panel">
          <div class="detail-header">
            <h3>{{ detail.name }}</h3>
            <button pButton icon="pi pi-times" class="p-button-text p-button-sm" (click)="detail = null"></button>
          </div>
          <div class="detail-grid">
            <div class="detail-item"><span class="dl">Repo</span><span class="dv mono">{{ detail.repo }}</span></div>
            <div class="detail-item"><span class="dl">Path</span><span class="dv mono">{{ detail.path || '/' }}</span></div>
            <div class="detail-item"><span class="dl">Target</span><span class="dv">{{ detail.target_revision || 'HEAD' }}</span></div>
            <div class="detail-item"><span class="dl">Revision</span><span class="dv mono">{{ detail.revision?.substring(0, 12) || '—' }}</span></div>
            <div class="detail-item"><span class="dl">Last Sync</span><span class="dv">{{ detail.last_synced?.substring(0, 19) || '—' }}</span></div>
            @if (detail.sync_result) {
              <div class="detail-item full"><span class="dl">Result</span><span class="dv">{{ detail.sync_result }}</span></div>
            }
          </div>

          @if (detail.resources?.length) {
            <h4>Resources ({{ detail.resources.length }})</h4>
            <div class="res-list">
              @for (res of detail.resources; track res.name) {
                <div class="res-row">
                  <span class="res-kind">{{ res.kind }}</span>
                  <span class="res-name">{{ res.name }}</span>
                  <p-tag [value]="res.status || '—'" [severity]="syncSeverity(res.status)" size="small" [rounded]="true" />
                  <p-tag [value]="res.health || '—'" [severity]="healthSeverity(res.health)" size="small" [rounded]="true" />
                </div>
              }
            </div>
          }
        </div>
      }
    }

    @if (!data) {
      <div class="loading"><div class="spin"></div> Detecting GitOps provider...</div>
    }
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .header-actions { display: flex; align-items: center; gap: 8px; }

    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; animation: fadeIn 0.3s ease; }
    .summary-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; text-align: center; }
    .summary-card.success { border-left: 3px solid var(--success); }
    .summary-card.warn { border-left: 3px solid var(--warning); }
    .summary-card.danger { border-left: 3px solid var(--danger); }
    .summary-value { display: block; font-size: 28px; font-weight: 800; }
    .summary-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }

    .apps-table { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
    .table-header, .table-row { display: grid; grid-template-columns: 32px 2fr 100px 100px 90px 1fr 130px; align-items: center; padding: 10px 16px; gap: 8px; }
    .table-header { font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); border-bottom: 1px solid var(--border); }
    .table-row { font-size: 13px; border-bottom: 1px solid var(--border); cursor: pointer; transition: all 0.12s; }
    .table-row:hover { background: var(--bg-elevated); transform: translateX(2px); }
    .table-row:last-child { border-bottom: none; }
    .col-name { font-weight: 600; }
    .mono { font-family: 'JetBrains Mono', monospace; font-size: 11px; }
    .col-time { font-size: 11px; color: var(--text-muted); }
    .status-ok { color: var(--success); }
    .status-warn { color: var(--warning); }
    .status-err { color: var(--danger); }

    .detail-panel { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; margin-top: 16px; }
    .detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .detail-header h3 { font-size: 16px; font-weight: 700; margin: 0; }
    .detail-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 16px; }
    .detail-item { display: flex; flex-direction: column; gap: 2px; }
    .detail-item.full { grid-column: 1 / -1; }
    .dl { font-size: 11px; color: var(--text-muted); text-transform: uppercase; }
    .dv { font-size: 13px; word-break: break-all; }
    h4 { font-size: 13px; font-weight: 600; margin: 16px 0 8px; }
    .res-list { display: flex; flex-direction: column; gap: 4px; }
    .res-row { display: flex; align-items: center; gap: 8px; font-size: 12px; padding: 4px 0; }
    .res-kind { font-size: 11px; color: var(--text-muted); min-width: 80px; }
    .res-name { flex: 1; font-weight: 500; }

    .empty-state { text-align: center; padding: 60px 20px; color: var(--text-muted); }
    .empty-state i { font-size: 48px; margin-bottom: 16px; opacity: 0.3; }
    .empty-state h3 { font-size: 18px; margin: 0 0 8px; color: var(--text-primary); }
    .install-hint { text-align: left; max-width: 600px; margin: 20px auto 0; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; }
    .install-hint code { display: block; font-size: 11px; background: var(--bg-elevated); padding: 8px; border-radius: 4px; margin: 4px 0 12px; word-break: break-all; }

    .loading { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 60px; color: var(--text-muted); }
    .spin { width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (max-width: 768px) { .summary-grid { grid-template-columns: repeat(2, 1fr); } .table-header, .table-row { grid-template-columns: 32px 1fr 80px 80px; } .col-rev, .col-ns, .col-time { display: none; } }
  `],
})
export class GitopsComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  data: any = null;
  detail: any = null;
  loading = false;
  lastUpdated = '';
  private timer: any;

  ngOnInit() { this.refresh(); this.timer = setInterval(() => this.refresh(), 30000); }
  ngOnDestroy() { clearInterval(this.timer); }

  refresh() {
    this.loading = true;
    this.http.get<any>('/api/gitops').subscribe({
      next: (res) => { this.data = res; this.loading = false; this.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); },
      error: () => { this.data = { provider: null, apps: [] }; this.loading = false; },
    });
  }

  selectApp(name: string) {
    this.http.get<any>(`/api/gitops/${name}`).subscribe({
      next: (res) => { this.detail = res; },
      error: () => { this.detail = null; },
    });
  }

  syncSeverity(status: string): "success" | "warn" | "danger" | "info" | "secondary" | "contrast" | undefined {
    if (status === 'Synced' || status === 'Ready') return 'success';
    if (status === 'OutOfSync' || status === 'NotReady') return 'warn';
    if (status === 'Degraded' || status === 'Unknown') return 'danger';
    return 'info';
  }

  healthSeverity(health: string): "success" | "warn" | "danger" | "info" | "secondary" | "contrast" | undefined {
    if (health === 'Healthy' || health === 'True') return 'success';
    if (health === 'Progressing') return 'info';
    if (health === 'Degraded' || health === 'False') return 'danger';
    return 'secondary';
  }

  formatTime(ts: string): string {
    if (!ts) return '—';
    try { return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return ts.substring(0, 16); }
  }
}
