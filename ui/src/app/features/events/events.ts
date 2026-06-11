import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
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
import { IntelHeaderComponent } from '../../shared/components/futuristic/intel-header.component';

interface EventGroup {
  object: string;
  kind: string;
  events: KubeEvent[];
  totalCount: number;
  topReason: string;
  hasWarning: boolean;
  lastSeen: string;
}

interface Spike {
  time: string;
  count: number;
  hasWarning: boolean;
}

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [IntelHeaderComponent,
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
  router = inject(Router);
  private watchSub: Subscription | null = null;
  private watchClose: (() => void) | null = null;
  private refreshTimer: any;

  events: KubeEvent[] = [];
  filteredEvents: KubeEvent[] = [];
  filter: 'all' | 'warning' | 'normal' = 'warning';
  searchQuery = '';
  watching = false;
  loading = false;
  autoRefresh = true;
  reasonFilter = '';
  topReasons: string[] = [];
  expandedGroups: Set<string> = new Set();
  viewMode: 'grouped' | 'flat' = 'grouped';

  get warningCount() { return this.events.filter(e => e.type === 'Warning').length; }
  get normalCount() { return this.events.filter(e => e.type !== 'Warning').length; }

  /** Attention items: objects with most warning events */
  get attentionItems(): EventGroup[] {
    return this.warningGroups.filter(g => g.totalCount >= 2).slice(0, 5);
  }

  /** All warning event groups */
  get warningGroups(): EventGroup[] {
    return this.buildGroups(this.events.filter(e => e.type === 'Warning'));
  }

  /** Grouped events for current filter */
  get groupedEvents(): EventGroup[] {
    return this.buildGroups(this.filteredEvents);
  }

  /** Recent spikes — time buckets with high event density */
  get recentSpikes(): Spike[] {
    const buckets = new Map<string, { count: number; hasWarning: boolean }>();
    for (const e of this.events) {
      if (!e.last_seen) continue;
      try {
        const d = new Date(e.last_seen);
        const key = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const existing = buckets.get(key) || { count: 0, hasWarning: false };
        existing.count += e.count || 1;
        if (e.type === 'Warning') existing.hasWarning = true;
        buckets.set(key, existing);
      } catch {}
    }
    return [...buckets.entries()]
      .map(([time, data]) => ({ time, count: data.count, hasWarning: data.hasWarning }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  get filterPills(): CommandPill[] {
    return [
      { label: 'Warnings', value: 'warning', count: this.warningCount, color: 'amber' },
      { label: 'All', value: 'all', count: this.events.length },
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
    this.filter = 'warning';
    this.searchQuery = '';
    this.reasonFilter = '';
    this.applyFilters();
  }

  applyFilters() {
    let result = this.events;
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

  toggleReasonFilter(reason: string) {
    this.reasonFilter = this.reasonFilter === reason ? '' : reason;
    this.applyFilters();
  }

  toggleGroup(object: string) {
    if (this.expandedGroups.has(object)) {
      this.expandedGroups.delete(object);
    } else {
      this.expandedGroups.add(object);
    }
  }

  isGroupExpanded(object: string): boolean {
    return this.expandedGroups.has(object);
  }

  toggleWatch() { this.watching ? this.stopWatch() : this.startWatch(); }

  private startWatch() {
    this.watching = true;
    const conn = this.ws.connect('/ws/events');
    this.watchClose = conn.close;
    this.watchSub = conn.messages$.subscribe(data => {
      this.events = JSON.parse(data);
      this.buildTopReasons();
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

  private buildGroups(events: KubeEvent[]): EventGroup[] {
    const map = new Map<string, KubeEvent[]>();
    for (const e of events) {
      const key = e.object || e.reason;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return [...map.entries()]
      .map(([object, evts]) => {
        const totalCount = evts.reduce((s, e) => s + (e.count || 1), 0);
        const reasonCounts = new Map<string, number>();
        for (const e of evts) reasonCounts.set(e.reason, (reasonCounts.get(e.reason) || 0) + (e.count || 1));
        const topReason = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
        return {
          object,
          kind: evts[0]?.kind || '',
          events: evts,
          totalCount,
          topReason,
          hasWarning: evts.some(e => e.type === 'Warning'),
          lastSeen: evts[0]?.last_seen || '',
        };
      })
      .sort((a, b) => b.totalCount - a.totalCount);
  }

  private buildTopReasons() {
    const counts = new Map<string, number>();
    for (const e of this.events) counts.set(e.reason, (counts.get(e.reason) || 0) + 1);
    this.topReasons = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([r]) => r);
  }

  private startAutoRefresh() {
    clearInterval(this.refreshTimer);
    this.refreshTimer = setInterval(() => { if (!this.watching) this.refresh(); }, 30000);
  }

  ngOnInit() { this.refresh(); this.startAutoRefresh(); }
  ngOnDestroy() { this.stopWatch(); clearInterval(this.refreshTimer); }
}
