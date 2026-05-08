import { Component, inject, OnInit } from '@angular/core';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { ApiService } from '../../core/services/api.service';
import { KubeEvent } from '../../core/models';

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [TagModule, ButtonModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Events</h1>
        <p class="subtitle">{{ events.length }} recent events</p>
      </div>
      <button pButton icon="pi pi-refresh" label="Refresh" class="p-button-outlined p-button-sm" (click)="refresh()"></button>
    </div>

    <div class="event-list">
      @for (event of events; track $index) {
        <div class="event-item">
          <div class="event-type-badge" [class.warn]="event.type === 'Warning'" [class.info]="event.type !== 'Warning'">
            <i class="pi" [class.pi-exclamation-triangle]="event.type === 'Warning'" [class.pi-info-circle]="event.type !== 'Warning'"></i>
          </div>
          <div class="event-body">
            <div class="event-head">
              <span class="event-reason">{{ event.reason }}</span>
              <span class="event-object">{{ event.kind }}/{{ event.object }}</span>
            </div>
            <p class="event-message">{{ event.message }}</p>
          </div>
          @if (event.count > 1) {
            <span class="event-count">{{ event.count }}×</span>
          }
        </div>
      }

      @if (events.length === 0) {
        <div class="empty-state">
          <i class="pi pi-check-circle"></i>
          <span>No events</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 24px;
    }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .event-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .event-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      transition: border-color 0.15s;
    }
    .event-item:hover {
      border-color: var(--border-hover);
    }
    .event-type-badge {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 13px;
    }
    .event-type-badge.warn {
      background: var(--warning-subtle);
      color: var(--warning);
    }
    .event-type-badge.info {
      background: var(--accent-subtle);
      color: var(--accent);
    }
    .event-body {
      flex: 1;
      min-width: 0;
    }
    .event-head {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .event-reason {
      font-size: 13px;
      font-weight: 500;
      color: var(--text);
    }
    .event-object {
      font-size: 11px;
      font-family: 'JetBrains Mono', monospace;
      padding: 1px 6px;
      border-radius: 4px;
      background: var(--bg-elevated);
      color: var(--text-muted);
    }
    .event-message {
      font-size: 12px;
      color: var(--text-secondary);
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .event-count {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 10px;
      background: var(--bg-elevated);
      color: var(--text-muted);
      border: 1px solid var(--border);
      flex-shrink: 0;
    }
    .empty-state {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 48px;
      color: var(--text-muted);
      font-size: 13px;
    }
  `],
})
export class EventsComponent implements OnInit {
  private api = inject(ApiService);
  events: KubeEvent[] = [];

  refresh() {
    this.api.getEvents().subscribe(res => (this.events = res.events));
  }

  ngOnInit() {
    this.refresh();
  }
}
