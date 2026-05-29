import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { PageInfoComponent } from '../../shared/components/page-info.component';
import { SpotlightComponent } from '../../shared/components/spotlight.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { TrendChartComponent } from '../../shared/components/trend-chart.component';

@Component({
  selector: 'app-scorecard',
  standalone: true,
  imports: [ButtonModule, TagModule, PageInfoComponent, SpotlightComponent, TrendChartComponent, SkeletonComponent, PageHeaderComponent],
  templateUrl: './scorecard.html',
  styleUrl: './scorecard.scss',
})
export class ScorecardComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private router = inject(Router);
  data: any = null;
  categories: { key: string; data: any }[] = [];
  loading = false;
  autoRefresh = true;
  lastUpdated = '';
  private refreshTimer: any;

  ngOnInit() {
    this.refresh();
    this.startAutoRefresh();
  }

  ngOnDestroy() { clearInterval(this.refreshTimer); }

  toggleAutoRefresh() {
    this.autoRefresh = !this.autoRefresh;
    if (this.autoRefresh) this.startAutoRefresh();
    else clearInterval(this.refreshTimer);
  }

  private startAutoRefresh() {
    clearInterval(this.refreshTimer);
    this.refreshTimer = setInterval(() => this.refresh(), 60000);
  }

  refresh() {
    this.loading = true;
    this.http.get<any>('/api/scorecard').subscribe({
      next: (res) => {
        this.data = res;
        this.categories = Object.entries(res.categories || {})
          .map(([key, data]) => ({ key, data }))
          .sort((a, b) => (a.data as any).score - (b.data as any).score);
        this.loading = false;
        this.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      },
      error: () => { this.data = { overall_grade: 'F', overall_score: 0, summary: 'Cannot reach cluster', categories: {}, recommendations: [] }; this.categories = []; this.loading = false; },
    });
  }

  gradeLabel(grade: string): string {
    const labels: Record<string, string> = { A: 'Excellent', B: 'Good', C: 'Fair', D: 'Poor', F: 'Critical' };
    return labels[grade] || 'Unknown';
  }

  runWithAi(action: string) {
    this.router.navigate(['/ai'], { queryParams: { q: action } });
  }
}
