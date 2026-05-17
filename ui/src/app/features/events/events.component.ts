import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { WsService } from '../../core/services/ws.service';
import { KubeEvent } from '../../core/models';
import { SpotlightComponent } from '../../shared/components/spotlight.component';

interface HeatmapCell {
  count: number;
  level: number;
  hasWarning: boolean;
  label: string;
}

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [TagModule, ButtonModule, TooltipModule, FormsModule, SpotlightComponent],
  template: `
    <app-spotlight id="events" title="Cluster Events" icon="pi pi-bolt"
      description="Real-time Kubernetes events. Filter by type to spot issues."
      [capabilities]="['Live event stream', 'Warning/Normal filter', 'Object grouping']" [compact]="true" />

    <!-- Heatmap -->
    @if (events.length > 0) {
      <div class="heatmap-card">
        <div class="heatmap-header">
          <span class="heatmap-title">Event Activity</span>
          <span class="heatmap-legend">
            <span class="hl-item"><span class="hl-dot hl-normal"></span>Normal</span>
            <span class="hl-item"><span class="hl-dot hl-warn"></span>Warning</span>
          </span>
        </div>
        <div class="heatmap-grid">
          @for (cell of heatmapCells; track $index) {
            <div class="heatmap-cell" [class.hc-low]="cell.level === 1" [class.hc-med]="cell.level === 2" [class.hc-high]="cell.level === 3" [class.hc-warn]="cell.hasWarning" [class.hc-selected]="selectedBucket === $index" [pTooltip]="cell.label" (click)="selectBucket($index)"></div>
          }
        </div>
        <div class="heatmap-labels">
          <span>older</span>
          <span>recent</span>
        </div>
      </div>
    }

        <!-- Header -->
    <div class="page-header">
      <div>
        <h1>Events</h1>
        <p class="subtitle">{{ filteredEvents.length }} events · {{ warningCount }} warnings</p>
      </div>
      <div class="header-actions">
        <button class="ar-btn" [class.ar-active]="autoRefresh" (click)="toggleAutoRefresh()" [pTooltip]="autoRefresh ? 'Auto-refresh on (30s)' : 'Auto-refresh off'">
          <i class="pi" [class.pi-sync]="autoRefresh" [class.pi-pause]="!autoRefresh"></i>
        </button>
        <button pButton [class]="watching ? 'p-button-danger p-button-sm' : 'p-button-outlined p-button-sm'" (click)="toggleWatch()">
          <span class="watch-dot" [class.pulsing]="watching"></span>
          {{ watching ? 'Live' : 'Watch' }}
        </button>
        <button pButton icon="pi pi-refresh" class="p-button-outlined p-button-sm p-button-rounded" (click)="refresh()" pTooltip="Refresh" [loading]="loading"></button>
      </div>
    </div>

    <!-- Summary + Filters -->
    <div class="controls-bar">
      <div class="summary-pills">
        <span class="pill" [class.pill-active]="filter === 'all'" (click)="setFilter('all')">
          All <strong>{{ events.length }}</strong>
        </span>
        <span class="pill pill-warn" [class.pill-active]="filter === 'warning'" (click)="setFilter('warning')">
          <span class="pill-dot warn"></span> Warnings <strong>{{ warningCount }}</strong>
        </span>
        <span class="pill pill-normal" [class.pill-active]="filter === 'normal'" (click)="setFilter('normal')">
          <span class="pill-dot normal"></span> Normal <strong>{{ normalCount }}</strong>
        </span>
      </div>
      <div class="controls-right">
        @if (topReasons.length > 0) {
          <div class="reason-chips">
            @for (r of topReasons; track r) {
              <button class="reason-chip" [class.rc-active]="reasonFilter === r" (click)="toggleReasonFilter(r)">{{ r }}</button>
            }
          </div>
        }
        <div class="search-wrap">
          <i class="pi pi-search"></i>
          <input [(ngModel)]="searchQuery" placeholder="Filter events..." (ngModelChange)="applyFilters()" />
        </div>
      </div>
    </div>

    @if (loading && events.length === 0) {
      <div class="loading-state"><i class="pi pi-spin pi-spinner"></i> Loading events...</div>
    }

    <!-- Events List -->
    <div class="events-container">
      @if (filteredEvents.length > 0) {
        @for (event of filteredEvents; track $index) {
          <div class="event-card" [class.event-warning]="event.type === 'Warning'" (click)="toggleExpand($index)">
            <div class="event-left">
              <div class="event-indicator" [class.ind-warn]="event.type === 'Warning'" [class.ind-normal]="event.type !== 'Warning'"></div>
            </div>
            <div class="event-main">
              <div class="event-top-row">
                <span class="event-reason">{{ event.reason }}</span>
                <div class="event-tags">
                  <span class="event-kind">{{ event.kind }}</span>
                  <code class="event-object">{{ event.object }}</code>
                </div>
                @if (event.count > 1) {
                  <span class="event-repeat">{{ event.count }}×</span>
                }
              </div>
              <p class="event-message" [class.expanded]="expandedIndex === $index">{{ event.message }}</p>
              @if (event.last_seen) {
                <span class="event-time" [pTooltip]="event.last_seen">{{ relativeTime(event.last_seen) }}</span>
              }
            </div>
            <div class="event-type-tag">
              <p-tag [value]="event.type" [severity]="event.type === 'Warning' ? 'warn' : 'info'" [rounded]="true" />
            </div>
          </div>
        }
      } @else {
        <div class="empty-state">
          @if (searchQuery || filter !== 'all') {
            <i class="pi pi-filter-slash"></i>
            <span>No events match your filter</span>
            <button pButton label="Clear filters" class="p-button-text p-button-sm" (click)="clearFilters()"></button>
          } @else {
            <i class="pi pi-check-circle"></i>
            <span>No events — cluster is quiet</span>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    /* Heatmap */
    .heatmap-card {
      padding: 16px 18px; margin-bottom: 16px;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
    }
    .heatmap-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .heatmap-title { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
    .heatmap-legend { display: flex; gap: 10px; }
    .hl-item { display: flex; align-items: center; gap: 4px; font-size: 10px; color: var(--text-muted); }
    .hl-dot { width: 8px; height: 8px; border-radius: 2px; }
    .hl-normal { background: var(--accent); opacity: 0.6; }
    .hl-warn { background: var(--warning); }
    .heatmap-grid {
      display: grid; grid-template-columns: repeat(24, 1fr); gap: 3px;
    }
    .heatmap-cell {
      aspect-ratio: 1; border-radius: 3px; background: var(--bg-elevated);
      transition: all 0.2s; cursor: default;
    }
    .heatmap-cell:hover { transform: scale(1.3); z-index: 1; }
    .heatmap-cell { cursor: pointer; }
    .hc-selected { outline: 2px solid var(--accent); outline-offset: 1px; }
    .hc-low { background: var(--accent); opacity: 0.25; }
    .hc-med { background: var(--accent); opacity: 0.55; }
    .hc-high { background: var(--accent); opacity: 0.9; }
    .hc-warn.hc-low { background: var(--warning); opacity: 0.3; }
    .hc-warn.hc-med { background: var(--warning); opacity: 0.6; }
    .hc-warn.hc-high { background: var(--warning); opacity: 0.95; }
    .heatmap-labels { display: flex; justify-content: space-between; margin-top: 4px; font-size: 9px; color: var(--text-muted); }

    /* Header */
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .header-actions { display: flex; align-items: center; gap: 8px; }
    .ar-btn {
      width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--border);
      background: var(--bg-card); color: var(--text-muted); cursor: pointer; transition: all 0.15s;
      display: flex; align-items: center; justify-content: center;
    }
    .ar-btn:hover { border-color: var(--accent); color: var(--accent); }
    .ar-btn.ar-active { border-color: var(--success); color: var(--success); background: var(--success-subtle); }
    .ar-btn.ar-active i { animation: spin 2s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .watch-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--text-muted); display: inline-block; margin-right: 6px; }
    .watch-dot.pulsing { background: var(--danger); animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

    /* Controls */
    .controls-bar {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 16px; padding: 12px 16px;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-sm);
    }
    .summary-pills { display: flex; gap: 6px; }
    .pill {
      display: flex; align-items: center; gap: 6px;
      padding: 5px 12px; border-radius: 20px;
      font-size: 12px; cursor: pointer;
      background: var(--bg-elevated); border: 1px solid var(--border);
      transition: all 0.12s; color: var(--text-secondary);
    }
    .pill:hover { border-color: var(--border-hover); color: var(--text); }
    .pill.pill-active { border-color: var(--accent); background: var(--accent-subtle); color: var(--accent); }
    .pill strong { font-weight: 700; }
    .pill-dot { width: 6px; height: 6px; border-radius: 50%; }
    .pill-dot.warn { background: var(--warning); }
    .pill-dot.normal { background: var(--accent); }
    .search-wrap { position: relative; }
    .search-wrap i { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 12px; }
    .search-wrap input {
      padding: 6px 10px 6px 30px; width: 180px;
      background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 6px;
      color: var(--text); font-size: 12px; outline: none;
    }
    .search-wrap input:focus { border-color: var(--accent); }

    /* Reason Chips */
    .controls-right { display: flex; align-items: center; gap: 10px; }
    .reason-chips { display: flex; gap: 4px; flex-wrap: wrap; }
    .reason-chip {
      padding: 4px 10px; border-radius: 12px; border: 1px solid var(--border);
      background: var(--bg-elevated); color: var(--text-muted); font-size: 10px;
      cursor: pointer; transition: all 0.12s; font-weight: 500;
    }
    .reason-chip:hover { border-color: var(--border-hover); color: var(--text); }
    .reason-chip.rc-active { border-color: var(--accent); background: var(--accent-subtle); color: var(--accent); }

    /* Loading */
    .loading-state {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      padding: 48px; color: var(--text-muted); font-size: 13px;
    }

    /* Events */
    .events-container { display: flex; flex-direction: column; gap: 4px; }
    .event-card {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 14px 18px;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
      cursor: pointer; transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
    }
    .event-card:hover { border-color: var(--border-hover); background: var(--bg-elevated); transform: translateY(-2px); box-shadow: 0 8px 24px -8px rgba(0,0,0,0.2); }
    .event-card.event-warning { border-left: 3px solid var(--warning); }

    .event-left { display: flex; flex-direction: column; align-items: center; padding-top: 4px; }
    .event-indicator { width: 8px; height: 8px; border-radius: 50%; }
    .ind-warn { background: var(--warning); box-shadow: 0 0 6px var(--warning); }
    .ind-normal { background: var(--accent); }

    .event-main { flex: 1; min-width: 0; }
    .event-top-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap; }
    .event-reason { font-size: 13px; font-weight: 600; }
    .event-tags { display: flex; gap: 4px; }
    .event-kind {
      font-size: 10px; padding: 2px 8px; border-radius: 20px;
      background: var(--bg-elevated); color: var(--text-muted);
      text-transform: uppercase; letter-spacing: 0.03em; font-weight: 500;
    }
    .event-object {
      font-size: 11px; font-family: 'JetBrains Mono', monospace;
      color: var(--text-secondary);
    }
    .event-repeat {
      font-size: 10px; font-weight: 700; padding: 2px 7px;
      border-radius: 10px; background: var(--warning-subtle); color: var(--warning);
    }
    .event-message {
      font-size: 12px; color: var(--text-secondary); margin: 0;
      line-height: 1.5;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      transition: all 0.2s;
      cursor: pointer;
    }
    .event-message::after {
      content: ' ▸';
      color: var(--text-muted);
      font-size: 10px;
    }
    .event-message.expanded { white-space: normal; overflow: visible; }
    .event-message.expanded::after { content: ' ▾'; }
    .event-time {
      font-size: 10px; color: var(--text-muted); margin-top: 4px;
      font-family: 'JetBrains Mono', monospace; display: block;
    }
    .event-type-tag { flex-shrink: 0; }

    /* Empty */
    .empty-state {
      display: flex; flex-direction: column; align-items: center; gap: 10px;
      padding: 56px; color: var(--text-muted); font-size: 13px;
    }
    .empty-state i { font-size: 28px; opacity: 0.3; }
  `],
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

  setFilter(f: 'all' | 'warning' | 'normal') {
    this.filter = f;
    this.applyFilters();
  }

  clearFilters() {
    this.filter = 'all';
    this.searchQuery = '';
    this.applyFilters();
  }

  applyFilters() {
    let result = this.events;

    // Heatmap bucket filter
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

  toggleWatch() {
    if (this.watching) { this.stopWatch(); } else { this.startWatch(); }
  }

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

  private buildHeatmap() {
    const cells: HeatmapCell[] = [];
    const total = this.events.length;
    const bucketCount = 24;
    const bucketSize = Math.max(Math.ceil(total / bucketCount), 1);
    const maxCount = Math.max(...Array.from({ length: bucketCount }, (_, i) => {
      const slice = this.events.slice(i * bucketSize, (i + 1) * bucketSize);
      return slice.length;
    }), 1);

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

  ngOnInit() {
    this.refresh();
    this.startAutoRefresh();
  }
  ngOnDestroy() { this.stopWatch(); clearInterval(this.refreshTimer); }

  toggleAutoRefresh() {
    this.autoRefresh = !this.autoRefresh;
    if (this.autoRefresh) this.startAutoRefresh();
    else clearInterval(this.refreshTimer);
  }

  private startAutoRefresh() {
    clearInterval(this.refreshTimer);
    this.refreshTimer = setInterval(() => {
      if (!this.watching) this.refresh();
    }, 30000);
  }

  relativeTime(ts: string): string {
    if (!ts) return '';
    try {
      const date = new Date(ts);
      const now = Date.now();
      const diff = Math.floor((now - date.getTime()) / 1000);
      if (diff < 60) return `${diff}s ago`;
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      return `${Math.floor(diff / 86400)}d ago`;
    } catch {
      return ts;
    }
  }

  toggleReasonFilter(reason: string) {
    this.reasonFilter = this.reasonFilter === reason ? '' : reason;
    this.applyFilters();
  }

  selectBucket(index: number) {
    this.selectedBucket = this.selectedBucket === index ? -1 : index;
    this.applyFilters();
  }

  private buildTopReasons() {
    const counts = new Map<string, number>();
    for (const e of this.events) {
      counts.set(e.reason, (counts.get(e.reason) || 0) + 1);
    }
    this.topReasons = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason]) => reason);
  }
}
