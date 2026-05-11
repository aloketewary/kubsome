import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-cost',
  standalone: true,
  imports: [TagModule, ButtonModule, TooltipModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Optimization</h1>
        <p class="subtitle">Resource efficiency and waste detection</p>
      </div>
      <button pButton icon="pi pi-refresh" label="Scan" class="p-button-outlined p-button-sm" (click)="load()"></button>
    </div>

    <!-- Score Hero -->
    <div class="score-hero">
      <div class="score-ring">
        <svg viewBox="0 0 36 36">
          <path class="ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
          <path class="ring-fill" [class]="scoreColor" [attr.stroke-dasharray]="score + ', 100'" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
        </svg>
        <div class="score-inner">
          <span class="score-grade">{{ grade }}</span>
        </div>
      </div>
      <div class="score-info">
        <h2 class="score-title">{{ scoreTitle }}</h2>
        <p class="score-desc">{{ scoreDesc }}</p>
      </div>
      <div class="score-stats">
        <div class="stat-box">
          <span class="stat-val">{{ recommendations.length }}</span>
          <span class="stat-label">Recommendations</span>
        </div>
        <div class="stat-box">
          <span class="stat-val warn-text">{{ unused.length }}</span>
          <span class="stat-label">Unused Resources</span>
        </div>
        <div class="stat-box">
          <span class="stat-val">{{ totalIssues }}</span>
          <span class="stat-label">Total Issues</span>
        </div>
      </div>
    </div>

    <!-- Recommendations -->
    @if (recommendations.length > 0) {
      <div class="section">
        <div class="section-header">
          <h3><i class="pi pi-chart-line"></i> Recommendations</h3>
          <span class="section-count">{{ recommendations.length }}</span>
        </div>
        <div class="card-list">
          @for (rec of recommendations; track $index) {
            <div class="opt-card">
              <div class="opt-left">
                <div class="opt-icon" [class]="impactClass($index)">
                  <i class="pi" [class]="impactIcon($index)"></i>
                </div>
                <div class="impact-bar">
                  <div class="impact-fill" [class]="impactClass($index)" [style.height.%]="impactPct($index)"></div>
                </div>
              </div>
              <div class="opt-body">
                <div class="opt-top">
                  <span class="opt-name">{{ rec.name || rec.pod || 'Resource' }}</span>
                  <p-tag [value]="impactLabel($index)" [severity]="impactSeverity($index)" [rounded]="true" />
                </div>
                <p class="opt-detail">{{ rec.recommendation || rec.message || rec.detail || 'Consider right-sizing this resource' }}</p>
                @if (rec.current && rec.suggested) {
                  <div class="opt-comparison">
                    <span class="comp-current">Current: {{ rec.current }}</span>
                    <i class="pi pi-arrow-right"></i>
                    <span class="comp-suggested">Suggested: {{ rec.suggested }}</span>
                  </div>
                }
              </div>
              @if (rec.savings) {
                <div class="opt-savings">
                  <span class="savings-val">{{ rec.savings }}</span>
                  <span class="savings-label">savings</span>
                </div>
              }
            </div>
          }
        </div>
      </div>
    }

    <!-- Unused Resources -->
    @if (unused.length > 0) {
      <div class="section">
        <div class="section-header">
          <h3><i class="pi pi-trash"></i> Unused Resources</h3>
          <span class="section-count warn-bg">{{ unused.length }}</span>
        </div>
        <div class="card-list">
          @for (res of unused; track $index) {
            <div class="opt-card unused-card">
              <div class="opt-left">
                <div class="opt-icon unused-icon">
                  <i class="pi" [class]="unusedIcon(res)"></i>
                </div>
              </div>
              <div class="opt-body">
                <div class="opt-top">
                  <code class="opt-name mono">{{ res.name || res }}</code>
                  @if (res.kind) {
                    <span class="opt-kind">{{ res.kind }}</span>
                  }
                </div>
                <p class="opt-detail">{{ res.reason || 'No traffic or references detected — safe to remove' }}</p>
              </div>
              <button pButton icon="pi pi-trash" class="p-button-sm p-button-text p-button-danger" pTooltip="Remove"></button>
            </div>
          }
        </div>
      </div>
    }

    <!-- All Good State -->
    @if (recommendations.length === 0 && unused.length === 0 && loaded) {
      <div class="all-good">
        <div class="all-good-icon">✓</div>
        <h3>Cluster is well-optimized</h3>
        <p>No resource waste or sizing issues detected</p>
      </div>
    }
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

    /* Score Hero */
    .score-hero {
      display: flex; align-items: center; gap: 24px;
      padding: 24px; margin-bottom: 24px;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
    }
    .score-ring { position: relative; width: 80px; height: 80px; flex-shrink: 0; }
    .score-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    .ring-bg { fill: none; stroke: var(--bg-elevated); stroke-width: 3; }
    .ring-fill { fill: none; stroke-width: 3; stroke-linecap: round; transition: stroke-dasharray 0.6s; }
    .ring-fill.color-great { stroke: var(--success); }
    .ring-fill.color-good { stroke: var(--accent); }
    .ring-fill.color-fair { stroke: var(--warning); }
    .ring-fill.color-poor { stroke: var(--danger); }
    .score-inner {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    }
    .score-grade { font-size: 24px; font-weight: 800; }
    .score-info { flex: 1; }
    .score-title { font-size: 18px; font-weight: 700; margin: 0 0 4px; }
    .score-desc { font-size: 13px; color: var(--text-secondary); margin: 0; }
    .score-stats { display: flex; gap: 16px; }
    .stat-box { text-align: center; padding: 8px 16px; background: var(--bg-elevated); border-radius: 8px; }
    .stat-val { display: block; font-size: 20px; font-weight: 700; }
    .warn-text { color: var(--warning); }
    .stat-label { display: block; font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-top: 2px; }

    /* Sections */
    .section { margin-bottom: 28px; }
    .section-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .section-header h3 { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px; margin: 0; }
    .section-header h3 i { font-size: 14px; color: var(--text-muted); }
    .section-count {
      font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px;
      background: var(--bg-elevated); color: var(--text-muted);
    }
    .warn-bg { background: var(--warning-subtle); color: var(--warning); }

    /* Cards */
    .card-list { display: flex; flex-direction: column; gap: 6px; }
    .opt-card {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 14px 16px; background: var(--bg-card);
      border: 1px solid var(--border); border-radius: var(--radius);
      transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
    }
    .opt-card:hover { border-color: var(--border-hover); transform: translateY(-2px); box-shadow: 0 8px 24px -8px rgba(0,0,0,0.2); }
    .unused-card { border-left: 3px solid var(--warning); }

    .opt-left { display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .opt-icon {
      width: 32px; height: 32px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center; font-size: 14px;
    }
    .opt-icon.impact-high { background: var(--danger-subtle); color: var(--danger); }
    .opt-icon.impact-med { background: var(--warning-subtle); color: var(--warning); }
    .opt-icon.impact-low { background: var(--accent-subtle); color: var(--accent); }
    .opt-icon.unused-icon { background: var(--warning-subtle); color: var(--warning); }
    .impact-bar { width: 4px; height: 20px; border-radius: 2px; background: var(--bg-elevated); overflow: hidden; }
    .impact-fill { width: 100%; border-radius: 2px; transition: height 0.3s; }
    .impact-fill.impact-high { background: var(--danger); }
    .impact-fill.impact-med { background: var(--warning); }
    .impact-fill.impact-low { background: var(--accent); }

    .opt-body { flex: 1; min-width: 0; }
    .opt-top { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .opt-name { font-size: 13px; font-weight: 600; }
    .opt-kind { font-size: 10px; color: var(--text-muted); background: var(--bg-elevated); padding: 1px 6px; border-radius: 3px; text-transform: uppercase; }
    .opt-detail { font-size: 12px; color: var(--text-secondary); margin: 0; line-height: 1.4; }
    .opt-comparison {
      display: flex; align-items: center; gap: 8px; margin-top: 6px;
      font-size: 11px; font-family: 'JetBrains Mono', monospace;
    }
    .comp-current { color: var(--text-muted); }
    .comp-suggested { color: var(--success); font-weight: 500; }
    .opt-comparison i { font-size: 10px; color: var(--text-muted); }

    .opt-savings {
      text-align: center; padding: 6px 12px; background: var(--success-subtle);
      border-radius: 8px; flex-shrink: 0;
    }
    .savings-val { display: block; font-size: 14px; font-weight: 700; color: var(--success); }
    .savings-label { display: block; font-size: 9px; color: var(--success); text-transform: uppercase; }

    /* All Good */
    .all-good {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      padding: 56px; color: var(--text-muted);
    }
    .all-good-icon {
      width: 56px; height: 56px; border-radius: 50%;
      background: var(--success-subtle); color: var(--success);
      display: flex; align-items: center; justify-content: center;
      font-size: 24px; font-weight: 700;
    }
    .all-good h3 { font-size: 16px; font-weight: 600; color: var(--text); margin: 0; }
    .all-good p { font-size: 13px; margin: 0; }
  `],
})
export class CostComponent implements OnInit {
  private http = inject(HttpClient);
  recommendations: any[] = [];
  unused: any[] = [];
  loaded = false;

  get totalIssues() { return this.recommendations.length + this.unused.length; }
  get score() {
    if (this.totalIssues === 0) return 95;
    if (this.totalIssues <= 2) return 80;
    if (this.totalIssues <= 5) return 60;
    return 40;
  }
  get grade() {
    if (this.score >= 90) return 'A';
    if (this.score >= 75) return 'B';
    if (this.score >= 55) return 'C';
    return 'D';
  }
  get scoreColor() {
    if (this.score >= 90) return 'color-great';
    if (this.score >= 75) return 'color-good';
    if (this.score >= 55) return 'color-fair';
    return 'color-poor';
  }
  get scoreTitle() {
    if (this.score >= 90) return 'Excellent Efficiency';
    if (this.score >= 75) return 'Good Efficiency';
    if (this.score >= 55) return 'Room for Improvement';
    return 'Needs Attention';
  }
  get scoreDesc() {
    if (this.totalIssues === 0) return 'No resource waste detected. Cluster is well-optimized.';
    return `Found ${this.totalIssues} optimization opportunities across your resources.`;
  }

  impactClass(i: number): string { return i < 2 ? 'impact-high' : i < 5 ? 'impact-med' : 'impact-low'; }
  impactIcon(i: number): string { return i < 2 ? 'pi-arrow-up' : i < 5 ? 'pi-minus' : 'pi-arrow-down'; }
  impactPct(i: number): number { return i < 2 ? 100 : i < 5 ? 60 : 30; }
  impactLabel(i: number): string { return i < 2 ? 'High Impact' : i < 5 ? 'Medium' : 'Low'; }
  impactSeverity(i: number): 'danger' | 'warn' | 'info' { return i < 2 ? 'danger' : i < 5 ? 'warn' : 'info'; }

  unusedIcon(res: any): string {
    const kind = (res.kind || '').toLowerCase();
    if (kind.includes('secret')) return 'pi-lock';
    if (kind.includes('config')) return 'pi-file';
    if (kind.includes('service')) return 'pi-globe';
    if (kind.includes('pvc') || kind.includes('volume')) return 'pi-database';
    return 'pi-box';
  }

  ngOnInit() { this.load(); }

  load() {
    this.loaded = false;
    this.http.get<any>('/api/optimize').subscribe(res => {
      this.recommendations = res.recommendations || [];
      this.loaded = true;
    });
    this.http.get<any>('/api/unused').subscribe(res => {
      this.unused = res.resources || [];
    });
  }
}
