import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-doctor',
  standalone: true,
  imports: [ButtonModule],
  template: `
    <div class="page-header">
      <div>
        <h1>System Health</h1>
        <p class="subtitle">Pre-flight diagnostics and connectivity checks</p>
      </div>
      <button pButton icon="pi pi-refresh" label="Re-check" class="p-button-outlined p-button-sm" (click)="load()" [loading]="loading"></button>
    </div>

    @if (checks.length > 0) {
      <div class="checks-list">
        @for (check of checks; track check.name) {
          <div class="check-card" [class]="'check-' + check.status">
            <div class="check-icon">
              @if (check.status === 'ok') { <i class="pi pi-check-circle"></i> }
              @else if (check.status === 'warn') { <i class="pi pi-exclamation-triangle"></i> }
              @else { <i class="pi pi-times-circle"></i> }
            </div>
            <div class="check-body">
              <span class="check-name">{{ check.name }}</span>
              <span class="check-detail">{{ check.detail }}</span>
            </div>
            <div class="check-badge" [class]="'badge-' + check.status">
              {{ check.status === 'ok' ? 'Pass' : check.status === 'warn' ? 'Warning' : 'Fail' }}
            </div>
          </div>
        }
      </div>

      <div class="summary-bar" [class.summary-ok]="allOk" [class.summary-warn]="!allOk">
        @if (allOk) {
          <i class="pi pi-check-circle"></i> All checks passed — system is ready
        } @else {
          <i class="pi pi-info-circle"></i> Some checks need attention
        }
      </div>
    }

    @if (checks.length === 0 && !loading) {
      <div class="loading-state"><div class="spin"></div> Running diagnostics...</div>
    }
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

    .checks-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
    .check-card {
      display: flex; align-items: center; gap: 14px;
      padding: 16px 20px; background: var(--bg-card);
      border: 1px solid var(--border); border-radius: var(--radius);
      transition: all 0.2s;
    }
    .check-card:hover { border-color: var(--border-hover); }
    .check-ok { border-left: 3px solid var(--success); }
    .check-warn { border-left: 3px solid var(--warning); }
    .check-fail { border-left: 3px solid var(--danger); }

    .check-icon { font-size: 18px; flex-shrink: 0; }
    .check-ok .check-icon { color: var(--success); }
    .check-warn .check-icon { color: var(--warning); }
    .check-fail .check-icon { color: var(--danger); }

    .check-body { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .check-name { font-size: 14px; font-weight: 600; }
    .check-detail { font-size: 12px; color: var(--text-secondary); font-family: 'JetBrains Mono', monospace; }

    .check-badge {
      font-size: 10px; font-weight: 600; padding: 4px 10px; border-radius: 6px;
      text-transform: uppercase; letter-spacing: 0.04em;
    }
    .badge-ok { background: var(--success-subtle); color: var(--success); }
    .badge-warn { background: var(--warning-subtle); color: var(--warning); }
    .badge-fail { background: var(--danger-subtle); color: var(--danger); }

    .summary-bar {
      display: flex; align-items: center; gap: 8px;
      padding: 14px 20px; border-radius: var(--radius);
      font-size: 13px; font-weight: 500;
    }
    .summary-ok { background: var(--success-subtle); color: var(--success); border: 1px solid var(--success); }
    .summary-warn { background: var(--warning-subtle); color: var(--warning); border: 1px solid var(--warning); }
    .summary-bar i { font-size: 16px; }

    .loading-state { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 60px; color: var(--text-muted); }
    .spin { width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class DoctorComponent implements OnInit {
  private http = inject(HttpClient);
  checks: any[] = [];
  loading = false;
  allOk = true;

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.http.get<any>('/api/doctor').subscribe({
      next: (res) => {
        this.checks = res.checks || [];
        this.allOk = this.checks.every(c => c.status === 'ok');
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }
}
