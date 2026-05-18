import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { UsageStats } from '../../core/models';
import { SpotlightComponent } from '../../shared/components/spotlight.component';

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [CommonModule, SpotlightComponent],
  template: `
    <app-spotlight id="stats" title="Usage Analytics" icon="pi pi-chart-bar"
      description="Track command frequency and identify gaps in AI intent coverage."
      [capabilities]="['Command frequency tracking', 'NLP miss analysis', 'Total commands executed', 'Days tracked']" />

    @if (stats) {
      <div class="stats-grid">
        <div class="stat-main-card glass stagger-1">
          <div class="stat-header">
            <i class="pi pi-bolt"></i>
            <span>Total Commands</span>
          </div>
          <div class="stat-value">{{ stats.total_commands }}</div>
          <div class="stat-footer">Across {{ stats.days_tracked }} days</div>
        </div>

        <div class="stat-main-card glass stagger-2">
          <div class="stat-header">
            <i class="pi pi-question-circle"></i>
            <span>Unresolved Queries</span>
          </div>
          <div class="stat-value">{{ stats.unresolved_count }}</div>
          <div class="stat-footer">NLP patterns not matched</div>
        </div>

        <div class="stat-main-card glass stagger-3">
          <div class="stat-header">
            <i class="pi pi-sparkles"></i>
            <span>Intelligence Coverage</span>
          </div>
          <div class="stat-value">{{ coveragePct }}%</div>
          <div class="stat-footer">
            <div class="mini-bar-wrap">
              <div class="mini-bar" [style.width.%]="coveragePct"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="details-row">
        <div class="detail-card glass stagger-4">
          <div class="detail-header">
            <h3>Top Commands</h3>
          </div>
          <div class="detail-body">
            @for (cmd of stats.top_commands; track cmd[0]) {
              <div class="freq-row">
                <span class="freq-label">{{ cmd[0] }}</span>
                <div class="freq-bar-wrap">
                  <div class="freq-bar" [style.width.%]="(cmd[1] / maxCmdCount) * 100"></div>
                </div>
                <span class="freq-val">{{ cmd[1] }}</span>
              </div>
            }
            @if (stats.top_commands.length === 0) {
              <div class="empty-hint">No commands recorded yet</div>
            }
          </div>
        </div>

        <div class="detail-card glass stagger-5">
          <div class="detail-header">
            <h3>Common Unresolved Queries</h3>
          </div>
          <div class="detail-body">
            @for (un of stats.top_unresolved; track un[0]) {
              <div class="freq-row">
                <span class="freq-label unresolved">"{{ un[0] }}..."</span>
                <div class="freq-bar-wrap">
                  <div class="freq-bar miss" [style.width.%]="(un[1] / maxUnresolvedCount) * 100"></div>
                </div>
                <span class="freq-val">{{ un[1] }}</span>
              </div>
            }
            @if (stats.top_unresolved.length === 0) {
              <div class="empty-hint">All queries resolved! Well done.</div>
            }
          </div>
        </div>
      </div>
    } @else {
      <div class="loading-state">
        <i class="pi pi-spin pi-spinner"></i>
        <span>Loading stats...</span>
      </div>
    }
  `,
  styles: [`
    :host { display: block; padding-bottom: 40px; }
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 24px; }
    .stat-main-card { padding: 24px; border-radius: 16px; border: 1px solid var(--border); }
    .stat-header { display: flex; align-items: center; gap: 8px; color: var(--text-muted); font-size: 13px; font-weight: 600; margin-bottom: 12px; }
    .stat-header i { color: var(--accent); }
    .stat-value { font-size: 42px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 4px; }
    .stat-footer { font-size: 11px; color: var(--text-muted); }
    .mini-bar-wrap { width: 100%; height: 4px; background: var(--bg-elevated); border-radius: 2px; margin-top: 8px; overflow: hidden; }
    .mini-bar { height: 100%; background: var(--accent); border-radius: 2px; transition: width 1s ease-out; }

    .details-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
    .detail-card { border-radius: 16px; border: 1px solid var(--border); overflow: hidden; }
    .detail-header { padding: 16px 20px; border-bottom: 1px solid var(--border); background: var(--bg-card); }
    .detail-header h3 { margin: 0; font-size: 14px; font-weight: 700; }
    .detail-body { padding: 12px 20px; }

    .freq-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
    .freq-row:last-child { border-bottom: none; }
    .freq-label { font-size: 13px; font-weight: 500; min-width: 120px; }
    .freq-label.unresolved { font-style: italic; color: var(--warning); }
    .freq-bar-wrap { flex: 1; height: 6px; background: var(--bg-elevated); border-radius: 3px; overflow: hidden; }
    .freq-bar { height: 100%; background: var(--accent); border-radius: 3px; transition: width 0.8s ease-out; }
    .freq-bar.miss { background: var(--warning); }
    .freq-val { font-size: 12px; font-family: monospace; font-weight: 700; min-width: 24px; text-align: right; }

    .empty-hint { padding: 40px 0; text-align: center; color: var(--text-muted); font-size: 13px; }
    .loading-state { padding: 100px 0; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 16px; color: var(--text-muted); }

    @media (max-width: 768px) {
      .stats-grid, .details-row { grid-template-columns: 1fr; }
    }

    .stagger-1 { animation: fadeSlideUp 0.5s ease-out 0.05s both; }
    .stagger-2 { animation: fadeSlideUp 0.5s ease-out 0.12s both; }
    .stagger-3 { animation: fadeSlideUp 0.5s ease-out 0.19s both; }
    .stagger-4 { animation: fadeSlideUp 0.5s ease-out 0.26s both; }
    .stagger-5 { animation: fadeSlideUp 0.5s ease-out 0.33s both; }

    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `],
})
export class StatsComponent implements OnInit {
  private api = inject(ApiService);
  stats: UsageStats | null = null;

  get coveragePct() {
    if (!this.stats || this.stats.total_commands === 0) return 0;
    const resolved = this.stats.total_commands - this.stats.unresolved_count;
    return Math.round((resolved / this.stats.total_commands) * 100);
  }

  maxCmdCount = 1;
  maxUnresolvedCount = 1;

  ngOnInit() {
    this.api.getStats().subscribe(res => {
      this.stats = res;
      if (this.stats) {
        this.maxCmdCount = Math.max(...this.stats.top_commands.map(c => c[1]), 1);
        this.maxUnresolvedCount = Math.max(...this.stats.top_unresolved.map(u => u[1]), 1);
      }
    });
  }
}
