import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { IntelHeaderComponent } from '../../shared/components/futuristic/intel-header.component';
import { MetricTileComponent } from '../../shared/components/futuristic/metric-tile.component';
import { LiveIndicatorComponent } from '../../shared/components/futuristic/live-indicator.component';
import { HoloCardComponent } from '../../shared/components/futuristic/holo-card.component';
import { DataRowComponent } from '../../shared/components/futuristic/data-row.component';
import { ActionIconComponent } from '../../shared/components/futuristic/action-icon.component';

@Component({
  selector: 'app-watch-manager',
  standalone: true,
  imports: [FormsModule, TagModule, TooltipModule, IntelHeaderComponent, MetricTileComponent, LiveIndicatorComponent, HoloCardComponent, DataRowComponent, ActionIconComponent],
  templateUrl: './watch-manager.html',
  styleUrl: './watch-manager.scss',
})
export class WatchManagerComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  status: any = null;
  showForm = false;
  newTarget = '';
  newCondition: 'crash' | 'restart' | 'count' = 'crash';
  formError = '';
  private pollInterval: any;

  get triggeredCount(): number {
    return (this.status?.watches || []).filter((w: any) => w.triggered).length;
  }

  ngOnInit() { this.refresh(); this.pollInterval = setInterval(() => this.refresh(), 15000); }
  ngOnDestroy() { clearInterval(this.pollInterval); }

  refresh() {
    this.http.get<any>('/api/watch-status').subscribe({
      next: (res) => (this.status = res),
      error: () => (this.status = { running: false, watches: [] }),
    });
  }

  createWatch() {
    if (!this.newTarget.trim()) return;
    this.formError = '';
    this.http.post<any>('/api/watch-alert', { target: this.newTarget.trim(), condition: this.newCondition }).subscribe({
      next: () => { this.newTarget = ''; this.showForm = false; this.refresh(); },
      error: (err) => { this.formError = err.error?.detail || 'Failed'; },
    });
  }

  removeWatch(name: string) {
    this.http.delete<any>(`/api/watch-alert/${name}`).subscribe({ next: () => this.refresh() });
  }

  formatTime(ts: number): string {
    return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
