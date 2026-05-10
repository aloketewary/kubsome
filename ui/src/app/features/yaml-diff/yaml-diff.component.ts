import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-yaml-diff',
  standalone: true,
  imports: [FormsModule, Select, ButtonModule],
  template: `
    <div class="page-header">
      <div>
        <h1>YAML Diff</h1>
        <p class="subtitle">Side-by-side revision comparison</p>
      </div>
    </div>

    <div class="controls">
      <p-select [options]="deployments" [(ngModel)]="selected" placeholder="Select deployment..."
                [filter]="true" [style]="{ width: '280px' }" />
      <button pButton label="Compare" icon="pi pi-arrows-h" class="p-button-sm" (click)="compare()" [disabled]="!selected"></button>
    </div>

    @if (loading) {
      <div class="loading"><div class="spin"></div> Comparing revisions...</div>
    }

    @if (data && data.available) {
      <div class="diff-summary">
        <span class="diff-add">+{{ data.additions }}</span>
        <span class="diff-del">-{{ data.deletions }}</span>
        <span class="diff-total">{{ data.total_changes }} changes</span>
      </div>

      <div class="diff-container">
        @for (line of data.side_by_side; track $index) {
          <div class="diff-row" [class]="'row-' + line.type">
            <span class="line-num">{{ line.line_a || '' }}</span>
            <span class="line-left">{{ line.left }}</span>
            <span class="line-num">{{ line.line_b || '' }}</span>
            <span class="line-right">{{ line.right }}</span>
          </div>
        }
      </div>
    } @else if (data && !data.available) {
      <div class="empty"><i class="pi pi-info-circle"></i> {{ data.reason }}</div>
    } @else if (!loading && !data) {
      <div class="empty"><i class="pi pi-file-edit"></i> Select a deployment to compare revisions</div>
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

    .diff-summary {
      display: flex; align-items: center; gap: 12px; margin-bottom: 12px;
      padding: 8px 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-sm);
      font-size: 12px; font-family: 'JetBrains Mono', monospace;
    }
    .diff-add { color: var(--success); font-weight: 600; }
    .diff-del { color: var(--danger); font-weight: 600; }
    .diff-total { color: var(--text-muted); margin-left: auto; }

    .diff-container {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
      overflow: auto; max-height: calc(100vh - 320px);
      font-family: 'JetBrains Mono', monospace; font-size: 11px; line-height: 1.6;
    }
    .diff-row {
      display: grid; grid-template-columns: 32px 1fr 32px 1fr;
      border-bottom: 1px solid var(--border);
    }
    .diff-row:last-child { border-bottom: none; }
    .row-equal { }
    .row-changed { background: rgba(234,179,8,0.05); }
    .row-added { background: rgba(34,197,94,0.05); }
    .row-removed { background: rgba(239,68,68,0.05); }
    .line-num { text-align: right; padding: 2px 6px; color: var(--text-muted); opacity: 0.5; user-select: none; border-right: 1px solid var(--border); }
    .line-left, .line-right { padding: 2px 8px; white-space: pre-wrap; word-break: break-all; }
    .row-removed .line-left { color: var(--danger); }
    .row-added .line-right { color: var(--success); }
    .row-changed .line-left { color: var(--danger); }
    .row-changed .line-right { color: var(--success); }

    .empty { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 60px; color: var(--text-muted); font-size: 13px; }
    .empty i { font-size: 20px; opacity: 0.4; }
    .loading { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 60px; color: var(--text-muted); }
    .spin { width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class YamlDiffComponent implements OnInit {
  private http = inject(HttpClient);
  deployments: string[] = [];
  selected = '';
  data: any = null;
  loading = false;

  ngOnInit() {
    this.http.get<any>('http://localhost:8000/api/deployments').subscribe(res => {
      this.deployments = (res.deployments || []).map((d: any) => d.name);
    });
  }

  compare() {
    if (!this.selected) return;
    this.loading = true;
    this.data = null;
    this.http.get<any>(`http://localhost:8000/api/yaml-diff/${this.selected}`).subscribe({
      next: (res) => { this.data = res; this.loading = false; },
      error: () => { this.data = { available: false, reason: 'Failed to fetch diff' }; this.loading = false; },
    });
  }
}
