import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-cost',
  standalone: true,
  imports: [TagModule, ButtonModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Optimization</h1>
        <p class="subtitle">Resource recommendations and waste detection</p>
      </div>
      <button pButton icon="pi pi-refresh" label="Scan" class="p-button-outlined p-button-sm" (click)="load()"></button>
    </div>

    <!-- Recommendations -->
    <h3 class="section-title">Resource Recommendations</h3>
    <div class="rec-list">
      @for (rec of recommendations; track $index) {
        <div class="rec-card">
          <div class="rec-icon">
            <i class="pi pi-chart-line"></i>
          </div>
          <div class="rec-body">
            <span class="rec-name">{{ rec.name || rec.pod || 'Unknown' }}</span>
            <span class="rec-detail">{{ rec.recommendation || rec.message || rec.detail || '' }}</span>
          </div>
          @if (rec.savings) {
            <p-tag [value]="rec.savings" severity="success" [rounded]="true" />
          }
        </div>
      }
      @if (recommendations.length === 0) {
        <div class="empty-card">No optimization recommendations — resources look well-sized</div>
      }
    </div>

    <!-- Unused Resources -->
    <h3 class="section-title" style="margin-top: 32px;">Unused Resources</h3>
    <div class="rec-list">
      @for (res of unused; track $index) {
        <div class="rec-card unused">
          <div class="rec-icon unused-icon">
            <i class="pi pi-trash"></i>
          </div>
          <div class="rec-body">
            <span class="rec-name">{{ res.name || res }}</span>
            <span class="rec-detail">{{ res.kind || '' }} {{ res.reason || '— can be removed' }}</span>
          </div>
          <p-tag value="unused" severity="warn" [rounded]="true" />
        </div>
      }
      @if (unused.length === 0) {
        <div class="empty-card">No unused resources detected</div>
      }
    </div>
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .section-title { font-size: 14px; font-weight: 600; color: var(--text-secondary); margin-bottom: 12px; }

    .rec-list { display: flex; flex-direction: column; gap: 8px; }
    .rec-card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 18px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      transition: border-color 0.15s;
    }
    .rec-card:hover { border-color: var(--border-hover); }
    .rec-card.unused { border-left: 3px solid var(--warning); }
    .rec-icon {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: var(--accent-subtle);
      color: var(--accent);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .unused-icon { background: var(--warning-subtle); color: var(--warning); }
    .rec-body { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .rec-name { font-size: 13px; font-weight: 500; }
    .rec-detail { font-size: 12px; color: var(--text-secondary); }
    .empty-card {
      padding: 32px;
      text-align: center;
      color: var(--text-muted);
      font-size: 13px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
    }
  `],
})
export class CostComponent implements OnInit {
  private http = inject(HttpClient);
  recommendations: any[] = [];
  unused: any[] = [];

  ngOnInit() { this.load(); }

  load() {
    this.http.get<any>('http://localhost:8000/api/optimize').subscribe(res => {
      this.recommendations = res.recommendations || [];
    });
    this.http.get<any>('http://localhost:8000/api/unused').subscribe(res => {
      this.unused = res.resources || [];
    });
  }
}
