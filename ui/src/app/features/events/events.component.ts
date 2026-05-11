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

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [TagModule, ButtonModule, TooltipModule, FormsModule, SpotlightComponent],
  template: `
    <app-spotlight id="events" title="Cluster Events" icon="pi pi-bolt"
      description="Real-time Kubernetes events. Filter by type to spot issues."
      [capabilities]="['Live event stream', 'Warning/Normal filter', 'Object grouping']" [compact]="true" />

        <!-- Header -->
    <div class="page-header">
      <div>
        <h1>Events</h1>
        <p class="subtitle">Cluster activity stream</p>
      </div>
      <div class="header-actions">
        <button pButton [class]="watching ? 'p-button-danger p-button-sm' : 'p-button-outlined p-button-sm'" (click)="toggleWatch()">
          <span class="watch-dot" [class.pulsing]="watching"></span>
          {{ watching ? 'Live' : 'Watch' }}
        </button>
        <button pButton icon="pi pi-refresh" class="p-button-outlined p-button-sm p-button-rounded" (click)="refresh()" pTooltip="Refresh"></button>
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
      <div class="search-wrap">
        <i class="pi pi-search"></i>
        <input [(ngModel)]="searchQuery" placeholder="Filter events..." (ngModelChange)="applyFilters()" />
      </div>
    </div>

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
                <span class="event-time">{{ event.last_seen }}</span>
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
    /* Header */
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .header-actions { display: flex; align-items: center; gap: 8px; }
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

  events: KubeEvent[] = [];
  filteredEvents: KubeEvent[] = [];
  filter: 'all' | 'warning' | 'normal' = 'all';
  searchQuery = '';
  watching = false;
  expandedIndex = -1;

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
    if (this.filter === 'warning') result = result.filter(e => e.type === 'Warning');
    if (this.filter === 'normal') result = result.filter(e => e.type !== 'Warning');
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
    this.api.getEvents(100).subscribe(res => {
      this.events = res.events;
      this.applyFilters();
    });
  }

  ngOnInit() { this.refresh(); }
  ngOnDestroy() { this.stopWatch(); }
}
