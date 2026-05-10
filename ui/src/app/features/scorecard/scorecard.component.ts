import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { PageInfoComponent } from '../../shared/components/page-info.component';

@Component({
  selector: 'app-scorecard',
  standalone: true,
  imports: [ButtonModule, TagModule, PageInfoComponent],
  template: `
    <div class="page-header">
      <div>
        <h1>Cluster Scorecard</h1>
        <p class="subtitle">Health grade across availability, stability, resources & operations</p>
      </div>
      <button pButton icon="pi pi-refresh" class="p-button-outlined p-button-sm p-button-rounded" (click)="refresh()"></button>
      <app-page-info title="Scorecard" description="Cluster health graded A-F across availability, stability, resources, and operations. Refreshes on demand."
        [tips]="['Grade A-B = healthy, C = fair, D-F = needs attention', 'Click Refresh to re-evaluate', 'Recommendations link to CLI commands']"
        [commands]="['scorecard', 'check', 'security']" />
    </div>

    @if (data) {
      <!-- Overall Grade -->
      <div class="grade-hero" [class]="'grade-' + data.overall_grade">
        <div class="grade-ring">
          <svg viewBox="0 0 36 36">
            <path class="ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            <path class="ring-fill" [attr.stroke-dasharray]="data.overall_score + ', 100'" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
          </svg>
          <span class="grade-letter">{{ data.overall_grade }}</span>
        </div>
        <div class="grade-info">
          <h2>{{ gradeLabel(data.overall_grade) }}</h2>
          <p>{{ data.overall_score }}/100 · {{ data.summary }}</p>
        </div>
      </div>

      <!-- Category Cards -->
      <div class="cat-grid">
        @for (cat of categories; track cat.key) {
          <div class="cat-card" [class]="'cat-' + cat.data.grade">
            <div class="cat-header">
              <span class="cat-grade">{{ cat.data.grade }}</span>
              <span class="cat-name">{{ cat.key }}</span>
              <span class="cat-score">{{ cat.data.score }}/100</span>
            </div>
            <div class="cat-bar">
              <div class="cat-fill" [style.width.%]="cat.data.score"></div>
            </div>
            @if (cat.data.issues.length > 0) {
              <div class="cat-issues">
                @for (issue of cat.data.issues; track issue) {
                  <span class="cat-issue">• {{ issue }}</span>
                }
              </div>
            } @else {
              <span class="cat-ok">✓ No issues</span>
            }
          </div>
        }
      </div>

      <!-- Recommendations -->
      @if (data.recommendations.length > 0) {
        <div class="recs-section">
          <h3>Recommendations</h3>
          @for (rec of data.recommendations; track $index) {
            <div class="rec-card">
              <p-tag [value]="rec.category" severity="warn" [rounded]="true" />
              <span class="rec-issue">{{ rec.issue }}</span>
              <span class="rec-action">→ {{ rec.action }}</span>
            </div>
          }
        </div>
      }
    } @else {
      <div class="loading"><div class="spin"></div> Generating scorecard...</div>
    }
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

    .grade-hero {
      display: flex; align-items: center; gap: 24px;
      padding: 28px 32px; margin-bottom: 20px;
      border-radius: var(--radius); border: 1px solid var(--border);
    }
    .grade-A { background: linear-gradient(135deg, rgba(34,197,94,0.06), transparent); border-color: rgba(34,197,94,0.3); }
    .grade-B { background: linear-gradient(135deg, rgba(34,197,94,0.04), transparent); border-color: rgba(34,197,94,0.2); }
    .grade-C { background: linear-gradient(135deg, rgba(234,179,8,0.06), transparent); border-color: rgba(234,179,8,0.3); }
    .grade-D { background: linear-gradient(135deg, rgba(239,68,68,0.04), transparent); border-color: rgba(239,68,68,0.2); }
    .grade-F { background: linear-gradient(135deg, rgba(239,68,68,0.08), transparent); border-color: rgba(239,68,68,0.3); }

    .grade-ring { position: relative; width: 80px; height: 80px; flex-shrink: 0; }
    .grade-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    .ring-bg { fill: none; stroke: var(--bg-elevated); stroke-width: 3; }
    .ring-fill { fill: none; stroke-width: 3; stroke-linecap: round; }
    .grade-A .ring-fill, .grade-B .ring-fill { stroke: var(--success); }
    .grade-C .ring-fill { stroke: var(--warning); }
    .grade-D .ring-fill, .grade-F .ring-fill { stroke: var(--danger); }
    .grade-letter { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 800; }
    .grade-info h2 { font-size: 20px; font-weight: 700; margin: 0 0 4px; }
    .grade-info p { font-size: 13px; color: var(--text-secondary); margin: 0; }

    .cat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px; }
    .cat-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; }
    .cat-A, .cat-B { border-left: 3px solid var(--success); }
    .cat-C { border-left: 3px solid var(--warning); }
    .cat-D, .cat-F { border-left: 3px solid var(--danger); }
    .cat-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .cat-grade { font-size: 16px; font-weight: 800; min-width: 24px; }
    .cat-name { font-size: 13px; font-weight: 600; text-transform: capitalize; flex: 1; }
    .cat-score { font-size: 11px; color: var(--text-muted); }
    .cat-bar { height: 4px; border-radius: 2px; background: var(--bg-elevated); overflow: hidden; margin-bottom: 8px; }
    .cat-fill { height: 100%; border-radius: 2px; background: var(--success); transition: width 0.5s; }
    .cat-C .cat-fill { background: var(--warning); }
    .cat-D .cat-fill, .cat-F .cat-fill { background: var(--danger); }
    .cat-issues { display: flex; flex-direction: column; gap: 2px; }
    .cat-issue { font-size: 11px; color: var(--text-muted); }
    .cat-ok { font-size: 11px; color: var(--success); }

    .recs-section { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; }
    .recs-section h3 { font-size: 14px; font-weight: 600; margin: 0 0 12px; }
    .rec-card { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 12px; }
    .rec-card:last-child { border-bottom: none; }
    .rec-issue { flex: 1; }
    .rec-action { font-size: 11px; color: var(--accent); font-family: 'JetBrains Mono', monospace; }

    .loading { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 60px; color: var(--text-muted); }
    .spin { width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (max-width: 768px) { .cat-grid { grid-template-columns: 1fr; } }
  `],
})
export class ScorecardComponent implements OnInit {
  private http = inject(HttpClient);
  data: any = null;
  categories: { key: string; data: any }[] = [];

  ngOnInit() { this.refresh(); }

  refresh() {
    this.http.get<any>('http://localhost:8000/api/scorecard').subscribe({
      next: (res) => {
        this.data = res;
        this.categories = Object.entries(res.categories || {}).map(([key, data]) => ({ key, data }));
      },
      error: () => { this.data = { overall_grade: 'F', overall_score: 0, summary: 'Cannot reach cluster', categories: {}, recommendations: [] }; this.categories = []; },
    });
  }

  gradeLabel(grade: string): string {
    const labels: Record<string, string> = { A: 'Excellent', B: 'Good', C: 'Fair', D: 'Poor', F: 'Critical' };
    return labels[grade] || 'Unknown';
  }
}
