import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-connection-status',
  standalone: true,
  imports: [ButtonModule],
  template: `
    @if (!connected) {
      <div class="disconnect-overlay">
        <div class="disconnect-modal">
          <div class="dc-icon">
            <div class="dc-ring"></div>
            <i class="pi pi-wifi-off"></i>
          </div>
          <h2>Connection Lost</h2>
          <p class="dc-message">Unable to reach the Kubsome API server.</p>

          <div class="dc-details">
            <div class="dc-row">
              <i class="pi pi-server"></i>
              <span>Server: <code>localhost:8000</code></span>
            </div>
            <div class="dc-row">
              <i class="pi pi-clock"></i>
              <span>Last connected: {{ lastConnectedTime }}</span>
            </div>
            <div class="dc-row">
              <i class="pi pi-replay"></i>
              <span>Retrying in {{ retryCountdown }}s...</span>
            </div>
          </div>

          <div class="dc-suggestions">
            <h4>Troubleshooting</h4>
            <ul>
              <li>Check if <code>kubsome serve</code> is running</li>
              <li>Verify port 8000 is not blocked</li>
              <li>Restart with <code>kubsome serve</code></li>
              <li>Check terminal for error output</li>
            </ul>
          </div>

          <div class="dc-actions">
            <button pButton label="Retry Now" icon="pi pi-refresh" class="p-button-sm" (click)="retryNow()" [loading]="retrying"></button>
            <button pButton label="Reload Page" icon="pi pi-sync" class="p-button-sm p-button-outlined" (click)="reload()"></button>
          </div>

          @if (retryAttempts > 0) {
            <span class="dc-attempts">{{ retryAttempts }} retry attempts</span>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .disconnect-overlay {
      position: fixed; inset: 0; z-index: 999999;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center;
      animation: fadeIn 0.3s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .disconnect-modal {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 24px; padding: 40px 48px;
      max-width: 420px; width: 90vw;
      display: flex; flex-direction: column; align-items: center;
      text-align: center;
      box-shadow: 0 32px 80px rgba(0, 0, 0, 0.5);
      animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    .dc-icon {
      position: relative;
      width: 72px; height: 72px;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 20px;
    }
    .dc-icon i { font-size: 28px; color: var(--danger); z-index: 1; }
    .dc-ring {
      position: absolute; inset: 0; border-radius: 50%;
      border: 3px solid var(--danger);
      opacity: 0.3;
      animation: ringPulse 2s ease-in-out infinite;
    }
    @keyframes ringPulse {
      0%, 100% { transform: scale(1); opacity: 0.3; }
      50% { transform: scale(1.15); opacity: 0.1; }
    }

    h2 { font-size: 22px; font-weight: 800; margin: 0 0 8px; letter-spacing: -0.03em; }
    .dc-message { font-size: 14px; color: var(--text-secondary); margin: 0 0 24px; }

    .dc-details {
      width: 100%; padding: 14px 18px;
      background: var(--bg-elevated); border-radius: 12px;
      margin-bottom: 20px;
      display: flex; flex-direction: column; gap: 8px;
    }
    .dc-row {
      display: flex; align-items: center; gap: 10px;
      font-size: 12px; color: var(--text-secondary);
    }
    .dc-row i { font-size: 13px; color: var(--text-muted); width: 16px; }
    .dc-row code {
      font-family: 'JetBrains Mono', monospace; font-size: 11px;
      background: var(--bg-card); padding: 1px 6px; border-radius: 4px;
    }

    .dc-suggestions {
      width: 100%; text-align: left; margin-bottom: 24px;
    }
    .dc-suggestions h4 {
      font-size: 11px; font-weight: 700; color: var(--text-muted);
      text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 8px;
    }
    .dc-suggestions ul {
      margin: 0; padding: 0 0 0 16px;
      font-size: 12px; color: var(--text-secondary); line-height: 1.8;
    }
    .dc-suggestions code {
      font-family: 'JetBrains Mono', monospace; font-size: 11px;
      background: var(--bg-elevated); padding: 1px 5px; border-radius: 3px;
    }

    .dc-actions { display: flex; gap: 10px; margin-bottom: 12px; }
    .dc-attempts { font-size: 10px; color: var(--text-muted); }
  `],
})
export class ConnectionStatusComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  connected = true;
  retrying = false;
  retryCountdown = 10;
  retryAttempts = 0;
  lastConnectedTime = '';
  private interval: any;
  private countdownInterval: any;

  ngOnInit() {
    this.lastConnectedTime = new Date().toLocaleTimeString();
    this.checkConnection();
    this.interval = setInterval(() => this.checkConnection(), 10000);
    this.countdownInterval = setInterval(() => {
      if (!this.connected && this.retryCountdown > 0) {
        this.retryCountdown--;
      }
    }, 1000);
  }

  ngOnDestroy() {
    clearInterval(this.interval);
    clearInterval(this.countdownInterval);
  }

  checkConnection() {
    this.http.get('/api/health').subscribe({
      next: () => {
        this.connected = true;
        this.retryAttempts = 0;
        this.lastConnectedTime = new Date().toLocaleTimeString();
      },
      error: () => {
        if (this.connected) {
          this.lastConnectedTime = new Date().toLocaleTimeString();
        }
        this.connected = false;
        this.retryCountdown = 10;
        this.retrying = false;
      },
    });
  }

  retryNow() {
    this.retrying = true;
    this.retryAttempts++;
    this.checkConnection();
  }

  reload() {
    window.location.reload();
  }
}
