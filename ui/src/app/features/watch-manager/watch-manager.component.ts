import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { SpotlightComponent } from '../../shared/components/spotlight.component';

@Component({
  selector: 'app-watch-manager',
  standalone: true,
  imports: [FormsModule, ButtonModule, TagModule, TooltipModule, SpotlightComponent],
  template: `
    <app-spotlight id="watch-manager" title="Watch Manager" icon="pi pi-eye"
      description="Manage background watchers that trigger alerts."
      [capabilities]="['Condition monitoring', 'Crash detection', 'Alert notifications']" [compact]="true" />

    <div class="page-header">
      <div>
        <h1>Watch Manager</h1>
        <p class="subtitle">Background condition monitors</p>
      </div>
      <div class="header-actions">
        <button pButton icon="pi pi-refresh" class="p-button-outlined p-button-sm p-button-rounded" (click)="refresh()" pTooltip="Refresh"></button>
        <button pButton icon="pi pi-plus" label="Add Watch" class="p-button-sm" (click)="showForm = !showForm"></button>
      </div>
    </div>

    <!-- Add Watch Form -->
    @if (showForm) {
      <div class="add-form">
        <div class="form-row">
          <div class="form-field">
            <label>App / Pod pattern</label>
            <input type="text" [(ngModel)]="newTarget" placeholder="e.g. payment, billing-api" class="form-input" />
          </div>
          <div class="form-field">
            <label>Condition</label>
            <div class="condition-pills">
              <button class="pill" [class.pill-active]="newCondition === 'crash'" (click)="newCondition = 'crash'">
                <i class="pi pi-times-circle"></i> Crash
              </button>
              <button class="pill" [class.pill-active]="newCondition === 'restart'" (click)="newCondition = 'restart'">
                <i class="pi pi-replay"></i> Restart > 5
              </button>
              <button class="pill" [class.pill-active]="newCondition === 'count'" (click)="newCondition = 'count'">
                <i class="pi pi-sort-amount-down"></i> Count < 1
              </button>
            </div>
          </div>
          <button pButton label="Create" icon="pi pi-check" class="p-button-sm form-submit"
                  [disabled]="!newTarget.trim()" (click)="createWatch()"></button>
        </div>
        @if (formError) {
          <div class="form-error"><i class="pi pi-exclamation-triangle"></i> {{ formError }}</div>
        }
      </div>
    }

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
              <button pButton icon="pi pi-trash" class="p-button-text p-button-sm p-button-rounded p-button-danger"
                      pTooltip="Remove watch" (click)="removeWatch(watch.name)"></button>
            </div>
          }
        </div>
      } @else {
        <div class="empty">
          <i class="pi pi-eye"></i>
          <p>No active watches</p>
          <span class="empty-hint">Click "Add Watch" to create a background monitor</span>
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
    .header-actions { display: flex; gap: 8px; }

    /* Add Form */
    .add-form {
      padding: 16px 18px; margin-bottom: 16px;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
    }
    .form-row { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
    .form-field { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 160px; }
    .form-field label { font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .form-input {
      padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px;
      background: var(--bg-elevated); color: var(--text); font-size: 13px; outline: none;
    }
    .form-input:focus { border-color: var(--accent); }
    .condition-pills { display: flex; gap: 6px; }
    .pill {
      display: flex; align-items: center; gap: 5px;
      padding: 7px 12px; border: 1px solid var(--border); border-radius: 6px;
      background: var(--bg-elevated); color: var(--text-muted); font-size: 12px;
      cursor: pointer; transition: all 0.12s;
    }
    .pill:hover { border-color: var(--border-hover); color: var(--text); }
    .pill-active { border-color: var(--accent); background: var(--accent-subtle); color: var(--accent); font-weight: 600; }
    .pill i { font-size: 12px; }
    .form-submit { align-self: flex-end; }
    .form-error { margin-top: 10px; font-size: 12px; color: var(--danger); display: flex; align-items: center; gap: 6px; }

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
    .loading { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 60px; color: var(--text-muted); }
    .spin { width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (max-width: 768px) {
      .page-header { flex-direction: column; gap: 12px; }
    }
  `],
})
export class WatchManagerComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  status: any = null;
  showForm = false;
  newTarget = '';
  newCondition: 'crash' | 'restart' | 'count' = 'crash';
  formError = '';
  private pollInterval: any;

  ngOnInit() {
    this.refresh();
    this.pollInterval = setInterval(() => this.refresh(), 15000);
  }

  ngOnDestroy() { clearInterval(this.pollInterval); }

  refresh() {
    this.http.get<any>('/api/watch-status').subscribe({
      next: (res) => (this.status = res),
      error: () => (this.status = { running: false, watches: [] }),
    });
  }

  createWatch() {
    const target = this.newTarget.trim();
    if (!target) return;
    this.formError = '';
    this.http.post<any>('/api/watch-alert', { target, condition: this.newCondition }).subscribe({
      next: () => {
        this.newTarget = '';
        this.showForm = false;
        this.refresh();
      },
      error: (err) => {
        this.formError = err.error?.detail || 'Failed to create watch';
      },
    });
  }

  removeWatch(name: string) {
    this.http.delete<any>(`/api/watch-alert/${name}`).subscribe({
      next: () => this.refresh(),
      error: () => this.refresh(),
    });
  }

  formatTime(ts: number): string {
    return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
