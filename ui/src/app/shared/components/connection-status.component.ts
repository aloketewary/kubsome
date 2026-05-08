import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-connection-status',
  standalone: true,
  imports: [ButtonModule],
  template: `
    @if (!connected) {
      <div class="offline-banner">
        <div class="offline-content">
          <i class="pi pi-wifi-off"></i>
          <div class="offline-text">
            <span class="offline-title">API Disconnected</span>
            <span class="offline-detail">Cannot reach localhost:8000 — retrying...</span>
          </div>
          <button pButton label="Retry Now" icon="pi pi-refresh" class="p-button-sm" (click)="checkConnection()"></button>
        </div>
      </div>
    }
  `,
  styles: [`
    .offline-banner {
      position: fixed;
      top: 52px;
      left: 220px;
      right: 0;
      z-index: 5000;
      background: var(--danger-subtle);
      border-bottom: 1px solid var(--danger);
      padding: 10px 20px;
      animation: slideDown 0.2s ease-out;
    }
    @keyframes slideDown {
      from { transform: translateY(-100%); }
      to { transform: translateY(0); }
    }
    .offline-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .offline-content > i {
      font-size: 18px;
      color: var(--danger);
    }
    .offline-text {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .offline-title { font-size: 13px; font-weight: 600; color: var(--danger); }
    .offline-detail { font-size: 11px; color: var(--text-secondary); }
  `],
})
export class ConnectionStatusComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  connected = true;
  private interval: any;

  ngOnInit() {
    this.checkConnection();
    this.interval = setInterval(() => this.checkConnection(), 10000);
  }

  ngOnDestroy() {
    clearInterval(this.interval);
  }

  checkConnection() {
    this.http.get('http://localhost:8000/health').subscribe({
      next: () => (this.connected = true),
      error: () => (this.connected = false),
    });
  }
}
