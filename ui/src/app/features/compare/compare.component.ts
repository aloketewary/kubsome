import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';

@Component({
  selector: 'app-compare',
  standalone: true,
  imports: [FormsModule, Select, ButtonModule, TagModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Compare</h1>
        <p class="subtitle">Drift detection between environments</p>
      </div>
    </div>

    <!-- Controls -->
    <div class="compare-bar">
      <div class="ctx-group">
        <span class="ctx-label">A</span>
        <p-select [options]="contexts" [(ngModel)]="ctxA" placeholder="Context A..." [filter]="true"
                  [style]="{ width: '200px' }" (ngModelChange)="loadNamespaces('a')" />
        <p-select [options]="nsA" [(ngModel)]="selectedNsA" placeholder="Namespace..." [filter]="true"
                  [style]="{ width: '160px' }" />
      </div>
      <span class="vs">vs</span>
      <div class="ctx-group">
        <span class="ctx-label">B</span>
        <p-select [options]="contexts" [(ngModel)]="ctxB" placeholder="Context B..." [filter]="true"
                  [style]="{ width: '200px' }" (ngModelChange)="loadNamespaces('b')" />
        <p-select [options]="nsB" [(ngModel)]="selectedNsB" placeholder="Namespace..." [filter]="true"
                  [style]="{ width: '160px' }" />
      </div>
      <button pButton label="Compare" icon="pi pi-arrows-h" class="p-button-sm"
              (click)="compare()" [disabled]="!ctxA || !ctxB || !selectedNsA || !selectedNsB || loading"></button>
    </div>

    @if (loading) {
      <div class="loading-state"><div class="spin"></div> Comparing...</div>
    }

    @if (error) {
      <div class="error-banner"><i class="pi pi-exclamation-triangle"></i> {{ error }}</div>
    }

    @if (result) {
      <!-- Summary -->
      <div class="summary-strip">
        @if (result.in_sync) {
          <div class="summary-pill pill-ok"><span class="pill-dot dot-ok"></span> In Sync</div>
        } @else {
          <div class="summary-pill pill-warn"><span class="pill-dot dot-warn"></span> Drift Detected</div>
        }
        <div class="summary-pill">
          <span class="pill-value">{{ result.diffs?.length || 0 }}</span>
          <span class="pill-label">differences</span>
        </div>
        <div class="summary-pill">
          <span class="pill-value">{{ result.only_a?.length || 0 }}</span>
          <span class="pill-label">only in A</span>
        </div>
        <div class="summary-pill">
          <span class="pill-value">{{ result.only_b?.length || 0 }}</span>
          <span class="pill-label">only in B</span>
        </div>
      </div>

      <!-- Diffs -->
      @if (result.diffs?.length > 0) {
        <div class="section">
          <div class="section-header"><i class="pi pi-arrows-h"></i> Configuration Drift</div>
          <div class="section-body">
            @for (diff of result.diffs; track diff.name) {
              <div class="drift-card">
                <div class="drift-name">{{ diff.name }}</div>
                @for (change of diff.changes; track change.field) {
                  <div class="drift-row">
                    <span class="drift-field">{{ change.field }}</span>
                    <span class="drift-val drift-a">{{ change.a }}</span>
                    <i class="pi pi-arrow-right drift-arrow"></i>
                    <span class="drift-val drift-b">{{ change.b }}</span>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      }

      <!-- Only in A -->
      @if (result.only_a?.length > 0) {
        <div class="section">
          <div class="section-header"><i class="pi pi-minus-circle"></i> Only in {{ ctxA }}</div>
          <div class="section-body">
            @for (name of result.only_a; track name) {
              <div class="only-row"><span class="only-name mono">{{ name }}</span> <p-tag value="missing in B" severity="warn" [rounded]="true" /></div>
            }
          </div>
        </div>
      }

      <!-- Only in B -->
      @if (result.only_b?.length > 0) {
        <div class="section">
          <div class="section-header"><i class="pi pi-plus-circle"></i> Only in {{ ctxB }}</div>
          <div class="section-body">
            @for (name of result.only_b; track name) {
              <div class="only-row"><span class="only-name mono">{{ name }}</span> <p-tag value="missing in A" severity="info" [rounded]="true" /></div>
            }
          </div>
        </div>
      }

      <!-- In Sync -->
      @if (result.in_sync) {
        <div class="sync-state">
          <i class="pi pi-check-circle"></i>
          <span>All deployments are in sync between environments</span>
        </div>
      }
    }
  `,
  styles: [`
    .page-header { margin-bottom: 16px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

    .compare-bar {
      display: flex; align-items: center; gap: 12px; margin-bottom: 16px;
      padding: 14px 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
    }
    .ctx-group { display: flex; align-items: center; gap: 8px; }
    .ctx-label { font-size: 11px; font-weight: 700; color: var(--accent); background: var(--accent-subtle); padding: 2px 8px; border-radius: 4px; }
    .vs { font-size: 12px; color: var(--text-muted); font-weight: 600; }

    .summary-strip {
      display: flex; gap: 8px; margin-bottom: 16px;
      padding: 14px 18px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
    }
    .summary-pill { display: flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px; background: var(--bg-elevated); font-size: 12px; }
    .pill-ok { background: var(--success-subtle); }
    .pill-warn { background: var(--warning-subtle); }
    .pill-dot { width: 6px; height: 6px; border-radius: 50%; }
    .dot-ok { background: var(--success); }
    .dot-warn { background: var(--warning); }
    .pill-value { font-weight: 600; }
    .pill-label { color: var(--text-muted); }

    .section { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 12px; overflow: hidden; }
    .section-header {
      display: flex; align-items: center; gap: 8px; padding: 10px 16px;
      background: var(--bg-elevated); border-bottom: 1px solid var(--border);
      font-size: 12px; font-weight: 600; color: var(--text-secondary);
    }
    .section-header i { color: var(--accent); }
    .section-body { padding: 12px 16px; }

    .drift-card { padding: 10px 0; border-bottom: 1px solid var(--border); }
    .drift-card:last-child { border-bottom: none; }
    .drift-name { font-size: 13px; font-weight: 600; margin-bottom: 6px; }
    .drift-row { display: flex; align-items: center; gap: 8px; padding: 3px 0; font-size: 11px; }
    .drift-field { min-width: 80px; font-weight: 500; color: var(--text-muted); }
    .drift-val { font-family: 'JetBrains Mono', monospace; font-size: 10px; padding: 2px 6px; border-radius: 4px; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .drift-a { background: var(--danger-subtle); color: var(--danger); }
    .drift-b { background: var(--success-subtle); color: var(--success); }
    .drift-arrow { font-size: 10px; color: var(--text-muted); }

    .only-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--border); }
    .only-row:last-child { border-bottom: none; }
    .only-name { font-size: 12px; flex: 1; }
    .mono { font-family: 'JetBrains Mono', monospace; font-size: 11px; }

    .sync-state {
      display: flex; align-items: center; justify-content: center; gap: 10px;
      padding: 40px; color: var(--success); font-size: 14px;
    }
    .sync-state i { font-size: 24px; }

    .loading-state { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 40px; color: var(--text-muted); font-size: 13px; }
    .spin { width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .error-banner { display: flex; align-items: center; gap: 8px; padding: 12px 16px; background: var(--danger-subtle); border-radius: var(--radius); font-size: 12px; color: var(--danger); margin-bottom: 12px; }
  `],
})
export class CompareComponent implements OnInit {
  private http = inject(HttpClient);
  contexts: string[] = [];
  ctxA = '';
  ctxB = '';
  nsA: string[] = [];
  nsB: string[] = [];
  selectedNsA = '';
  selectedNsB = '';
  result: any = null;
  loading = false;
  error = '';

  ngOnInit() {
    this.http.get<any>('/api/contexts').subscribe(res => {
      this.contexts = (res.contexts || []).map((c: any) => c.name);
    });
  }

  loadNamespaces(side: 'a' | 'b') {
    const ctx = side === 'a' ? this.ctxA : this.ctxB;
    if (!ctx) return;
    this.http.get<any>(`/api/namespaces/${ctx}`).subscribe({
      next: (res) => {
        if (side === 'a') { this.nsA = res.namespaces || []; this.selectedNsA = ''; }
        else { this.nsB = res.namespaces || []; this.selectedNsB = ''; }
      },
      error: () => {
        if (side === 'a') this.nsA = [];
        else this.nsB = [];
      },
    });
  }

  compare() {
    this.loading = true;
    this.error = '';
    this.result = null;
    this.http.post<any>('/api/compare', {
      ctx_a: this.ctxA, ctx_b: this.ctxB,
      ns_a: this.selectedNsA, ns_b: this.selectedNsB,
    }).subscribe({
      next: (res) => { this.result = res; this.loading = false; },
      error: (err) => { this.error = err.error?.detail || 'Compare failed'; this.loading = false; },
    });
  }
}
