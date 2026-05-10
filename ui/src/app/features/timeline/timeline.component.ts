import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [TagModule, ButtonModule, TooltipModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Timeline</h1>
        <p class="subtitle">Cluster activity stream</p>
      </div>
      <div class="header-actions">
        <div class="time-range">
          @for (r of ranges; track r.value) {
            <button class="range-btn" [class.active]="selectedRange === r.value" (click)="setRange(r.value)">{{ r.label }}</button>
          }
        </div>
        <button pButton icon="pi pi-refresh" class="p-button-outlined p-button-sm p-button-rounded" (click)="load()" pTooltip="Refresh"></button>
      </div>
    </div>

    <!-- Activity Summary -->
    <div class="activity-strip">
      <div class="strip-header">
        <span class="strip-label">Activity ({{ events.length }} events)</span>
        <div class="strip-legend">
          <span class="leg"><span class="leg-dot leg-warn"></span> Warning</span>
          <span class="leg"><span class="leg-dot leg-normal"></span> Normal</span>
        </div>
      </div>
      <div class="heatmap">
        @for (bar of heatmapBars; track $index) {
          <div class="heat-bar" [style.height.%]="bar.height" [class.heat-warn]="bar.hasWarning" [pTooltip]="bar.tooltip"></div>
        }
      </div>
    </div>

    <!-- Severity Filter -->
    <div class="filter-row">
      <button class="filter-btn" [class.active]="severityFilter === 'all'" (click)="severityFilter = 'all'; applyFilter()">All</button>
      <button class="filter-btn filter-warn" [class.active]="severityFilter === 'warning'" (click)="severityFilter = 'warning'; applyFilter()">
        <span class="f-dot warn"></span> Warnings ({{ warningCount }})
      </button>
      <button class="filter-btn filter-success" [class.active]="severityFilter === 'success'" (click)="severityFilter = 'success'; applyFilter()">
        <span class="f-dot success"></span> Deployments
      </button>
    </div>

    <!-- Timeline -->
    <div class="timeline">
      <!-- Now marker -->
      <div class="now-marker">
        <span class="now-dot"></span>
        <span class="now-label">Now</span>
        <div class="now-line"></div>
      </div>

      @for (event of filteredEvents; track $index) {
        <div class="tl-item" [class.tl-warning]="event.type === 'Warning'">
          <div class="tl-left">
            <div class="tl-dot-wrap">
              <div class="tl-dot" [class]="'dot-' + eventSeverity(event)">
                <i class="pi" [class]="eventIcon(event)"></i>
              </div>
            </div>
            <div class="tl-connector"></div>
          </div>
          <div class="tl-card">
            <div class="tl-card-header">
              <span class="tl-reason">{{ event.reason || 'Event' }}</span>
              <p-tag [value]="event.type || 'Normal'" [severity]="tagSeverity(event)" [rounded]="true" />
              <span class="tl-time">{{ formatTime(event.time || event.last_seen) }}</span>
            </div>
            <div class="tl-card-body">
              <code class="tl-object">{{ event.object || event.name || '' }}</code>
              <p class="tl-message">{{ event.message || '' }}</p>
            </div>
            @if (event.count && event.count > 1) {
              <span class="tl-repeat">{{ event.count }}× repeated</span>
            }
          </div>
        </div>
      }

      @if (filteredEvents.length === 0) {
        <div class="empty-state">
          <i class="pi pi-clock"></i>
          <span>No activity in the last {{ selectedRange }} minutes</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .header-actions { display: flex; align-items: center; gap: 10px; }

    /* Time Range */
    .time-range { display: flex; gap: 2px; background: var(--bg-elevated); border-radius: 8px; padding: 3px; }
    .range-btn {
      padding: 5px 12px; border: none; border-radius: 6px; font-size: 11px; font-weight: 500;
      cursor: pointer; background: transparent; color: var(--text-muted); transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
    }
    .range-btn.active { background: var(--accent); color: #fff; }
    .range-btn:hover:not(.active) { color: var(--text); }

    /* Activity Strip */
    .activity-strip {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 14px 16px; margin-bottom: 16px;
    }
    .strip-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .strip-label { font-size: 11px; color: var(--text-muted); font-weight: 500; }
    .strip-legend { display: flex; gap: 12px; }
    .leg { display: flex; align-items: center; gap: 4px; font-size: 10px; color: var(--text-muted); }
    .leg-dot { width: 6px; height: 6px; border-radius: 2px; }
    .leg-warn { background: var(--warning); }
    .leg-normal { background: var(--accent); }
    .heatmap { display: flex; align-items: flex-end; gap: 2px; height: 32px; }
    .heat-bar {
      flex: 1; min-height: 3px; border-radius: 2px 2px 0 0;
      background: var(--accent); opacity: 0.6; transition: all 0.2s;
    }
    .heat-bar:hover { opacity: 1; }
    .heat-bar.heat-warn { background: var(--warning); }

    /* Filter */
    .filter-row { display: flex; gap: 6px; margin-bottom: 16px; }
    .filter-btn {
      display: flex; align-items: center; gap: 5px;
      padding: 5px 12px; border-radius: 6px; border: 1px solid var(--border);
      background: var(--bg-card); font-size: 11px; color: var(--text-muted);
      cursor: pointer; transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
    }
    .filter-btn:hover { border-color: var(--border-hover); color: var(--text); }
    .filter-btn.active { border-color: var(--accent); background: var(--accent-subtle); color: var(--accent); }
    .f-dot { width: 6px; height: 6px; border-radius: 50%; }
    .f-dot.warn { background: var(--warning); }
    .f-dot.success { background: var(--success); }

    /* Timeline */
    .timeline { position: relative; }
    .now-marker { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; padding-left: 14px; }
    .now-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--success); box-shadow: 0 0 8px var(--success); animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
    .now-label { font-size: 11px; font-weight: 600; color: var(--success); }
    .now-line { flex: 1; height: 1px; background: linear-gradient(to right, var(--success), transparent); }

    .tl-item { display: flex; gap: 0; margin-bottom: 2px; }
    .tl-left { display: flex; flex-direction: column; align-items: center; width: 40px; flex-shrink: 0; }
    .tl-dot-wrap { padding: 12px 0 0; }
    .tl-dot {
      width: 28px; height: 28px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center; font-size: 12px;
    }
    .dot-info { background: var(--accent-subtle); color: var(--accent); }
    .dot-warn { background: var(--warning-subtle); color: var(--warning); }
    .dot-danger { background: var(--danger-subtle); color: var(--danger); }
    .dot-success { background: var(--success-subtle); color: var(--success); }
    .tl-connector { width: 2px; flex: 1; background: var(--border); min-height: 8px; }
    .tl-item:last-child .tl-connector { display: none; }

    .tl-card {
      flex: 1; padding: 10px 14px; margin: 4px 0;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
      transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
    }
    .tl-card:hover { border-color: var(--border-hover); transform: translateY(-2px); box-shadow: 0 8px 24px -8px rgba(0,0,0,0.2); }
    .tl-item.tl-warning .tl-card { border-left: 3px solid var(--warning); }
    .tl-card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .tl-reason { font-size: 13px; font-weight: 600; }
    .tl-time { font-size: 10px; color: var(--text-muted); font-family: 'JetBrains Mono', monospace; margin-left: auto; }
    .tl-card-body { }
    .tl-object { font-size: 11px; display: inline-block; margin-bottom: 2px; color: var(--text-secondary); }
    .tl-message { font-size: 12px; color: var(--text-muted); margin: 0; line-height: 1.4; }
    .tl-repeat { font-size: 10px; color: var(--warning); margin-top: 4px; display: inline-block; }

    .empty-state {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      padding: 56px; color: var(--text-muted); font-size: 13px;
    }
    .empty-state i { font-size: 28px; opacity: 0.3; }
  `],
})
export class TimelineComponent implements OnInit {
  private http = inject(HttpClient);
  events: any[] = [];
  filteredEvents: any[] = [];
  heatmapBars: { height: number; hasWarning: boolean; tooltip: string }[] = [];
  selectedRange = 60;
  severityFilter: 'all' | 'warning' | 'success' = 'all';

  ranges = [
    { label: '5m', value: 5 },
    { label: '15m', value: 15 },
    { label: '30m', value: 30 },
    { label: '1h', value: 60 },
  ];

  get warningCount() { return this.events.filter(e => e.type === 'Warning').length; }

  ngOnInit() { this.load(); }

  setRange(minutes: number) {
    this.selectedRange = minutes;
    this.load();
  }

  applyFilter() {
    if (this.severityFilter === 'all') {
      this.filteredEvents = this.events;
    } else if (this.severityFilter === 'warning') {
      this.filteredEvents = this.events.filter(e => e.type === 'Warning');
    } else {
      this.filteredEvents = this.events.filter(e => e.reason === 'Started' || e.reason === 'Created' || e.reason === 'ScalingReplicaSet');
    }
  }

  load() {
    this.http.get<any>(`http://localhost:8000/api/timeline?minutes=${this.selectedRange}`).subscribe(res => {
      this.events = res.events || [];
      this.filteredEvents = this.events;
      this.buildHeatmap();
    });
  }

  private buildHeatmap() {
    const buckets = 30;
    const bars: { count: number; hasWarning: boolean }[] = Array.from({ length: buckets }, () => ({ count: 0, hasWarning: false }));
    const total = this.events.length;

    // Distribute events across buckets (simple even distribution)
    for (let i = 0; i < total; i++) {
      const bucket = Math.min(Math.floor((i / total) * buckets), buckets - 1);
      bars[bucket].count++;
      if (this.events[i].type === 'Warning') bars[bucket].hasWarning = true;
    }

    const maxCount = Math.max(...bars.map(b => b.count), 1);
    this.heatmapBars = bars.map(b => ({
      height: Math.max((b.count / maxCount) * 100, 8),
      hasWarning: b.hasWarning,
      tooltip: `${b.count} events`,
    }));
  }

  eventSeverity(event: any): string {
    if (event.type === 'Warning' || event.severity === 'warning') return 'warn';
    if (event.severity === 'critical') return 'danger';
    if (event.reason === 'Started' || event.reason === 'Created') return 'success';
    return 'info';
  }

  eventIcon(event: any): string {
    const s = this.eventSeverity(event);
    if (s === 'warn') return 'pi-exclamation-triangle';
    if (s === 'danger') return 'pi-times-circle';
    if (s === 'success') return 'pi-check';
    return 'pi-info-circle';
  }

  tagSeverity(event: any): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const s = this.eventSeverity(event);
    if (s === 'warn') return 'warn';
    if (s === 'danger') return 'danger';
    if (s === 'success') return 'success';
    return 'info';
  }

  formatTime(time: string): string {
    if (!time) return '';
    try {
      const d = new Date(time);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return time;
    }
  }
}
