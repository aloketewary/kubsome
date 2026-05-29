import { Component, inject, OnInit } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { UsageStats } from '../../core/models';
import { IntelHeaderComponent } from '../../shared/components/futuristic/intel-header.component';
import { MetricTileComponent } from '../../shared/components/futuristic/metric-tile.component';
import { HoloCardComponent } from '../../shared/components/futuristic/holo-card.component';

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [IntelHeaderComponent, MetricTileComponent, HoloCardComponent],
  templateUrl: './stats.html',
  styleUrl: './stats.scss',
})
export class StatsComponent implements OnInit {
  private api = inject(ApiService);
  stats: UsageStats | null = null;
  maxCmdCount = 1;
  maxUnresolvedCount = 1;

  get coveragePct() {
    if (!this.stats || this.stats.total_commands === 0) return 0;
    return Math.round(((this.stats.total_commands - this.stats.unresolved_count) / this.stats.total_commands) * 100);
  }

  get timeSavedHuman() {
    if (!this.stats) return '0m';
    const mins = ((this.stats.total_commands - this.stats.unresolved_count) * 2) + (this.stats.auto_remediations * 15);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

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
