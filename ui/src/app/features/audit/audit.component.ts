import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [FormsModule, TagModule, ButtonModule, PageHeaderComponent],
  template: `
    <app-page-header title="Audit Log" subtitle="Track destructive operations across the team">
        <select class="filter-select" [(ngModel)]="filterAction" (ngModelChange)="load()">
          <option value="">All Actions</option>
          @for (action of actionTypes; track action) {
            <option [value]="action">{{ action }}</option>
          }
        </select>
        <button pButton icon="pi pi-refresh" class="p-button-outlined p-button-sm" (click)="load()" [loading]="loading"></button>
    </app-page-header>

    <!-- Summary Cards -->
    @if (summary && Object.keys(summary).length > 0) {
      <div class="summary-row">
        @for (entry of summaryEntries; track entry.action) {
          <div class="summary-card" [class.active]="filterAction === entry.action" (click)="filterAction = entry.action; load()">
            <span class="sc-count">{{ entry.count }}</span>
            <span class="sc-label">{{ entry.action }}</span>
          </div>
        }
        @if (filterAction) {
          <button class="clear-filter" (click)="filterAction = ''; load()">
            <i class="pi pi-times"></i> Clear
          </button>
        }
      </div>
    }

    <!-- Audit Entries -->
    @if (entries.length > 0) {
      <div class="audit-list">
        @for (entry of entries; track $index) {
          <div class="audit-entry">
            <div class="ae-icon" [class]="actionClass(entry.action)">
              <i class="pi" [class]="actionIcon(entry.action)"></i>
            </div>
            <div class="ae-body">
              <div class="ae-top">
                <span class="ae-action">{{ entry.action }}</span>
                <span class="ae-target">{{ entry.target }}</span>
                @if (entry.details) {
                  <span class="ae-details">{{ entry.details }}</span>
                }
              </div>
              <div class="ae-meta">
                <span class="ae-ctx">{{ entry.context }}</span>
                <span class="ae-ns">{{ entry.namespace }}</span>
              </div>
            </div>
            <span class="ae-time">{{ formatTime(entry.timestamp) }}</span>
          </div>
        }
      </div>
    }

    @if (entries.length === 0 && !loading) {
      <div class="empty-state">
        <div class="empty-icon"><i class="pi pi-shield"></i></div>
        <h3>No audit entries</h3>
        <p>Destructive operations (restart, rollback, scale, delete) will appear here.</p>
      </div>
    }
  `,
  styles: [`

    .filter-select {
      padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border);
      background: var(--bg-elevated); color: var(--text); font-size: 12px; outline: none;
    }
    .filter-select:focus { border-color: var(--accent); }

    .summary-row {
      display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; align-items: center;
    }
    .summary-card {
      padding: 10px 16px; background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 8px; cursor: pointer; transition: all 0.2s; text-align: center;
    }
    .summary-card:hover { border-color: var(--accent); }
    .summary-card.active { border-color: var(--accent); background: var(--accent-subtle); }
    .sc-count { display: block; font-size: 18px; font-weight: 700; font-family: 'JetBrains Mono', monospace; }
    .sc-label { display: block; font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-top: 2px; }
    .clear-filter {
      display: flex; align-items: center; gap: 4px; padding: 6px 10px;
      border-radius: 6px; border: 1px solid var(--border); background: transparent;
      color: var(--text-muted); font-size: 11px; cursor: pointer; transition: all 0.2s;
    }
    .clear-filter:hover { border-color: var(--danger); color: var(--danger); }

    .audit-list { display: flex; flex-direction: column; gap: 4px; }
    .audit-entry {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 16px; background: var(--bg-card);
      border: 1px solid var(--border); border-radius: 8px;
      transition: all 0.2s;
    }
    .audit-entry:hover { border-color: var(--border-hover); }

    .ae-icon {
      width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center; font-size: 13px;
    }
    .ae-icon.action-restart { background: var(--warning-subtle); color: var(--warning); }
    .ae-icon.action-rollback { background: var(--accent-subtle); color: var(--accent); }
    .ae-icon.action-scale { background: var(--success-subtle); color: var(--success); }
    .ae-icon.action-delete { background: var(--danger-subtle); color: var(--danger); }
    .ae-icon.action-trigger { background: rgba(168,85,247,0.1); color: #a855f7; }
    .ae-icon.action-default { background: var(--bg-elevated); color: var(--text-muted); }

    .ae-body { flex: 1; min-width: 0; }
    .ae-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .ae-action {
      font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;
      background: var(--bg-elevated); text-transform: uppercase; letter-spacing: 0.03em;
    }
    .ae-target { font-size: 13px; font-weight: 500; font-family: 'JetBrains Mono', monospace; }
    .ae-details { font-size: 11px; color: var(--text-muted); }
    .ae-meta { display: flex; gap: 8px; margin-top: 3px; }
    .ae-ctx, .ae-ns { font-size: 10px; color: var(--text-muted); }

    .ae-time {
      font-size: 10px; color: var(--text-muted); font-family: 'JetBrains Mono', monospace;
      white-space: nowrap; flex-shrink: 0;
    }

    .empty-state {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      padding: 60px; color: var(--text-muted);
    }
    .empty-icon {
      width: 56px; height: 56px; border-radius: 50%;
      background: var(--bg-elevated); color: var(--text-muted);
      display: flex; align-items: center; justify-content: center; font-size: 24px;
    }
    .empty-state h3 { font-size: 16px; font-weight: 600; color: var(--text); margin: 0; }
    .empty-state p { font-size: 13px; margin: 0; }

  `],
})
export class AuditComponent implements OnInit {
  private http = inject(HttpClient);
  entries: any[] = [];
  summary: Record<string, number> = {};
  summaryEntries: { action: string; count: number }[] = [];
  actionTypes: string[] = [];
  filterAction = '';
  loading = false;
  Object = Object;

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    const params: any = { limit: '100' };
    if (this.filterAction) params.action = this.filterAction;

    this.http.get<any>('/api/audit', { params }).subscribe({
      next: (res) => {
        this.entries = (res.log || []).reverse();
        this.summary = res.summary || {};
        this.summaryEntries = Object.entries(this.summary)
          .map(([action, count]) => ({ action, count: count as number }))
          .sort((a, b) => b.count - a.count);
        this.actionTypes = this.summaryEntries.map(e => e.action);
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  actionClass(action: string): string {
    const map: Record<string, string> = {
      restart: 'action-restart',
      rollback: 'action-rollback',
      scale: 'action-scale',
      delete: 'action-delete',
      trigger: 'action-trigger',
    };
    return map[action] || 'action-default';
  }

  actionIcon(action: string): string {
    const map: Record<string, string> = {
      restart: 'pi-refresh',
      rollback: 'pi-undo',
      scale: 'pi-arrows-v',
      delete: 'pi-trash',
      trigger: 'pi-play',
    };
    return map[action] || 'pi-pencil';
  }

  formatTime(ts: string): string {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}
