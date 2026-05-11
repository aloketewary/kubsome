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
          <span class="offline-title">▲ API Disconnected</span>
          <span class="offline-detail">Cannot reach localhost:8000</span>
        </div>
      </div>
    }
  `,
  styles: [`
    .offline-banner {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 99999;
      background: var(--danger);
      padding: 8px 20px;
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
      justify-content: center;
    }
    .offline-content > i {
      font-size: 16px;
      color: #fff;
    }
    .offline-title {
      font-size: 13px;
      font-weight: 700;
      color: #fff;
    }
    .offline-detail {
      font-size: 11px;
      color: rgba(255,255,255,0.8);
    }
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
    this.http.get('/api/health').subscribe({
      next: () => (this.connected = true),
      error: () => (this.connected = false),
    });
  }
}
