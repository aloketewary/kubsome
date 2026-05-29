import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { WsService } from '../../core/services/ws.service';
import { KubeEvent } from '../../core/models';
import { HoloCardComponent } from '../../shared/components/futuristic/holo-card.component';
import { StatusBeaconComponent } from '../../shared/components/futuristic/status-beacon.component';
import { MetricTileComponent } from '../../shared/components/futuristic/metric-tile.component';
import { CommandBarComponent } from '../../shared/components/futuristic/command-bar.component';
import type { CommandPill } from '../../shared/components/futuristic/command-bar.component';
import { LiveIndicatorComponent } from '../../shared/components/futuristic/live-indicator.component';

interface HeatmapCell {
  count: number;
  level: number;
  hasWarning: boolean;
  label: string;
}

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [
    FormsModule, TagModule, ButtonModule, TooltipModule,
    HoloCardComponent, StatusBeaconComponent, MetricTileComponent,
    CommandBarComponent, LiveIndicatorComponent,
  ],
  templateUrl: './events.html',
  styleUrl: './events.scss',
})
export class EventsComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private ws = inject(WsService);
  private watchSub: Subscription | null = null;
  private watchClose: (() => void) | null = null;
  private refreshTimer: any;

  events: KubeEvent[] = [];
  filteredEvents: KubeEvent[] = [];
  heatmapCells: HeatmapCell[] = [];
  filter: 'all' | 'warning' | 'normal' = 'all';
  searchQuery = '';
  watching = false;
  expandedIndex = -1;
  loading = false;
  autoRefresh = true;
  reasonFilter = '';
  selectedBucket = -1;
  topReasons: string[] = [];

  get warningCount() { return this.events.filter(e => e.type === 'Warning').length; }
  get normalCount() { return this.events.filter(e => e.type !== 'Warning').length; }

  get filterPills(): CommandPill[] {
    return [
      { label: 'All', value: 'all', count: this.events.length },
      { label: 'Warnings', value: 'warning', count: this.warningCount, color: 'amber' },
      { label: 'Normal', value: 'normal', count: this.normalCount, color: 'green' },
    ];
  }

  onFilterChange(value: string) {
    this.filter = value as any;
    this.applyFilters();
  }

  onSearchChange(value: string) {
    this.searchQuery = value;
    this.applyFilters();
  }

  clearFilters() {
    this.filter = 'all';
    this.searchQuery = '';
    this.reasonFilter = '';
    this.selectedBucket = -1;
    this.applyFilters();
  }

  applyFilters() {
    let result = this.events;
    if (this.selectedBucket >= 0) {
      const total = this.events.length;
      const bucketSize = Math.max(Math.ceil(total / 24), 1);
      const start = this.selectedBucket * bucketSize;
      const end = Math.min(start + bucketSize, total);
      result = result.slice(start, end);
    }
    if (this.filter === 'warning') result = result.filter(e => e.type === 'Warning');
    if (this.filter === 'normal') result = result.filter(e => e.type !== 'Warning');
    if (this.reasonFilter) result = result.filter(e => e.reason === this.reasonFilter);
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(e =>
        e.reason.toLowerCase().includes(q) ||
        e.object.toLowerCase().includes(q) ||
        e.message.toLowerCase().includes(q)
      );
    }
    this.filteredEvents = result;
  }

  toggleExpand(index: number) {
    this.expandedIndex = this.expandedIndex === index ? -1 : index;
  }

  toggleWatch() { this.watching ? this.stopWatch() : this.startWatch(); }

  private startWatch() {
    this.watching = true;
    const conn = this.ws.connect('/ws/events');
    this.watchClose = conn.close;
    this.watchSub = conn.messages$.subscribe(data => {
      this.events = JSON.parse(data);
      this.buildHeatmap();
      this.applyFilters();
    });
  }

  private stopWatch() {
    this.watching = false;
    this.watchSub?.unsubscribe();
    this.watchClose?.();
    this.watchSub = null;
    this.watchClose = null;
  }

  refresh() {
    this.loading = true;
    this.api.getEvents(100).subscribe(res => {
      this.events = res.events;
      this.buildHeatmap();
      this.buildTopReasons();
      this.applyFilters();
      this.loading = false;
    });
  }

  toggleAutoRefresh() {
    this.autoRefresh = !this.autoRefresh;
    if (this.autoRefresh) this.startAutoRefresh();
    else clearInterval(this.refreshTimer);
  }

  toggleReasonFilter(reason: string) {
    this.reasonFilter = this.reasonFilter === reason ? '' : reason;
    this.applyFilters();
  }

  selectBucket(index: number) {
    this.selectedBucket = this.selectedBucket === index ? -1 : index;
    this.applyFilters();
  }

  relativeTime(ts: string): string {
    if (!ts) return '';
    try {
      const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
      if (diff < 60) return `${diff}s ago`;
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      return `${Math.floor(diff / 86400)}d ago`;
    } catch { return ts; }
  }

  private buildHeatmap() {
    const cells: HeatmapCell[] = [];
    const total = this.events.length;
    const bucketCount = 24;
    const bucketSize = Math.max(Math.ceil(total / bucketCount), 1);
    const maxCount = Math.max(...Array.from({ length: bucketCount }, (_, i) =>
      this.events.slice(i * bucketSize, (i + 1) * bucketSize).length
    ), 1);

    for (let i = 0; i < bucketCount; i++) {
      const slice = this.events.slice(i * bucketSize, (i + 1) * bucketSize);
      const count = slice.length;
      const hasWarning = slice.some(e => e.type === 'Warning');
      const ratio = count / maxCount;
      const level = count === 0 ? 0 : ratio > 0.66 ? 3 : ratio > 0.33 ? 2 : 1;
      const warnings = slice.filter(e => e.type === 'Warning').length;
      cells.push({ count, level, hasWarning, label: `${count} events${warnings ? ' (' + warnings + ' warnings)' : ''}` });
    }
    this.heatmapCells = cells;
  }

  private buildTopReasons() {
    const counts = new Map<string, number>();
    for (const e of this.events) counts.set(e.reason, (counts.get(e.reason) || 0) + 1);
    this.topReasons = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([r]) => r);
  }

  private startAutoRefresh() {
    clearInterval(this.refreshTimer);
    this.refreshTimer = setInterval(() => { if (!this.watching) this.refresh(); }, 30000);
  }

  ngOnInit() { this.refresh(); this.startAutoRefresh(); }
  ngOnDestroy() { this.stopWatch(); clearInterval(this.refreshTimer); }
}
