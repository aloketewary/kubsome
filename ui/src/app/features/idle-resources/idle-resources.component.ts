import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { PageInfoComponent } from '../../shared/components/page-info.component';
import { SpotlightComponent } from '../../shared/components/spotlight.component';

@Component({
  selector: 'app-idle-resources',
  standalone: true,
  imports: [ButtonModule, TagModule, PageInfoComponent, SpotlightComponent],
  template: `
    <app-spotlight id="idle-resources" title="Idle & Orphaned Resources" icon="pi pi-trash"
      description="Detect wasted resources — idle deployments, orphaned configs, unbound PVCs, stale jobs."
      [capabilities]="['Usage-based idle detection', 'Orphan detection', 'Safe cleanup commands', 'Savings estimation']" [compact]="true" />

    <div class="page-header">
      <div>
        <h1>Idle Resources</h1>
        <p class="subtitle">
          @if (summary) { {{ summary.total }} found · {{ "$" + summary.total_savings_monthly?.toFixed(2) }}/mo savings }
        </p>
      </div>
      <div class="header-actions">
        <button pButton icon="pi pi-list" label="Dry Run" class="p-button-outlined p-button-sm" (click)="dryRun()" [disabled]="!items.length" [loading]="dryRunning"></button>
        <button pButton icon="pi pi-refresh" class="p-button-outlined p-button-sm p-button-rounded" (click)="refresh()" [loading]="loading"></button>
      </div>
      <app-page-info title="Idle Resources" description="Scans for resources consuming cost without providing value. Uses 24h analytics data for idle detection and live state for orphan detection."
        [tips]="['Idle = near-zero usage for 24h+', 'Orphaned = not referenced by any pod', 'Dry Run shows commands without executing']"
        [commands]="['unused', 'cleanup', 'cleanup-apply']" />
    </div>

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
      <div class="loading"><div class="spin"></div> Scanning cluster...</div>
    }

    <!-- Dry Run Results -->
    @if (dryRunResults.length) {
      <div class="dryrun-section">
        <h3>Cleanup Commands (dry-run)</h3>
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
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .header-actions { display: flex; align-items: center; gap: 8px; }

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
    .dryrun-section h3 { font-size: 14px; font-weight: 600; margin: 0 0 4px; }
    .dryrun-hint { font-size: 11px; color: var(--text-muted); margin: 0 0 12px; }
    .dryrun-list { display: flex; flex-direction: column; gap: 6px; }
    .dryrun-row { padding: 8px 12px; background: var(--bg-elevated); border-radius: var(--radius); }
    .dryrun-row code { display: block; font-size: 11px; font-family: 'JetBrains Mono', monospace; color: var(--accent); }
    .dryrun-reason { font-size: 10px; color: var(--text-muted); }

    .loading { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 60px; color: var(--text-muted); }
    .spin { width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class IdleResourcesComponent implements OnInit {
  private http = inject(HttpClient);
  items: any[] = [];
  summary: any = null;
  loading = false;
  dryRunning = false;
  filter = '';
  dryRunResults: any[] = [];
  categoryList: { name: string; count: number; savings: number }[] = [];

  get filteredItems() {
    if (!this.filter) return this.items;
    return this.items.filter(i => i.category === this.filter);
  }

  ngOnInit() { this.refresh(); }

  refresh() {
    this.loading = true;
    this.dryRunResults = [];
    this.http.get<any>('/api/idle-resources').subscribe({
      next: (res) => {
        this.items = res.items || [];
        this.summary = res.summary || {};
        this.categoryList = Object.entries(this.summary.categories || {})
          .map(([name, stats]: [string, any]) => ({ name, count: stats.count, savings: stats.savings }));
        this.loading = false;
      },
      error: () => { this.items = []; this.loading = false; },
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

  catSeverity(cat: string): "success" | "warn" | "danger" | "info" | "secondary" | "contrast" | undefined {
    if (cat === 'idle') return 'warn';
    if (cat === 'orphaned') return 'info';
    if (cat === 'stale') return 'secondary';
    return 'info';
  }
}
