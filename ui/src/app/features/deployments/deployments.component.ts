import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ApiService } from '../../core/services/api.service';
import { Deployment } from '../../core/models';
import { ConfirmService } from '../../shared/services/confirm.service';
import { AiInsightDrawerComponent } from '../../shared/components/ai-insight-drawer.component';
import { SpotlightComponent } from '../../shared/components/spotlight.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

@Component({
  selector: 'app-deployments',
  standalone: true,
  imports: [TagModule, ButtonModule, TooltipModule, DialogModule, FormsModule, InputTextModule, AiInsightDrawerComponent, SpotlightComponent, PageHeaderComponent],
  template: `
    <app-spotlight id="deployments" title="Deployments" icon="pi pi-send"
      description="Manage deployments with rollout history, scaling, and rollback."
      [capabilities]="['Rolling restart/rollback', 'Visual replica scaling', 'Rollout history', 'AI diagnosis']" [compact]="true" />

    <app-page-header title="Deployments" [subtitle]="deployments.length + ' deployments in namespace · ' + lastUpdated">
        <button class="ar-btn" [class.ar-active]="autoRefresh" (click)="toggleAutoRefresh()" [pTooltip]="autoRefresh ? 'Auto-refresh on (30s)' : 'Auto-refresh off'">
          <i class="pi" [class.pi-sync]="autoRefresh" [class.pi-pause]="!autoRefresh"></i>
        </button>
        <div class="search-wrap">
          <i class="pi pi-search"></i>
          <input pInputText [(ngModel)]="searchQuery" placeholder="Filter..." (ngModelChange)="filter()" />
        </div>
        <button pButton icon="pi pi-refresh" class="p-button-outlined p-button-sm p-button-rounded" (click)="refresh()" pTooltip="Refresh" [loading]="loading"></button>
    </app-page-header>

    <!-- Summary -->
    <div class="summary-strip">
      <div class="summary-pill">
        <span class="pill-val">{{ deployments.length }}</span>
        <span class="pill-label">Total</span>
      </div>
      <div class="summary-pill pill-ok">
        <span class="pill-dot dot-ok"></span>
        <span class="pill-val">{{ healthyCount }}</span>
        <span class="pill-label">Healthy</span>
      </div>
      @if (degradedCount > 0) {
        <div class="summary-pill pill-bad">
          <span class="pill-dot dot-bad"></span>
          <span class="pill-val">{{ degradedCount }}</span>
          <span class="pill-label">Degraded</span>
        </div>
      }
    </div>

    <!-- Deployment List -->
    <div class="dep-list">
      @for (dep of filtered; track dep.name) {
        <div class="dep-card" [class.dep-degraded]="dep.available < dep.desired">
          <div class="dep-status-dot" [class.dot-healthy]="dep.available === dep.desired" [class.dot-unhealthy]="dep.available < dep.desired"></div>

          <div class="dep-body">
            <div class="dep-top">
              <code class="dep-name">{{ dep.name }}</code>
              <p-tag [value]="dep.available === dep.desired ? 'Healthy' : 'Degraded'" [severity]="dep.available === dep.desired ? 'success' : 'danger'" [rounded]="true" />
            </div>

            <!-- Replica Dots -->
            <div class="replica-row">
              <div class="replica-dots">
                @for (i of replicaArray(dep.desired); track i) {
                  <span class="replica-dot" [class.filled]="i < dep.available" [class.missing]="i >= dep.available"></span>
                }
              </div>
              <span class="replica-label">{{ dep.available }}/{{ dep.desired }} replicas</span>
            </div>
          </div>

          <!-- Actions (visible on hover) -->
          <div class="dep-actions">
            <button pButton icon="pi pi-sparkles" label="AI Diagnose" class="p-button-sm p-button-text p-button-warning" (click)="aiDiagnose(dep)"></button>
            <button pButton icon="pi pi-replay" label="Restart" class="p-button-sm p-button-text" (click)="onRestart(dep)" [disabled]="operating"></button>
            <button pButton icon="pi pi-undo" label="Rollback" class="p-button-sm p-button-text" (click)="onRollback(dep)" [disabled]="operating"></button>
            <button pButton icon="pi pi-arrows-v" label="Scale" class="p-button-sm p-button-text" (click)="onScale(dep)" [disabled]="operating"></button>
            <button pButton icon="pi pi-history" class="p-button-sm p-button-text" pTooltip="History" (click)="viewRollout(dep)"></button>
            <button pButton icon="pi pi-box" class="p-button-sm p-button-text" pTooltip="Pods" (click)="viewPods(dep)"></button>
          </div>
        </div>
      }

      <!-- AI Insight Drawer -->
      <app-ai-insight-drawer
        [visible]="aiDrawerVisible"
        [loading]="aiLoading"
        [resourceName]="selectedDepName"
        [summary]="aiSummary"
        [findings]="aiFindings"
        [reasoning]="aiReasoning"
        (closed)="aiDrawerVisible = false" />

      @if (filtered.length === 0 && searchQuery) {
        <div class="empty-state"><i class="pi pi-search"></i> No deployments matching "{{ searchQuery }}"</div>
      }
      @if (filtered.length === 0 && !searchQuery && !loadError) {
        <div class="empty-state"><i class="pi pi-send"></i> No deployments in this namespace</div>
      }
      @if (loadError) {
        <div class="error-state">
          <i class="pi pi-exclamation-triangle"></i>
          <span>Failed to load deployments</span>
          <button pButton label="Retry" icon="pi pi-refresh" class="p-button-outlined p-button-sm" (click)="refresh()"></button>
        </div>
      }
    </div>

    <!-- Rollout Dialog -->
    <p-dialog [(visible)]="rolloutVisible" [header]="'Rollout — ' + rolloutName" [modal]="true" [maximizable]="true" styleClass="fullscreen-dialog" [appendTo]="'body'">
      @if (rolloutData) {
        <div class="rollout-section">
          <h4>Status</h4>
          <pre class="rollout-pre">{{ rolloutData.status }}</pre>
        </div>
        <div class="rollout-section">
          <h4>History</h4>
          <pre class="rollout-pre">{{ rolloutData.history }}</pre>
        </div>
      } @else {
        <div class="dialog-loading"><i class="pi pi-spin pi-spinner"></i> Loading...</div>
      }
    </p-dialog>

    <!-- Scale Dialog -->
    <p-dialog [(visible)]="scaleVisible" header="Scale Deployment" [modal]="true" [style]="{ width: '420px' }" [appendTo]="'body'">
      <div class="scale-form">
        <div class="scale-header">
          <code>{{ scaleName }}</code>
          <span class="scale-current">Current: {{ scaleCurrentReplicas }}</span>
        </div>
        <div class="scale-visual">
          <button class="scale-btn" (click)="scaleReplicas = Math.max(0, scaleReplicas - 1)">−</button>
          <span class="scale-number">{{ scaleReplicas }}</span>
          <button class="scale-btn" (click)="scaleReplicas = scaleReplicas + 1">+</button>
        </div>
        <div class="scale-dots-preview">
          @for (i of replicaArray(scaleReplicas); track i) {
            <span class="replica-dot filled"></span>
          }
          @if (scaleReplicas === 0) {
            <span class="scale-zero-warn">⚠ This will scale to zero (no pods running)</span>
          }
        </div>
        <div class="scale-actions">
          <button pButton label="Cancel" class="p-button-text" (click)="scaleVisible = false"></button>
          <button pButton label="Apply" icon="pi pi-check" (click)="confirmScale()" [disabled]="scaleReplicas === scaleCurrentReplicas"></button>
        </div>
      </div>
    </p-dialog>
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
    .search-wrap input { padding-left: 30px !important; width: 160px; }

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

    /* List */
    .dep-list { display: flex; flex-direction: column; gap: 8px; }
    .dep-card {
      display: flex; align-items: center; gap: 12px;
      padding: 16px 18px; background: var(--bg-card);
      border: 1px solid var(--border); border-radius: var(--radius);
      transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
    }
    .dep-card:hover { border-color: var(--border-hover); transform: translateY(-2px); box-shadow: 0 8px 24px -8px rgba(0,0,0,0.2); }
    .dep-card:hover .dep-actions { opacity: 1; }
    .dep-degraded { border-left: 3px solid var(--danger); background: var(--danger-subtle); }

    .dep-status-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .dot-healthy { background: var(--success); }
    .dot-unhealthy { background: var(--danger); box-shadow: 0 0 6px var(--danger); }

    .dep-body { flex: 1; min-width: 0; }
    .dep-top { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .dep-name { font-size: 13px; font-weight: 600; }

    /* Replica Dots */
    .replica-row { display: flex; align-items: center; gap: 10px; }
    .replica-dots { display: flex; gap: 3px; }
    .replica-dot { width: 8px; height: 8px; border-radius: 50%; transition: all 0.2s; }
    .replica-dot.filled { background: var(--success); }
    .replica-dot.missing { background: var(--border); border: 1px dashed var(--danger); }
    .replica-label { font-size: 11px; color: var(--text-muted); font-family: 'JetBrains Mono', monospace; }

    /* Actions */
    .dep-actions { display: flex; gap: 2px; opacity: 0.4; transition: opacity 0.15s; flex-shrink: 0; }
    .dep-card:hover .dep-actions { opacity: 1; }
    @media (hover: none) { .dep-actions { opacity: 1; } }

    /* Dialogs */
    .rollout-section { margin-bottom: 16px; }
    .rollout-section h4 { font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px; }
    .rollout-pre {
      font-family: 'JetBrains Mono', monospace; font-size: 11px;
      background: var(--bg-elevated); padding: 12px; border-radius: 8px;
      white-space: pre-wrap; max-height: 200px; overflow-y: auto;
    }
    .dialog-loading { text-align: center; padding: 24px; color: var(--text-muted); }

    .scale-form { display: flex; flex-direction: column; gap: 16px; }
    .scale-header { display: flex; align-items: center; justify-content: space-between; }
    .scale-header code { font-size: 14px; font-weight: 600; }
    .scale-current { font-size: 12px; color: var(--text-muted); }
    .scale-visual { display: flex; align-items: center; justify-content: center; gap: 20px; }
    .scale-btn {
      width: 40px; height: 40px; border-radius: 50%; border: 1px solid var(--border);
      background: var(--bg-elevated); color: var(--text); font-size: 20px;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
    }
    .scale-btn:hover { border-color: var(--accent); color: var(--accent); transform: scale(1.1); }
    .scale-number { font-size: 36px; font-weight: 700; min-width: 60px; text-align: center; }
    .scale-dots-preview { display: flex; gap: 4px; justify-content: center; flex-wrap: wrap; min-height: 20px; }
    .scale-zero-warn { font-size: 12px; color: var(--warning); }
    .scale-actions { display: flex; justify-content: flex-end; gap: 8px; }

    .empty-state {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      padding: 48px; color: var(--text-muted); font-size: 13px;
    }
    .empty-state i { font-size: 16px; }
    .error-state {
      display: flex; flex-direction: column; align-items: center; gap: 12px;
      padding: 48px; color: var(--text-muted); font-size: 13px;
      background: var(--bg-card); border: 1px solid var(--danger); border-radius: var(--radius);
    }
    .error-state i { font-size: 24px; color: var(--danger); }
    @media (max-width: 768px) { }
  `],
})
export class DeploymentsComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private router = inject(Router);
  private confirmService = inject(ConfirmService);
  deployments: Deployment[] = [];
  filtered: Deployment[] = [];
  searchQuery = '';
  loading = false;
  loadError = false;
  autoRefresh = true;
  lastUpdated = '';
  private refreshTimer: any;

  rolloutVisible = false;
  rolloutName = '';
  rolloutData: any = null;

  scaleVisible = false;
  scaleName = '';
  scaleReplicas = 1;
  scaleCurrentReplicas = 1;

  // AI Insight State
  aiDrawerVisible = false;
  aiLoading = false;
  selectedDepName = '';
  aiSummary = '';
  aiFindings: any[] = [];
  aiReasoning = '';
  operating = false;

  Math = Math;

  get healthyCount() { return this.deployments.filter(d => d.available === d.desired).length; }
  get degradedCount() { return this.deployments.filter(d => d.available < d.desired).length; }

  replicaArray(n: number): number[] { return Array.from({ length: Math.min(n, 20) }, (_, i) => i); }

  filter() {
    const q = this.searchQuery.toLowerCase();
    if (!q) { this.filtered = this.sortDeps(this.deployments); return; }
    this.filtered = this.sortDeps(this.deployments.filter(d => d.name.toLowerCase().includes(q)));
  }

  private sortDeps(deps: Deployment[]): Deployment[] {
    return [...deps].sort((a, b) => {
      const aOk = a.available === a.desired ? 1 : 0;
      const bOk = b.available === b.desired ? 1 : 0;
      if (aOk !== bOk) return aOk - bOk; // degraded first
      return a.name.localeCompare(b.name);
    });
  }

  refresh() {
    this.loading = true;
    this.api.getDeployments().subscribe({
      next: (res) => {
        this.deployments = res.deployments;
        this.filter();
        this.loading = false;
        this.loadError = false;
        this.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      },
      error: () => {
        this.loading = false;
        this.loadError = true;
      },
    });
  }

  onRestart(dep: Deployment) {
    this.confirmService.confirm({
      title: 'Restart Deployment',
      message: `This will perform a rolling restart of "${dep.name}". Pods will be recreated.`,
      confirmLabel: 'Restart',
      severity: 'warning',
      productionGuard: true,
    }).then(ok => {
      if (ok) { this.operating = true; this.api.restart(dep.name).subscribe({ next: () => { this.operating = false; this.refresh(); }, error: () => { this.operating = false; } }); }
    });
  }

  onRollback(dep: Deployment) {
    this.confirmService.confirm({
      title: 'Rollback Deployment',
      message: `This will rollback "${dep.name}" to the previous revision. This cannot be undone.`,
      confirmLabel: 'Rollback',
      severity: 'danger',
      productionGuard: true,
    }).then(ok => {
      if (ok) { this.operating = true; this.api.rollback(dep.name).subscribe({ next: () => { this.operating = false; this.refresh(); }, error: () => { this.operating = false; } }); }
    });
  }

  onScale(dep: Deployment) {
    this.scaleName = dep.name;
    this.scaleReplicas = dep.desired;
    this.scaleCurrentReplicas = dep.desired;
    this.scaleVisible = true;
  }

  confirmScale() {
    this.confirmService.confirm({
      title: 'Scale Deployment',
      message: `Scale "${this.scaleName}" to ${this.scaleReplicas} replicas?`,
      confirmLabel: 'Scale',
      severity: 'warning',
      productionGuard: true,
    }).then(ok => {
      if (ok) {
        this.api.scale(this.scaleName, this.scaleReplicas).subscribe(() => {
          this.scaleVisible = false;
          this.refresh();
        });
      }
    });
  }

  viewRollout(dep: Deployment) {
    this.rolloutName = dep.name;
    this.rolloutVisible = true;
    this.rolloutData = null;
    this.api.getRollout(dep.name).subscribe(res => (this.rolloutData = res));
  }

  viewPods(dep: Deployment) {
    this.router.navigate(['/pods'], { queryParams: { filter: dep.name } });
  }

  aiDiagnose(dep: Deployment) {
    this.selectedDepName = dep.name;
    this.aiDrawerVisible = true;
    this.aiLoading = true;
    this.aiFindings = [];
    this.aiSummary = '';
    this.aiReasoning = '';

    // Use diagnose endpoint (works for deployments too via pod resolution in backend)
    this.api.diagnose(dep.name).subscribe({
      next: (res) => {
        this.aiFindings = res.findings || [];
        this.aiSummary = res.summary || `Analysis of deployment ${dep.name} complete. ${this.aiFindings.length} issues identified.`;
        this.aiReasoning = res.reasoning || 'AI analyzed rollout history, replica availability, and pod status patterns.';
        this.aiLoading = false;
      },
      error: () => {
        this.aiSummary = 'Failed to perform AI diagnosis for deployment.';
        this.aiLoading = false;
      }
    });
  }

  ngOnInit() {
    this.refresh();
    this.startAutoRefresh();
  }

  ngOnDestroy() { clearInterval(this.refreshTimer); }

  toggleAutoRefresh() {
    this.autoRefresh = !this.autoRefresh;
    if (this.autoRefresh) this.startAutoRefresh();
    else clearInterval(this.refreshTimer);
  }

  private startAutoRefresh() {
    clearInterval(this.refreshTimer);
    this.refreshTimer = setInterval(() => this.refresh(), 30000);
  }
}
