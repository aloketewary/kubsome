import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { HoloCardComponent } from '../../shared/components/futuristic/holo-card.component';
import { MetricTileComponent } from '../../shared/components/futuristic/metric-tile.component';
import { StatusBeaconComponent } from '../../shared/components/futuristic/status-beacon.component';
import { CommandBarComponent } from '../../shared/components/futuristic/command-bar.component';
import type { CommandPill } from '../../shared/components/futuristic/command-bar.component';
import { LiveIndicatorComponent } from '../../shared/components/futuristic/live-indicator.component';

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [TagModule, TooltipModule, HoloCardComponent, MetricTileComponent, StatusBeaconComponent, CommandBarComponent, LiveIndicatorComponent],
  templateUrl: './timeline.html',
  styleUrl: './timeline.scss',
})
export class TimelineComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  events: any[] = [];
  filteredEvents: any[] = [];
  heatmapBars: { height: number; hasWarning: boolean; tooltip: string }[] = [];
  selectedRange = 60;
  severityFilter = 'all';
  loading = false;
  lastUpdated = '';
  private refreshTimer: any;

  ranges = [{ label: '5m', value: 5 }, { label: '15m', value: 15 }, { label: '30m', value: 30 }, { label: '1h', value: 60 }];

  get warningCount() { return this.events.filter(e => e.type === 'Warning').length; }
  get filterPills(): CommandPill[] {
    return [
      { label: 'All', value: 'all', count: this.events.length },
      { label: 'Warnings', value: 'warning', count: this.warningCount, color: 'amber' },
      { label: 'Deploys', value: 'success', color: 'green' },
    ];
  }

  onFilterChange(v: string) { this.severityFilter = v; this.applyFilter(); }

  ngOnInit() { this.load(); this.refreshTimer = setInterval(() => this.load(), 30000); }
  ngOnDestroy() { clearInterval(this.refreshTimer); }

  setRange(minutes: number) { this.selectedRange = minutes; this.load(); }

  applyFilter() {
    if (this.severityFilter === 'all') this.filteredEvents = this.events;
    else if (this.severityFilter === 'warning') this.filteredEvents = this.events.filter(e => e.type === 'Warning');
    else this.filteredEvents = this.events.filter(e => e.reason === 'Started' || e.reason === 'Created' || e.reason === 'ScalingReplicaSet');
  }

  load() {
    this.loading = true;
    this.http.get<any>(`/api/timeline?minutes=${this.selectedRange}`).subscribe(res => {
      this.events = res.events || [];
      this.filteredEvents = this.events;
      this.buildHeatmap();
      this.loading = false;
      this.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    });
  }

  private buildHeatmap() {
    const buckets = 30;
    const bars: { count: number; hasWarning: boolean }[] = Array.from({ length: buckets }, () => ({ count: 0, hasWarning: false }));
    const total = this.events.length;
    for (let i = 0; i < total; i++) { const b = Math.min(Math.floor((i / total) * buckets), buckets - 1); bars[b].count++; if (this.events[i].type === 'Warning') bars[b].hasWarning = true; }
    const max = Math.max(...bars.map(b => b.count), 1);
    this.heatmapBars = bars.map(b => ({ height: Math.max((b.count / max) * 100, 8), hasWarning: b.hasWarning, tooltip: `${b.count} events` }));
  }

  eventSeverity(event: any): string { if (event.type === 'Warning') return 'warn'; if (event.reason === 'Started' || event.reason === 'Created') return 'success'; return 'info'; }
  eventIcon(event: any): string { const s = this.eventSeverity(event); if (s === 'warn') return 'pi-exclamation-triangle'; if (s === 'success') return 'pi-check'; return 'pi-info-circle'; }
  tagSeverity(event: any): 'success' | 'info' | 'warn' | 'danger' { const s = this.eventSeverity(event); if (s === 'warn') return 'warn'; if (s === 'success') return 'success'; return 'info'; }
  beaconStatus(event: any): 'ok' | 'warning' | 'info' { const s = this.eventSeverity(event); if (s === 'warn') return 'warning'; if (s === 'success') return 'ok'; return 'info'; }

  formatTime(time: string): string { if (!time) return ''; try { return new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch { return time; } }
}
