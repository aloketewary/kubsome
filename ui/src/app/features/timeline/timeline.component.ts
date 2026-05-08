import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [TagModule, ButtonModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Timeline</h1>
        <p class="subtitle">Cluster activity over the last hour</p>
      </div>
      <button pButton icon="pi pi-refresh" label="Refresh" class="p-button-outlined p-button-sm" (click)="load()"></button>
    </div>

    <div class="timeline">
      @for (event of events; track $index) {
        <div class="tl-item">
          <div class="tl-marker">
            <div class="tl-dot" [class]="'dot-' + eventSeverity(event)"></div>
            <div class="tl-line"></div>
          </div>
          <div class="tl-content">
            <div class="tl-header">
              <span class="tl-time">{{ event.time || event.last_seen || '' }}</span>
              <p-tag [value]="event.reason || event.type || 'event'" [severity]="tagSeverity(event)" [rounded]="true" />
            </div>
            <div class="tl-body">
              <span class="tl-object">{{ event.object || event.name || '' }}</span>
              <span class="tl-message">{{ event.message || '' }}</span>
            </div>
          </div>
        </div>
      }
      @if (events.length === 0) {
        <div class="empty-state">No timeline events in the last hour</div>
      }
    </div>
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

    .timeline { position: relative; padding-left: 24px; }
    .tl-item { display: flex; gap: 16px; margin-bottom: 4px; }
    .tl-marker {
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
    }
    .tl-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      z-index: 1;
      flex-shrink: 0;
    }
    .dot-info { background: var(--accent); }
    .dot-warn { background: var(--warning); }
    .dot-danger { background: var(--danger); box-shadow: 0 0 6px var(--danger); }
    .dot-success { background: var(--success); }
    .tl-line {
      width: 2px;
      flex: 1;
      background: var(--border);
      min-height: 32px;
    }
    .tl-content {
      flex: 1;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 8px;
    }
    .tl-item:last-child .tl-content { border-bottom: none; }
    .tl-item:last-child .tl-line { display: none; }
    .tl-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .tl-time {
      font-size: 11px;
      font-family: 'JetBrains Mono', monospace;
      color: var(--text-muted);
    }
    .tl-body { display: flex; flex-direction: column; gap: 2px; }
    .tl-object { font-size: 13px; font-weight: 500; }
    .tl-message { font-size: 12px; color: var(--text-secondary); }
    .empty-state { text-align: center; padding: 48px; color: var(--text-muted); font-size: 13px; }
  `],
})
export class TimelineComponent implements OnInit {
  private http = inject(HttpClient);
  events: any[] = [];

  ngOnInit() { this.load(); }

  load() {
    this.http.get<any>('http://localhost:8000/api/timeline?minutes=60').subscribe(res => {
      this.events = res.events || [];
    });
  }

  eventSeverity(event: any): string {
    if (event.type === 'Warning' || event.severity === 'warning') return 'warn';
    if (event.severity === 'critical') return 'danger';
    if (event.reason === 'Started' || event.reason === 'Created') return 'success';
    return 'info';
  }

  tagSeverity(event: any): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const s = this.eventSeverity(event);
    if (s === 'warn') return 'warn';
    if (s === 'danger') return 'danger';
    if (s === 'success') return 'success';
    return 'info';
  }
}
