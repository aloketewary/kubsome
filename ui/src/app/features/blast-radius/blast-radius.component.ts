import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { SpotlightComponent } from '../../shared/components/spotlight.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';

@Component({
  selector: 'app-blast-radius',
  standalone: true,
  imports: [ButtonModule, TagModule, TooltipModule, FormsModule, UpperCasePipe, SpotlightComponent, PageHeaderComponent, SkeletonComponent],
  template: `
    <app-spotlight id="blast-radius" title="Blast Radius" icon="pi pi-exclamation-circle"
      description="Analyze impact before destructive operations — what breaks if you touch this?"
      [capabilities]="['Service dependency mapping', 'PDB violation check', 'Risk scoring 1-10', 'Actionable recommendations']" [compact]="true" />

    <app-page-header title="Blast Radius Analysis" subtitle="Understand impact before you act">
    </app-page-header>

    <!-- Input -->
    <div class="input-section">
      <input [(ngModel)]="target" placeholder="Deployment name" class="br-input" (keyup.enter)="analyze()" />
      <select [(ngModel)]="action" class="br-select">
        <option value="restart">Restart</option>
        <option value="delete">Delete</option>
        <option value="scale-down">Scale Down</option>
      </select>
      <button pButton icon="pi pi-search" label="Analyze" class="p-button-sm" (click)="analyze()" [loading]="loading" [disabled]="!target"></button>
    </div>

    @if (loading) {
      <app-skeleton variant="card" />
    }

    @if (result?.error) {
      <div class="error-state">
        <i class="pi pi-exclamation-triangle"></i>
        <span>{{ result.error }}</span>
        <button pButton label="Retry" icon="pi pi-refresh" class="p-button-outlined p-button-sm" (click)="analyze()"></button>
      </div>
    }

    @if (result && !result.error) {
      <!-- Risk Score -->
      <div class="risk-banner" [class]="'risk-' + result.risk_level">
        <div class="risk-score">{{ result.risk_score }}/10</div>
        <div class="risk-info">
          <strong>{{ result.risk_level | uppercase }} RISK</strong>
          <span>{{ result.affected_count }} resources affected · {{ result.pod_count }} pods</span>
        </div>
        <div class="risk-verdict">
          @if (result.safe_to_proceed) {
            <p-tag value="Safe to proceed" severity="success" [rounded]="true" />
          } @else {
            <p-tag value="Caution required" severity="danger" [rounded]="true" />
          }
        </div>
      </div>

      <!-- Warnings -->
      @if (result.warnings?.length) {
        <div class="warnings">
          @for (w of result.warnings; track w) {
            <div class="warning-item">{{ w }}</div>
          }
        </div>
      }

      <!-- Affected Resources -->
      <div class="affected-section">
        <h3>Affected Resources</h3>
        @for (a of result.affected; track a.name) {
          <div class="affected-row" [class]="'sev-' + a.severity">
            <span class="aff-type">{{ a.type }}</span>
            <strong class="aff-name">{{ a.name }}</strong>
            <span class="aff-impact">{{ a.impact }}</span>
            <p-tag [value]="a.severity" [severity]="sevTag(a.severity)" [rounded]="true" size="small" />
          </div>
        }
      </div>

      <!-- Recommendation -->
      <div class="recommendation">
        <i class="pi pi-lightbulb"></i>
        <div>
          <strong>Recommendation</strong>
          <p>{{ result.recommendation }}</p>
        </div>
      </div>
    }

    @if (!result && !loading) {
      <div class="empty-state">
        <i class="pi pi-exclamation-circle"></i>
        <p>Enter a deployment name and action to analyze blast radius.</p>
      </div>
    }
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
    .page-header h1 { font-size: 24px; font-weight: 700; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .input-section { display: flex; gap: 8px; align-items: center; margin-bottom: 20px; padding: 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); }
    .br-input { flex: 1; padding: 8px 12px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg-elevated); color: var(--text-primary); font-size: 13px; }
    .br-input:focus { border-color: var(--accent); outline: none; }
    .br-select { padding: 8px 12px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg-elevated); color: var(--text-primary); font-size: 13px; }
    .risk-banner { display: flex; align-items: center; gap: 16px; padding: 20px; border-radius: var(--radius); margin-bottom: 16px; }
    .risk-low { background: rgba(34,197,94,0.06); border: 1px solid rgba(34,197,94,0.3); }
    .risk-medium { background: rgba(234,179,8,0.06); border: 1px solid rgba(234,179,8,0.3); }
    .risk-high { background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.3); }
    .risk-critical { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.5); }
    .risk-score { font-size: 32px; font-weight: 800; min-width: 60px; }
    .risk-low .risk-score { color: var(--success); }
    .risk-medium .risk-score { color: var(--warning); }
    .risk-high .risk-score, .risk-critical .risk-score { color: var(--danger); }
    .risk-info { flex: 1; }
    .risk-info strong { display: block; font-size: 14px; }
    .risk-info span { font-size: 12px; color: var(--text-muted); }
    .warnings { margin-bottom: 16px; }
    .warning-item { padding: 8px 12px; background: rgba(234,179,8,0.08); border-left: 3px solid var(--warning); border-radius: var(--radius); margin-bottom: 6px; font-size: 13px; }
    .affected-section { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; margin-bottom: 16px; }
    .affected-section h3 { font-size: 14px; margin: 0 0 12px; }
    .affected-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
    .affected-row:last-child { border-bottom: none; }
    .aff-type { font-size: 11px; color: var(--text-muted); min-width: 80px; }
    .aff-name { min-width: 120px; }
    .aff-impact { flex: 1; font-size: 12px; color: var(--text-muted); }
    .recommendation { display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; background: var(--bg-card); border: 1px solid var(--border); border-left: 3px solid var(--accent); border-radius: var(--radius); font-size: 13px; }
    .recommendation i { color: var(--accent); font-size: 16px; margin-top: 2px; }
    .recommendation strong { display: block; font-size: 11px; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.04em; margin-bottom: 4px; }
    .recommendation p { margin: 0; line-height: 1.4; }
    .error-state {
      display: flex; flex-direction: column; align-items: center; gap: 12px;
      padding: 48px; color: var(--text-muted); font-size: 13px;
      background: var(--bg-card); border: 1px solid var(--danger); border-radius: var(--radius);
    }
    .error-state i { font-size: 24px; color: var(--danger); }
    .empty-state { text-align: center; padding: 60px; color: var(--text-muted); }
    .empty-state i { font-size: 48px; opacity: 0.3; margin-bottom: 16px; }
    @media (max-width: 768px) {
      .input-section { flex-wrap: wrap; }
      .br-input { width: 100%; }
      .risk-banner { flex-wrap: wrap; }
      .affected-row { flex-wrap: wrap; gap: 6px; }
      .aff-type { min-width: auto; }
      .aff-name { min-width: auto; }
    }
    .risk-banner { animation: fadeIn 0.3s ease; }
    .affected-row { transition: background 0.1s; }
    .affected-row:hover { background: var(--bg-elevated); }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  `],
})
export class BlastRadiusComponent {
  private http = inject(HttpClient);
  target = '';
  action = 'restart';
  result: any = null;
  loading = false;

  analyze() {
    if (!this.target) return;
    this.loading = true;
    this.result = null;
    this.http.get<any>(`/api/analytics/blast-radius/${this.target}?action=${this.action}`).subscribe({
      next: (res) => { this.result = res; this.loading = false; },
      error: (err) => { this.result = { error: err.error?.detail || 'Analysis failed. Check deployment name.' }; this.loading = false; },
    });
  }

  sevTag(sev: string): "success" | "warn" | "danger" | "info" | "secondary" | "contrast" | undefined {
    if (sev === 'critical') return 'danger';
    if (sev === 'high') return 'danger';
    if (sev === 'medium') return 'warn';
    if (sev === 'low') return 'success';
    return 'info';
  }
}
