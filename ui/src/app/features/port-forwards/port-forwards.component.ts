import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SpotlightComponent } from '../../shared/components/spotlight.component';

@Component({
  selector: 'app-port-forwards',
  standalone: true,
  imports: [ButtonModule, TagModule, FormsModule, SpotlightComponent],
  template: `
    <app-spotlight id="port-forwards" title="Port Forwards" icon="pi pi-link"
      description="Manage background port-forwards — start, stop, and monitor."
      [capabilities]="['Background forwarding', 'Health monitoring', 'Persistent across sessions']" [compact]="true" />

    <div class="page-header">
      <div>
        <h1>Port Forwards</h1>
        <p class="subtitle">{{ forwards.length }} active</p>
      </div>
      <div class="header-actions">
        <button pButton icon="pi pi-stop" label="Stop All" class="p-button-outlined p-button-sm p-button-danger" (click)="stopAll()" [disabled]="!forwards.length"></button>
        <button pButton icon="pi pi-refresh" class="p-button-outlined p-button-sm p-button-rounded" (click)="refresh()"></button>
      </div>
    </div>

    <!-- New Forward Form -->
    <div class="new-forward">
      <input [(ngModel)]="newTarget" placeholder="Pod or service name" class="pf-input" />
      <input [(ngModel)]="newLocalPort" placeholder="Local port" type="number" class="pf-input port" />
      <span class="pf-arrow">:</span>
      <input [(ngModel)]="newRemotePort" placeholder="Remote port" type="number" class="pf-input port" />
      <button pButton icon="pi pi-play" label="Start" class="p-button-sm" (click)="startForward()" [disabled]="!newTarget || !newLocalPort"></button>
    </div>

    <!-- Active Forwards -->
    @if (forwards.length) {
      <div class="forwards-list">
        @for (fwd of forwards; track fwd.key) {
          <div class="forward-row" [class.dead]="!fwd.alive">
            <div class="fwd-status">
              @if (fwd.alive) { <i class="pi pi-check-circle status-ok"></i> }
              @else { <i class="pi pi-times-circle status-dead"></i> }
            </div>
            <div class="fwd-info">
              <strong>{{ fwd.target }}</strong>
              <span class="fwd-ports">localhost:{{ fwd.local_port }} → :{{ fwd.remote_port }}</span>
            </div>
            <div class="fwd-meta">
              <span class="fwd-ns">{{ fwd.namespace }}</span>
              <span class="fwd-pid">pid:{{ fwd.pid }}</span>
              <span class="fwd-since">{{ fwd.started?.substring(11, 16) }}</span>
            </div>
            <div class="fwd-actions">
              <a [href]="fwd.url" target="_blank" class="fwd-link" pTooltip="Open in browser">
                <i class="pi pi-external-link"></i>
              </a>
              <button pButton icon="pi pi-stop" class="p-button-text p-button-sm p-button-danger" (click)="stopForward(fwd.target)" pTooltip="Stop"></button>
            </div>
          </div>
        }
      </div>
    } @else {
      <div class="empty-state">
        <i class="pi pi-link"></i>
        <h3>No Active Forwards</h3>
        <p>Start a port-forward above or use: <code>pf &lt;pod&gt; &lt;port&gt;</code></p>
      </div>
    }
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
    .page-header h1 { font-size: 24px; font-weight: 700; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .header-actions { display: flex; gap: 8px; }
    .new-forward { display: flex; align-items: center; gap: 8px; padding: 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 16px; }
    .pf-input { padding: 8px 12px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg-elevated); color: var(--text-primary); font-size: 13px; }
    .pf-input:focus { border-color: var(--accent); outline: none; }
    .pf-input.port { width: 80px; }
    .pf-arrow { color: var(--text-muted); font-weight: 700; }
    .forwards-list { display: flex; flex-direction: column; gap: 6px; }
    .forward-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); transition: all 0.15s; }
    .forward-row:hover { border-color: var(--accent); }
    .forward-row.dead { opacity: 0.5; border-color: var(--danger); }
    .fwd-status i { font-size: 16px; }
    .status-ok { color: var(--success); }
    .status-dead { color: var(--danger); }
    .fwd-info { flex: 1; display: flex; flex-direction: column; }
    .fwd-ports { font-size: 12px; color: var(--text-muted); font-family: 'JetBrains Mono', monospace; }
    .fwd-meta { display: flex; gap: 10px; font-size: 11px; color: var(--text-muted); }
    .fwd-actions { display: flex; gap: 4px; }
    .fwd-link { color: var(--accent); padding: 4px; }
    .empty-state { text-align: center; padding: 60px; color: var(--text-muted); }
    .empty-state i { font-size: 48px; opacity: 0.3; margin-bottom: 16px; }
    .empty-state code { background: var(--bg-elevated); padding: 2px 6px; border-radius: 4px; font-size: 12px; }
    @media (max-width: 768px) {
      .new-forward { flex-wrap: wrap; }
      .pf-input { width: 100%; }
      .pf-input.port { width: 100%; }
      .forward-row { flex-wrap: wrap; gap: 8px; }
      .fwd-meta { width: 100%; }
    }
  `],
})
export class PortForwardsComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  forwards: any[] = [];
  newTarget = '';
  newLocalPort: number | null = null;
  newRemotePort: number | null = null;
  private timer: any;

  ngOnInit() { this.refresh(); this.timer = setInterval(() => this.refresh(), 10000); }
  ngOnDestroy() { clearInterval(this.timer); }

  refresh() {
    this.http.get<any>('/api/port-forwards').subscribe({
      next: (res) => { this.forwards = res.forwards || []; },
    });
  }

  startForward() {
    const body = {
      target: this.newTarget,
      local_port: this.newLocalPort,
      remote_port: this.newRemotePort || this.newLocalPort,
    };
    this.http.post<any>('/api/port-forwards/start', body).subscribe({
      next: (res) => {
        if (res.success) { this.newTarget = ''; this.newLocalPort = null; this.newRemotePort = null; this.refresh(); }
        else { alert(res.message); }
      },
    });
  }

  stopForward(target: string) {
    this.http.post<any>('/api/port-forwards/stop', { target }).subscribe({
      next: () => { this.refresh(); },
    });
  }

  stopAll() {
    this.http.post<any>('/api/port-forwards/stop-all', {}).subscribe({
      next: () => { this.refresh(); },
    });
  }
}
