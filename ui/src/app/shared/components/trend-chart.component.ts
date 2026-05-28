import { Component, Input, OnInit, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ChartModule } from 'primeng/chart';

@Component({
  selector: 'app-trend-chart',
  standalone: true,
  imports: [ChartModule],
  template: `
    @if (chartData) {
      <div class="trend-chart-container">
        @if (title) { <h4 class="trend-title">{{ title }}</h4> }
        <p-chart [type]="chartType" [data]="chartData" [options]="chartOptions" [height]="height" />
      </div>
    }
  `,
  styles: [`
    .trend-chart-container {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px;
      margin-bottom: 16px;
    }
    .trend-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      margin: 0 0 10px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
  `],
})
export class TrendChartComponent implements OnInit {
  private http = inject(HttpClient);

  @Input() endpoint = '';
  @Input() title = '';
  @Input() chartType: 'line' | 'bar' | 'doughnut' = 'line';
  @Input() height = '160px';
  @Input() datasets: DatasetConfig[] = [];
  @Input() labelField = 'ts';
  @Input() labelSlice: [number, number] = [11, 16]; // HH:MM from timestamp

  chartData: any = null;
  chartOptions: any = {
    plugins: {
      legend: { labels: { color: '#aaa', font: { size: 10 } } },
    },
    scales: {
      x: { ticks: { color: '#666', font: { size: 9 }, maxTicksLimit: 12 } },
      y: { ticks: { color: '#666', font: { size: 10 } } },
    },
    elements: { point: { radius: 0 }, line: { tension: 0.3, borderWidth: 1.5 } },
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' as const },
  };

  ngOnInit() {
    if (!this.endpoint) return;
    this.http.get<any>(this.endpoint).subscribe({
      next: (res) => {
        const series = res.series || res.data || res;
        if (!Array.isArray(series) || series.length < 1) return;
        this.buildChart(series);
      },
    });
  }

  private buildChart(series: any[]) {
    const labels = series.map(s => {
      const val = s[this.labelField] || '';
      return val.substring(this.labelSlice[0], this.labelSlice[1]);
    });

    const isBar = this.chartType === 'bar';

    const builtDatasets = this.datasets.length
      ? this.datasets.map(ds => ({
          label: ds.label,
          data: series.map(s => s[ds.field] || 0),
          borderColor: ds.color,
          backgroundColor: isBar ? ds.color : (ds.fill !== false ? ds.color + '15' : 'transparent'),
          fill: isBar ? false : (ds.fill ?? true),
          borderRadius: isBar ? 3 : 0,
        }))
      : [{
          label: 'Value',
          data: series.map(s => s.value || s.count || 0),
          borderColor: '#22d3ee',
          backgroundColor: isBar ? '#22d3ee' : 'rgba(34,211,238,0.1)',
          fill: !isBar,
          borderRadius: isBar ? 3 : 0,
        }];

    this.chartData = { labels, datasets: builtDatasets };

    // Adjust options for bar charts
    if (this.chartType === 'bar') {
      this.chartOptions = {
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#666', font: { size: 9 }, maxTicksLimit: 12 } },
          y: { beginAtZero: true, ticks: { color: '#666', font: { size: 10 } } },
        },
        maintainAspectRatio: false,
        responsive: true,
      };
    }
  }
}

export interface DatasetConfig {
  label: string;
  field: string;
  color: string;
  fill?: boolean;
}
