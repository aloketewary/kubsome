import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';

@Component({
  selector: 'app-policy',
  standalone: true,
  imports: [ButtonModule, TagModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Policy Check</h1>
        <p class="subtitle">Cluster guardrails and compliance · {{ lastChecked }}</p>
      </div>
      <button pButton icon="pi pi-refresh" label="Scan" class="p-button-outlined p-button-sm" (click)="load()" [loading]="loading"></button>
    </div>

    <!-- Score Banner -->
    @if (data) {
      <div class="score-banner" [class.score-pass]="data.failed === 0" [class.score-fail]="data.failed > 0">
        <div class="score-icon">
          @if (data.failed === 0) { <i class="pi pi-check-circle"></i> }
          @else { <i class="pi pi-exclamation-triangle"></i> }
        </div>
        <div class="score-info">
          <h2>{{ data.failed === 0 ? 'All Policies Pass' : data.failed + ' Violation(s)' }}</h2>
          <p>{{ data.passed }}/{{ data.total }} policies passing</p>
        </div>
        <div class="score-stats">
          <div class="ss-item"><span class="ss-val pass-text">{{ data.passed }}</span><span class="ss-label">Passed</span></div>
          <div class="ss-item"><span class="ss-val fail-text">{{ data.failed }}</span><span class="ss-label">Failed</span></div>
          <div class="ss-item"><span class="ss-val">{{ data.total }}</span><span class="ss-label">Total</span></div>
        </div>
      </div>

      <!-- Policies List -->
      <div class="policies-section">
        <h3>Policies</h3>
        <div class="policy-list">
          @for (p of data.policies; track p.name) {
            <div class="policy-card" [class.policy-violated]="isViolated(p.name)">
              <div class="pc-left">
                <div class="pc-icon" [class.pc-pass]="!isViolated(p.name)" [class.pc-fail]="isViolated(p.name)">
                  <i class="pi" [class.pi-check]="!isViolated(p.name)" [class.pi-times]="isViolated(p.name)"></i>
                </div>
              </div>
              <div class="pc-body">
                <div class="pc-top">
                  <span class="pc-name">{{ p.name }}</span>
                  <p-tag [value]="p.severity" [severity]="p.severity === 'high' ? 'danger' : p.severity === 'medium' ? 'warn' : 'info'" [rounded]="true" />
                </div>
                <p class="pc-desc">{{ p.description }}</p>
                <span class="pc-rule">Rule: {{ p.rule }}</span>
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Violations Detail -->
      @if (data.violations.length > 0) {
        <div class="violations-section">
          <h3>Violations</h3>
          <div class="violation-list">
            @for (v of data.violations; track $index) {
              <div class="violation-card">
                <div class="vc-icon"><i class="pi pi-times-circle"></i></div>
                <div class="vc-body">
                  <div class="vc-top">
                    <span class="vc-policy">{{ v.policy }}</span>
                    <code class="vc-resource">{{ v.resource }}</code>
                    <p-tag [value]="v.severity" [severity]="v.severity === 'high' ? 'danger' : 'warn'" [rounded]="true" />
                  </div>
                  <p class="vc-detail">{{ v.detail }}</p>
                </div>
              </div>
            }
          </div>
        </div>
      }
    }

    @if (!data && !loading) {
      <div class="empty-state">
        <div class="empty-icon"><i class="pi pi-shield"></i></div>
        <h3>No policies configured</h3>
        <p>Create <code>.kubsome/policies.yaml</code> in your project to define guardrails.</p>
      </div>
    }
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

    .score-banner {
      display: flex; align-items: center; gap: 20px;
      padding: 24px; margin-bottom: 24px;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
    }
    .score-banner.score-pass { border-color: var(--success); }
    .score-banner.score-fail { border-color: var(--danger); }
    .score-icon { font-size: 32px; }
    .score-pass .score-icon { color: var(--success); }
    .score-fail .score-icon { color: var(--danger); }
    .score-info { flex: 1; }
    .score-info h2 { font-size: 18px; font-weight: 700; margin: 0 0 4px; }
    .score-info p { font-size: 13px; color: var(--text-secondary); margin: 0; }
    .score-stats { display: flex; gap: 16px; }
    .ss-item { text-align: center; padding: 8px 16px; background: var(--bg-elevated); border-radius: 8px; }
    .ss-val { display: block; font-size: 20px; font-weight: 700; font-family: 'JetBrains Mono', monospace; }
    .pass-text { color: var(--success); }
    .fail-text { color: var(--danger); }
    .ss-label { display: block; font-size: 10px; color: var(--text-muted); text-transform: uppercase; margin-top: 2px; }

    .policies-section, .violations-section { margin-bottom: 24px; }
    .policies-section h3, .violations-section h3 { font-size: 14px; font-weight: 600; margin: 0 0 12px; }

    .policy-list, .violation-list { display: flex; flex-direction: column; gap: 6px; }
    .policy-card {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 14px 16px; background: var(--bg-card);
      border: 1px solid var(--border); border-radius: 8px;
      transition: all 0.2s ease;
    }
    .policy-card:hover { transform: translateY(-1px); box-shadow: 0 4px 16px -4px rgba(0,0,0,0.12); border-color: var(--border-hover); }
    .policy-violated { border-left: 3px solid var(--danger); }
    .pc-icon {
      width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center; font-size: 12px;
    }
    .pc-pass { background: var(--success-subtle); color: var(--success); }
    .pc-fail { background: var(--danger-subtle); color: var(--danger); }
    .pc-body { flex: 1; }
    .pc-top { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .pc-name { font-size: 13px; font-weight: 600; }
    .pc-desc { font-size: 12px; color: var(--text-secondary); margin: 0 0 4px; }
    .pc-rule { font-size: 10px; color: var(--text-muted); font-family: 'JetBrains Mono', monospace; }

    .violation-card {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 12px 16px; background: var(--bg-card);
      border: 1px solid var(--border); border-radius: 8px;
      border-left: 3px solid var(--danger);
    }
    .vc-icon { color: var(--danger); font-size: 14px; margin-top: 2px; }
    .vc-body { flex: 1; }
    .vc-top { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap; }
    .vc-policy { font-size: 12px; font-weight: 600; }
    .vc-resource { font-size: 11px; font-family: 'JetBrains Mono', monospace; background: var(--bg-elevated); padding: 2px 6px; border-radius: 4px; }
    .vc-detail { font-size: 12px; color: var(--text-secondary); margin: 0; }

    .empty-state {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      padding: 60px; color: var(--text-muted);
    }
    .empty-icon {
      width: 56px; height: 56px; border-radius: 50%;
      background: var(--bg-elevated); display: flex; align-items: center; justify-content: center; font-size: 24px;
    }
    .empty-state h3 { font-size: 16px; font-weight: 600; color: var(--text); margin: 0; }
    .empty-state p { font-size: 13px; margin: 0; }
    .empty-state code { font-family: 'JetBrains Mono', monospace; font-size: 12px; background: var(--bg-elevated); padding: 2px 6px; border-radius: 4px; }
    @media (max-width: 768px) {
      .page-header { flex-direction: column; gap: 12px; }
      .score-banner { flex-direction: column; gap: 12px; }
      .score-stats { flex-wrap: wrap; }
    }
  `],
})
export class PolicyComponent implements OnInit {
  private http = inject(HttpClient);
  data: any = null;
  loading = false;
  lastChecked = '';

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.http.get<any>('/api/policy-check').subscribe({
      next: (res) => {
        this.data = res;
        this.loading = false;
        this.lastChecked = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      },
      error: () => { this.loading = false; },
    });
  }

  isViolated(policyName: string): boolean {
    return (this.data?.violations || []).some((v: any) => v.policy === policyName);
  }
}
