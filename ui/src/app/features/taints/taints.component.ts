import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { SpotlightComponent } from '../../shared/components/spotlight.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

@Component({
  selector: 'app-taints',
  standalone: true,
  imports: [TagModule, ButtonModule, TooltipModule, FormsModule, InputTextModule, SpotlightComponent, PageHeaderComponent],
  template: `
    <app-spotlight id="taints" title="Node Taints" icon="pi pi-ban"
      description="View and manage Kubernetes node taints."
      [capabilities]="['List taints', 'Apply taint', 'Remove taint']" [compact]="true" />

    <app-page-header title="Node Taints" [subtitle]="'Manage scheduling constraints · ' + lastUpdated">
        <button pButton icon="pi pi-refresh" class="p-button-outlined p-button-sm p-button-rounded" (click)="load()" pTooltip="Refresh" [loading]="loading"></button>
    </app-page-header>

    <!-- Summary -->
    <div class="summary-strip">
      <div class="summary-pill">
        <i class="pi pi-server"></i>
        <span class="pill-val">{{ nodes.length }}</span>
        <span class="pill-label">Nodes</span>
      </div>
      <div class="summary-pill">
        <i class="pi pi-ban"></i>
        <span class="pill-val">{{ totalTaints }}</span>
        <span class="pill-label">Taints</span>
      </div>
      @if (noScheduleCount > 0) {
        <div class="summary-pill pill-warn">
          <span class="pill-dot dot-warn"></span>
          <span class="pill-val">{{ noScheduleCount }}</span>
          <span class="pill-label">NoSchedule</span>
        </div>
      }
      @if (noExecuteCount > 0) {
        <div class="summary-pill pill-danger">
          <span class="pill-dot dot-danger"></span>
          <span class="pill-val">{{ noExecuteCount }}</span>
          <span class="pill-label">NoExecute</span>
        </div>
      }
    </div>

    <!-- Add Taint Form -->
    <div class="add-form">
      <div class="form-header">
        <i class="pi pi-plus-circle"></i>
        <span>Apply Taint</span>
      </div>
      <div class="form-row">
        <select class="form-select" [(ngModel)]="newNode">
          <option value="">Select node...</option>
          @for (n of nodeNames; track n) {
            <option [value]="n">{{ n }}</option>
          }
        </select>
        <input pInputText [(ngModel)]="newSpec" placeholder="key=value:NoSchedule" class="form-input" />
        <button pButton label="Apply" icon="pi pi-check" class="p-button-sm" (click)="applyTaint()" [disabled]="!newNode || !newSpec"></button>
      </div>
      @if (actionMessage) {
        <div class="action-msg" [class.msg-success]="actionSuccess" [class.msg-error]="!actionSuccess">
          {{ actionMessage }}
        </div>
      }
    </div>

    <!-- Taints Table -->
    <div class="taint-list">
      @for (node of nodes; track node.node) {
        @if (node.taints.length > 0) {
          <div class="node-card">
            <div class="node-header">
              <i class="pi pi-server"></i>
              <code class="node-name">{{ node.node }}</code>
              <p-tag [value]="node.taints.length + ' taint(s)'" severity="warn" [rounded]="true" />
            </div>
            <div class="taint-rows">
              @for (t of node.taints; track $index) {
                <div class="taint-row">
                  <code class="taint-key">{{ t.key }}</code>
                  <span class="taint-eq">=</span>
                  <span class="taint-val">{{ t.value || '&lt;none&gt;' }}</span>
                  <p-tag [value]="t.effect" [severity]="effectSeverity(t.effect)" [rounded]="true" />
                  <button pButton icon="pi pi-trash" class="p-button-text p-button-sm p-button-danger" pTooltip="Remove taint" (click)="removeTaint(node.node, t)"></button>
                </div>
              }
            </div>
          </div>
        }
      }

      @if (totalTaints === 0 && !loading) {
        <div class="empty-state">
          <i class="pi pi-check-circle"></i>
          No taints on any node
        </div>
      }
    </div>
  `,
  styles: [`

    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .header-actions { display: flex; align-items: center; gap: 8px; }

    .summary-strip {
      display: flex; gap: 8px; margin-bottom: 16px;
      padding: 14px 18px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
    }
    .summary-pill { display: flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px; background: var(--bg-elevated); font-size: 12px; }
    .summary-pill i { font-size: 12px; color: var(--text-muted); }
    .pill-warn { background: var(--warning-subtle); }
    .pill-danger { background: var(--danger-subtle); }
    .pill-dot { width: 6px; height: 6px; border-radius: 50%; }
    .dot-warn { background: var(--warning); }
    .dot-danger { background: var(--danger); }
    .pill-val { font-weight: 700; }
    .pill-label { color: var(--text-muted); }

    .add-form {
      padding: 16px 18px; margin-bottom: 16px;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
    }
    .form-header { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; margin-bottom: 12px; }
    .form-header i { color: var(--accent); }
    .form-row { display: flex; gap: 8px; align-items: center; }
    .form-select {
      padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border);
      background: var(--bg-elevated); color: var(--text); font-size: 12px; outline: none; min-width: 180px;
    }
    .form-select:focus { border-color: var(--accent); }
    .form-input { flex: 1; font-family: 'JetBrains Mono', monospace; font-size: 12px; }
    .action-msg { margin-top: 10px; font-size: 12px; padding: 6px 10px; border-radius: 4px; }
    .msg-success { background: var(--success-subtle); color: var(--success); }
    .msg-error { background: var(--danger-subtle); color: var(--danger); }

    .taint-list { display: flex; flex-direction: column; gap: 8px; }
    .node-card {
      padding: 14px 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
      transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
    }
    .node-card:hover { border-color: var(--border-hover); transform: translateY(-1px); box-shadow: 0 4px 16px -4px rgba(0,0,0,0.12); }
    .node-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .node-header i { color: var(--accent); font-size: 14px; }
    .node-name { font-size: 13px; font-weight: 600; }
    .taint-rows { display: flex; flex-direction: column; gap: 6px; padding-left: 22px; }
    .taint-row { display: flex; align-items: center; gap: 8px; font-size: 12px; }
    .taint-key { color: var(--accent); font-weight: 600; }
    .taint-eq { color: var(--text-muted); }
    .taint-val { color: var(--text-secondary); min-width: 60px; }

    .empty-state {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      padding: 48px; color: var(--text-muted); font-size: 13px;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
    }
    .empty-state i { font-size: 16px; color: var(--success); }
    @media (max-width: 768px) {
      .summary-strip { flex-wrap: wrap; }
    }
  `],
})
export class TaintsComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  nodes: any[] = [];
  loading = false;
  lastUpdated = '';
  newNode = '';
  newSpec = '';
  actionMessage = '';
  actionSuccess = false;
  private refreshTimer: any;

  get nodeNames() { return this.nodes.map(n => n.node); }
  get totalTaints() { return this.nodes.reduce((sum, n) => sum + n.taints.length, 0); }
  get noScheduleCount() { return this.nodes.reduce((sum, n) => sum + n.taints.filter((t: any) => t.effect === 'NoSchedule').length, 0); }
  get noExecuteCount() { return this.nodes.reduce((sum, n) => sum + n.taints.filter((t: any) => t.effect === 'NoExecute').length, 0); }

  ngOnInit() {
    this.load();
    this.refreshTimer = setInterval(() => this.load(), 30000);
  }

  ngOnDestroy() { clearInterval(this.refreshTimer); }

  load() {
    this.loading = true;
    this.http.get<any>('/api/taints').subscribe({
      next: (res) => {
        this.nodes = res.nodes || [];
        this.loading = false;
        this.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      },
      error: () => { this.nodes = []; this.loading = false; },
    });
  }

  applyTaint() {
    if (!this.newNode || !this.newSpec) return;
    this.actionMessage = '';
    this.http.post<any>('/api/taint', { node: this.newNode, spec: this.newSpec }).subscribe({
      next: (res) => {
        this.actionSuccess = res.success;
        this.actionMessage = res.success ? `✓ Tainted ${this.newNode}` : res.output;
        if (res.success) { this.newSpec = ''; this.load(); }
      },
      error: (err) => { this.actionSuccess = false; this.actionMessage = err.error?.detail || 'Failed'; },
    });
  }

  removeTaint(node: string, taint: any) {
    const spec = taint.value ? `${taint.key}=${taint.value}:${taint.effect}` : `${taint.key}:${taint.effect}`;
    this.http.post<any>('/api/untaint', { node, spec }).subscribe({
      next: (res) => {
        this.actionSuccess = res.success;
        this.actionMessage = res.success ? `✓ Removed taint from ${node}` : res.output;
        if (res.success) this.load();
      },
      error: (err) => { this.actionSuccess = false; this.actionMessage = err.error?.detail || 'Failed'; },
    });
  }

  effectSeverity(effect: string): 'warn' | 'danger' | 'info' {
    if (effect === 'NoExecute') return 'danger';
    if (effect === 'NoSchedule') return 'warn';
    return 'info';
  }
}
