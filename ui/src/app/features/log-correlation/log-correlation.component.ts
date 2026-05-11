import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { MultiSelect } from 'primeng/multiselect';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-log-correlation',
  standalone: true,
  imports: [FormsModule, ButtonModule, MultiSelect, TooltipModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Log Correlation</h1>
        <p class="subtitle">Merged timeline from multiple pods</p>
      </div>
    </div>

    <!-- Pod Selection -->
    <div class="controls">
      <p-multiSelect [options]="podOptions" [(ngModel)]="selectedPods" placeholder="Select pods..."
                [style]="{ width: '100%', maxWidth: '500px' }" [filter]="true"
                optionLabel="label" optionValue="value" display="chip" />
      <button pButton label="Correlate" icon="pi pi-link" class="p-button-sm" (click)="correlate()" [disabled]="selectedPods.length < 2"></button>
    </div>

    @if (selectedPods.length > 0 && selectedPods.length < 2) {
      <div class="hint">Select at least 2 pods to correlate logs</div>
    }

    @if (loading) {
      <div class="loading"><div class="spin"></div> Merging logs from {{ selectedPods.length }} pods...</div>
    }

    @if (data) {
      <div class="result-header">
        <span class="result-count">{{ data.total }} entries from {{ data.pods.length }} pods</span>
        <button pButton icon="pi pi-copy" class="p-button-sm p-button-text p-button-rounded" pTooltip="Copy all" (click)="copyAll()"></button>
      </div>

      <div class="log-timeline">
        @for (entry of data.entries; track $index) {
          <div class="log-entry" [class]="'level-' + entry.level">
            <span class="entry-time">{{ entry.timestamp?.slice(-12) || '' }}</span>
            <span class="entry-pod" [style.color]="podColor(entry.pod)">{{ entry.pod }}</span>
            <span class="entry-msg">{{ entry.message }}</span>
          </div>
        }
        @if (data.entries.length === 0) {
          <div class="empty-logs">No log entries found</div>
        }
      </div>
    }
  `,
  styles: [`
    .page-header { margin-bottom: 16px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

    .controls {
      display: flex; align-items: center; gap: 10px; margin-bottom: 16px;
      padding: 12px 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-sm);
    }
    .hint { font-size: 12px; color: var(--text-muted); margin-bottom: 12px; }

    .result-header {
      display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;
      padding: 8px 12px; background: var(--bg-elevated); border-radius: var(--radius-sm);
    }
    .result-count { font-size: 11px; color: var(--text-muted); }

    .log-timeline {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
      overflow: auto; max-height: calc(100vh - 320px);
      font-family: 'JetBrains Mono', monospace; font-size: 11px; line-height: 1.7;
    }
    .log-entry { display: flex; gap: 0; padding: 2px 12px; border-bottom: 1px solid var(--border); }
    .log-entry:last-child { border-bottom: none; }
    .log-entry:hover { background: var(--bg-hover); }
    .level-error { background: var(--danger-subtle); }
    .level-warn .entry-msg { color: var(--warning); }
    .entry-time { min-width: 90px; color: var(--text-muted); opacity: 0.6; padding-right: 8px; }
    .entry-pod { min-width: 120px; font-weight: 500; padding-right: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .entry-msg { flex: 1; white-space: pre-wrap; word-break: break-all; }

    .empty-logs { padding: 40px; text-align: center; color: var(--text-muted); }
    .loading { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 60px; color: var(--text-muted); }
    .spin { width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class LogCorrelationComponent implements OnInit {
  private http = inject(HttpClient);
  podOptions: { label: string; value: string }[] = [];
  selectedPods: string[] = [];
  data: any = null;
  loading = false;

  private colors = ['#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ef4444', '#06b6d4', '#f97316', '#ec4899'];

  ngOnInit() {
    this.http.get<any>('/api/pods').subscribe(res => {
      this.podOptions = (res.pods || []).map((p: any) => ({ label: p.name, value: p.name }));
    });
  }

  correlate() {
    if (this.selectedPods.length < 2) return;
    this.loading = true;
    this.data = null;
    this.http.post<any>('/api/correlate-logs', {
      pods: this.selectedPods, tail: 100,
    }).subscribe({
      next: (res) => { this.data = res; this.loading = false; },
      error: () => { this.data = { entries: [], pods: [], total: 0 }; this.loading = false; },
    });
  }

  podColor(pod: string): string {
    const idx = this.data?.pods?.indexOf(
      this.data.pods.find((p: string) => pod === p.split('-').slice(0, -2).join('-') || p.includes(pod))
    ) ?? 0;
    return this.colors[Math.abs(idx) % this.colors.length];
  }

  copyAll() {
    if (!this.data?.entries) return;
    const text = this.data.entries.map((e: any) => `${e.timestamp || ''} [${e.pod}] ${e.message}`).join('\n');
    navigator.clipboard.writeText(text);
  }
}
