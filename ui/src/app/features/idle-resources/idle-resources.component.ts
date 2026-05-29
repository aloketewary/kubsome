import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { PageInfoComponent } from '../../shared/components/page-info.component';
import { SpotlightComponent } from '../../shared/components/spotlight.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { ConfirmService } from '../../shared/services/confirm.service';

@Component({
  selector: 'app-idle-resources',
  standalone: true,
  imports: [ButtonModule, TagModule, TooltipModule, FormsModule, InputTextModule, PageInfoComponent, SpotlightComponent, PageHeaderComponent, SkeletonComponent],
  template: `
    <app-spotlight id="idle-resources" title="Idle & Orphaned Resources" icon="pi pi-trash"
      description="Detect wasted resources — idle deployments, orphaned configs, unbound PVCs, stale jobs."
      [capabilities]="['Usage-based idle detection', 'Orphan detection', 'Safe cleanup commands', 'Savings estimation']" [compact]="true" />

    <app-page-header title="Idle Resources" [subtitle]="summary ? summary.total + ' found · $' + summary.total_savings_monthly?.toFixed(2) + '/mo savings · ' + lastUpdated : ''">
        <button class="ar-btn" [class.ar-active]="autoRefresh" (click)="toggleAutoRefresh()" [pTooltip]="autoRefresh ? 'Auto-refresh on (60s)' : 'Auto-refresh off'">
          <i class="pi" [class.pi-sync]="autoRefresh" [class.pi-pause]="!autoRefresh"></i>
        </button>
        <div class="search-wrap">
          <i class="pi pi-search"></i>
          <input pInputText [(ngModel)]="searchQuery" placeholder="Filter resources..." (ngModelChange)="applySearch()" />
        </div>
        <button pButton icon="pi pi-list" label="Dry Run" class="p-button-outlined p-button-sm" (click)="dryRun()" [disabled]="!items.length" [loading]="dryRunning"></button>
        <button pButton icon="pi pi-refresh" class="p-button-outlined p-button-sm p-button-rounded" (click)="refresh()" [loading]="loading"></button>
        <app-page-info title="Idle Resources" description="Scans for resources consuming cost without providing value."
          [tips]="['Idle = near-zero usage for 24h+', 'Orphaned = not referenced by any pod', 'Dry Run shows commands without executing']"
          [commands]="['unused', 'cleanup', 'cleanup-apply']" />
    </app-page-header>

    <!-- Summary Cards -->
    @if (summary && summary.total > 0) {
      <div class="summary-row">
        @for (cat of categoryList; track cat.name) {
          <div class="cat-card" [class.active]="filter === cat.name" (click)="toggleFilter(cat.name)">
            <span class="cat-count">{{ cat.count }}</span>
            <span class="cat-label">{{ cat.name }}</span>
            @if (cat.savings > 0) { <span class="cat-savings">{{ "$" + cat.savings.toFixed(2) }}</span> }
          </div>
        }
        <div class="cat-card total">
          <span class="cat-count">{{ summary.total }}</span>
          <span class="cat-label">Total</span>
          <span class="cat-savings">{{ "$" + summary.total_savings_monthly?.toFixed(2) }}/mo</span>
        </div>
      </div>
    }

    <!-- Items List -->
    @if (filteredItems.length) {
      <div class="items-list">
        @for (item of filteredItems; track item.name + item.kind) {
          <div class="item-row" [class]="'severity-' + item.severity">
            <div class="item-icon">
              @if (item.category === 'idle') { <i class="pi pi-moon"></i> }
              @else if (item.category === 'orphaned') { <i class="pi pi-link-off"></i> }
              @else if (item.category === 'stale') { <i class="pi pi-clock"></i> }
              @else { <i class="pi pi-question-circle"></i> }
            </div>
            <div class="item-info">
              <div class="item-title">
                <strong>{{ item.name }}</strong>
                <p-tag [value]="item.kind" severity="secondary" [rounded]="true" size="small" />
                <p-tag [value]="item.category" [severity]="catSeverity(item.category)" [rounded]="true" size="small" />
              </div>
              <span class="item-reason">{{ item.reason }}</span>
            </div>
            <div class="item-meta">
              @if (item.age_days) { <span class="item-age">{{ item.age_days }}d old</span> }
              @if (item.savings_monthly > 0) { <span class="item-savings">{{ "$" + item.savings_monthly.toFixed(2) }}/mo</span> }
            </div>
          </div>
        }
      </div>
    }

    @if (!items.length && !loading) {
      <div class="empty-state">
        <i class="pi pi-check-circle"></i>
        <h3>No Idle Resources</h3>
        <p>All resources are actively used. Nice work!</p>
      </div>
    }

    @if (loading && !items.length) {
      <app-skeleton variant="list" [count]="5" />
    }

    @if (loadError) {
      <div class="error-state">
        <i class="pi pi-exclamation-triangle"></i>
        <span>Failed to scan idle resources</span>
        <button pButton label="Retry" icon="pi pi-refresh" class="p-button-outlined p-button-sm" (click)="refresh()"></button>
      </div>
    }

    <!-- Dry Run Results -->
    @if (dryRunResults.length) {
      <div class="dryrun-section">
        <div class="dryrun-header">
          <h3>Cleanup Commands (dry-run)</h3>
          <button pButton icon="pi pi-copy" label="Copy All" class="p-button-outlined p-button-sm" (click)="copyAllCommands()"></button>
        </div>
        <p class="dryrun-hint">Copy and run these manually after review:</p>
        <div class="dryrun-list">
          @for (cmd of dryRunResults; track cmd.command) {
            <div class="dryrun-row">
              <code>{{ cmd.command }}</code>
              <span class="dryrun-reason">{{ cmd.reason }}</span>
            </div>
          }
        </div>
      </div>
    }

    <!-- Inline Toast -->
    @if (toast) {
      <div class="inline-toast" [class]="'toast-' + toast.severity">
        <i class="pi" [class.pi-check-circle]="toast.severity === 'success'" [class.pi-info-circle]="toast.severity === 'info'"></i>
        <span>{{ toast.message }}</span>
        <button class="toast-close" (click)="toast = null"><i class="pi pi-times"></i></button>
      </div>
    }
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
    .search-wrap { position: relative; }
    .search-wrap i { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 12px; }
    .search-wrap input { padding-left: 30px !important; width: 180px; }

    .inline-toast {
      position: fixed; bottom: 24px; right: 24px; z-index: 9000;
      display: flex; align-items: center; gap: 10px;
      padding: 12px 16px; border-radius: 10px;
      background: var(--bg-card); border: 1px solid var(--border);
      box-shadow: 0 8px 30px rgba(0,0,0,0.3);
      animation: slideIn 0.2s ease-out; font-size: 13px;
    }
    @keyframes slideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    .toast-success { border-left: 3px solid var(--success); }
    .toast-success i { color: var(--success); }
    .toast-info { border-left: 3px solid var(--accent); }
    .toast-info i { color: var(--accent); }
    .toast-close { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 2px; }
    .toast-close:hover { color: var(--text); }

    .error-state {
      display: flex; flex-direction: column; align-items: center; gap: 12px;
      padding: 48px; color: var(--text-muted); font-size: 13px;
      background: var(--bg-card); border: 1px solid var(--danger); border-radius: var(--radius);
    }
    .error-state i { font-size: 24px; color: var(--danger); }

    .summary-row { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
    .cat-card {
      padding: 12px 16px; background: var(--bg-card); border: 1px solid var(--border);
      border-radius: var(--radius); cursor: pointer; transition: all 0.15s; text-align: center; min-width: 90px;
    }
    .cat-card:hover { border-color: var(--accent); }
    .cat-card.active { border-color: var(--accent); background: var(--accent-subtle); }
    .cat-card.total { border-left: 3px solid var(--success); }
    .cat-count { display: block; font-size: 22px; font-weight: 800; }
    .cat-label { display: block; font-size: 10px; color: var(--text-muted); text-transform: uppercase; }
    .cat-savings { display: block; font-size: 11px; color: var(--success); font-weight: 600; margin-top: 2px; }

    .items-list { display: flex; flex-direction: column; gap: 6px; }
    .item-row {
      display: flex; align-items: center; gap: 14px;
      padding: 12px 16px; background: var(--bg-card); border: 1px solid var(--border);
      border-radius: var(--radius); transition: all 0.1s;
    }
    .item-row:hover { border-color: var(--accent); }
    .item-row.severity-high { border-left: 3px solid var(--danger); }
    .item-row.severity-medium { border-left: 3px solid var(--warning); }

    .item-icon { font-size: 16px; color: var(--text-muted); width: 24px; text-align: center; }
    .item-info { flex: 1; display: flex; flex-direction: column; gap: 3px; }
    .item-title { display: flex; align-items: center; gap: 8px; }
    .item-title strong { font-size: 13px; }
    .item-reason { font-size: 11px; color: var(--text-muted); }
    .item-meta { text-align: right; min-width: 80px; }
    .item-age { display: block; font-size: 11px; color: var(--text-muted); }
    .item-savings { display: block; font-size: 13px; font-weight: 700; color: var(--success); }

    .empty-state { text-align: center; padding: 60px 20px; color: var(--text-muted); }
    .empty-state i { font-size: 48px; color: var(--success); margin-bottom: 16px; }
    .empty-state h3 { font-size: 18px; margin: 0 0 8px; color: var(--text-primary); }

    .dryrun-section { margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--border); }
    .dryrun-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
    .dryrun-section h3 { font-size: 14px; font-weight: 600; margin: 0; }
    .dryrun-hint { font-size: 11px; color: var(--text-muted); margin: 0 0 12px; }
    .dryrun-list { display: flex; flex-direction: column; gap: 6px; }
    .dryrun-row { padding: 8px 12px; background: var(--bg-elevated); border-radius: var(--radius); }
    .dryrun-row code { display: block; font-size: 11px; font-family: 'JetBrains Mono', monospace; color: var(--accent); }
    .dryrun-reason { font-size: 10px; color: var(--text-muted); }

    .loading { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 60px; color: var(--text-muted); }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (max-width: 768px) {
      .summary-cards { grid-template-columns: repeat(2, 1fr); }
    }
  `],
})
export class IdleResourcesComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private confirmService = inject(ConfirmService);

  items: any[] = [];
  summary: any = null;
  loading = false;
  loadError = false;
  dryRunning = false;
  filter = '';
  searchQuery = '';
  dryRunResults: any[] = [];
  categoryList: { name: string; count: number; savings: number }[] = [];
  autoRefresh = true;
  lastUpdated = '';
  toast: { message: string; severity: 'success' | 'info' } | null = null;
  private timer: any;

  get filteredItems() {
    let result = this.items;
    if (this.filter) result = result.filter(i => i.category === this.filter);
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(i => i.name.toLowerCase().includes(q) || i.kind?.toLowerCase().includes(q));
    }
    return result;
  }

  ngOnInit() { this.refresh(); this.startAutoRefresh(); }
  ngOnDestroy() { clearInterval(this.timer); }

  toggleAutoRefresh() {
    this.autoRefresh = !this.autoRefresh;
    if (this.autoRefresh) this.startAutoRefresh();
    else clearInterval(this.timer);
  }

  private startAutoRefresh() {
    clearInterval(this.timer);
    this.timer = setInterval(() => this.refresh(), 60000);
  }

  applySearch() { /* filteredItems getter handles it */ }

  private showToast(message: string, severity: 'success' | 'info') {
    this.toast = { message, severity };
    setTimeout(() => { if (this.toast?.message === message) this.toast = null; }, 4000);
  }

  refresh() {
    this.loading = true;
    this.loadError = false;
    this.dryRunResults = [];
    this.http.get<any>('/api/idle-resources').subscribe({
      next: (res) => {
        this.items = res.items || [];
        this.summary = res.summary || {};
        this.categoryList = Object.entries(this.summary.categories || {})
          .map(([name, stats]: [string, any]) => ({ name, count: stats.count, savings: stats.savings }));
        this.loading = false;
        this.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      },
      error: () => { this.items = []; this.loading = false; this.loadError = true; },
    });
  }

  toggleFilter(cat: string) {
    this.filter = this.filter === cat ? '' : cat;
  }

  dryRun() {
    this.dryRunning = true;
    this.http.post<any>('/api/idle-resources/dry-run', {}).subscribe({
      next: (res) => { this.dryRunResults = res.commands || []; this.dryRunning = false; },
      error: () => { this.dryRunning = false; },
    });
  }

  copyAllCommands() {
    const text = this.dryRunResults.map(c => c.command).join('\n');
    navigator.clipboard.writeText(text).then(() => this.showToast('Commands copied to clipboard', 'success'));
  }

  catSeverity(cat: string): "success" | "warn" | "danger" | "info" | "secondary" | "contrast" | undefined {
    if (cat === 'idle') return 'warn';
    if (cat === 'orphaned') return 'info';
    if (cat === 'stale') return 'secondary';
    return 'info';
  }
}
