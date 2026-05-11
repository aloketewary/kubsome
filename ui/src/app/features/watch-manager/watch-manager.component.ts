import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SpotlightComponent } from '../../shared/components/spotlight.component';

@Component({
  selector: 'app-watch-manager',
  standalone: true,
  imports: [ButtonModule, TagModule, SpotlightComponent],
  template: `
    <app-spotlight id="watch-manager" title="Watch Manager" icon="pi pi-eye"
      description="Manage background watchers that trigger alerts."
      [capabilities]="['Condition monitoring', 'Crash detection', 'Alert notifications']" [compact]="true" />

        <div class="page-header">
      <div>
        <h1>Watch Manager</h1>
        <p class="subtitle">Background condition monitors</p>
      </div>
      <button pButton icon="pi pi-refresh" class="p-button-outlined p-button-sm p-button-rounded" (click)="refresh()"></button>
    </div>

    @if (status) {
      <div class="status-bar-info">
        <span class="status-dot" [class.dot-on]="status.running" [class.dot-off]="!status.running"></span>
        <span>{{ status.running ? 'Monitoring active' : 'Monitoring stopped' }}</span>
        <span class="watch-count">{{ status.watches.length }} watch(es)</span>
      </div>

      @if (status.watches.length > 0) {
        <div class="watch-list">
          @for (watch of status.watches; track watch.name) {
            <div class="watch-card" [class.watch-triggered]="watch.triggered">
              <div class="watch-left">
                <span class="watch-icon" [class.icon-ok]="!watch.triggered" [class.icon-alert]="watch.triggered">
                  <i class="pi" [class.pi-check-circle]="!watch.triggered" [class.pi-bell]="watch.triggered"></i>
                </span>
              </div>
              <div class="watch-body">
                <span class="watch-name">{{ watch.name }}</span>
                <span class="watch-meta">
                  @if (watch.triggered) {
                    <p-tag value="TRIGGERED" severity="danger" [rounded]="true" />
                  } @else {
                    <p-tag value="OK" severity="success" [rounded]="true" />
                  }
                  · {{ watch.alert_count }} alert(s)
                </span>
              </div>
              @if (watch.last_check) {
                <span class="watch-time">{{ formatTime(watch.last_check) }}</span>
              }
            </div>
          }
        </div>
      } @else {
        <div class="empty">
          <i class="pi pi-eye"></i>
          <p>No active watches</p>
          <span class="empty-hint">Add a watch using the CLI:</span>
          <div class="cmd-examples">
            <code>watch-alert payment crash</code>
            <code>watch-alert billing restart</code>
            <code>watch-alert gateway count</code>
          </div>
          <span class="empty-hint">Watches monitor in background and send desktop notifications</span>
        </div>
      }
    } @else {
      <div class="loading"><div class="spin"></div> Loading...</div>
    }
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

    .status-bar-info {
      display: flex; align-items: center; gap: 8px; margin-bottom: 16px;
      padding: 10px 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-sm);
      font-size: 12px;
    }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; }
    .dot-on { background: var(--success); box-shadow: 0 0 4px var(--success); }
    .dot-off { background: var(--text-muted); }
    .watch-count { margin-left: auto; color: var(--text-muted); }

    .watch-list { display: flex; flex-direction: column; gap: 8px; }
    .watch-card {
      display: flex; align-items: center; gap: 12px;
      padding: 14px 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
      transition: border-color 0.12s;
    }
    .watch-card:hover { border-color: var(--border-hover); }
    .watch-triggered { border-left: 3px solid var(--danger); }
    .watch-icon { font-size: 18px; }
    .icon-ok { color: var(--success); }
    .icon-alert { color: var(--danger); }
    .watch-body { flex: 1; display: flex; flex-direction: column; gap: 4px; }
    .watch-name { font-size: 13px; font-weight: 600; }
    .watch-meta { font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 6px; }
    .watch-time { font-size: 10px; color: var(--text-muted); }

    .empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 60px; color: var(--text-muted); }
    .empty i { font-size: 28px; opacity: 0.3; }
    .empty-hint { font-size: 12px; }
    .cmd-examples { display: flex; flex-direction: column; gap: 4px; margin: 8px 0; }
    .cmd-examples code { background: var(--bg-elevated); padding: 6px 12px; border-radius: 6px; font-size: 11px; border: 1px solid var(--border); }
    .loading { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 60px; color: var(--text-muted); }
    .spin { width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class WatchManagerComponent implements OnInit {
  private http = inject(HttpClient);
  status: any = null;

  ngOnInit() { this.refresh(); }

  refresh() {
    this.http.get<any>('/api/watch-status').subscribe({
      next: (res) => (this.status = res),
      error: () => (this.status = { running: false, watches: [] }),
    });
  }

  formatTime(ts: number): string {
    return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
