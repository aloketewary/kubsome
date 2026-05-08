import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Select } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { ApiService } from './core/services/api.service';
import { LoadingService } from './core/services/loading.service';
import { ShellComponent } from './layout/shell.component';
import { CommandPaletteComponent } from './shared/components/command-palette.component';
import { AiFloatComponent } from './shared/components/ai-float.component';
import { ToastAlertsComponent } from './shared/components/toast-alerts.component';
import { BreadcrumbComponent } from './shared/components/breadcrumb.component';
import { ConnectionStatusComponent } from './shared/components/connection-status.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Select, FormsModule, ShellComponent, CommandPaletteComponent, AiFloatComponent, ToastAlertsComponent, BreadcrumbComponent, ConnectionStatusComponent],
  template: `
    <!-- Global loading bar -->
    @if (loadingService.loading()) {
      <div class="loading-bar"><div class="loading-bar-inner"></div></div>
    }

    <!-- Command Palette -->
    <app-command-palette />

    <!-- Topbar -->
    <header class="topbar">
      <div class="topbar-left">
        <div class="logo">
          <span class="logo-icon">◆</span>
          <span class="logo-text">KubeEasy</span>
        </div>
        <div class="topbar-divider"></div>
        <div class="cluster-badge" [class]="'health-' + clusterHealth">
          <span class="health-dot"></span>
          <span class="cluster-name">{{ currentContext }}</span>
        </div>
      </div>

      <div class="topbar-center">
        <button class="cmd-k-btn" (click)="openPalette()">
          <i class="pi pi-search"></i>
          <span>Search...</span>
          <kbd>⌘K</kbd>
        </button>
      </div>

      <div class="topbar-right">
        <p-select
          [options]="namespaces"
          [(ngModel)]="currentNamespace"
          (onChange)="onNamespaceChange($event.value)"
          placeholder="Namespace"
          [style]="{ width: '160px' }"
        />
        @if (anomalyCount > 0) {
          <button class="notif-btn" title="Anomalies detected">
            <i class="pi pi-bell"></i>
            <span class="notif-badge">{{ anomalyCount }}</span>
          </button>
        }
      </div>
    </header>

    <!-- Connection Status -->
    <app-connection-status />

    <!-- Toast Alerts -->
    <app-toast-alerts />

    <!-- Floating AI -->
    <app-ai-float />

    <!-- Layout -->
    <div class="layout">
      <aside class="sidebar">
        <app-shell />
      </aside>
      <main class="content">
        <app-breadcrumb />
        <router-outlet />
      </main>
    </div>

    <!-- Status Bar -->
    <footer class="status-bar">
      <div class="status-left">
        <span class="status-dot connected"></span>
        <span>API Connected</span>
      </div>
      <div class="status-right">
        <span class="shortcut-hint">⌘K Search</span>
        <span class="shortcut-hint">G+D Dashboard</span>
        <span class="shortcut-hint">H Help</span>
      </div>
    </footer>
  `,
  styles: [`
    .loading-bar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      z-index: 99999;
      overflow: hidden;
    }
    .loading-bar-inner {
      height: 100%;
      width: 40%;
      background: var(--accent);
      border-radius: 2px;
      animation: loading-slide 1s ease-in-out infinite;
    }
    @keyframes loading-slide {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(350%); }
    }

    .topbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 52px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      background: var(--bg-card);
      border-bottom: 1px solid var(--border);
      z-index: 1000;
    }
    .topbar-left, .topbar-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .topbar-center {
      flex: 1;
      display: flex;
      justify-content: center;
      max-width: 400px;
      margin: 0 auto;
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .logo-icon { font-size: 18px; color: var(--accent); }
    .logo-text { font-size: 15px; font-weight: 700; letter-spacing: -0.03em; }
    .topbar-divider {
      width: 1px;
      height: 20px;
      background: var(--border);
    }

    /* Cluster health badge */
    .cluster-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      background: var(--bg-elevated);
      border: 1px solid var(--border);
    }
    .health-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
    }
    .health-healthy .health-dot { background: var(--success); box-shadow: 0 0 6px var(--success); }
    .health-degraded .health-dot { background: var(--warning); box-shadow: 0 0 6px var(--warning); }
    .health-critical .health-dot { background: var(--danger); box-shadow: 0 0 6px var(--danger); }
    .cluster-name { color: var(--text-secondary); }

    /* Command palette trigger */
    .cmd-k-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 7px 12px;
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text-muted);
      font-size: 13px;
      cursor: pointer;
      transition: border-color 0.15s;
    }
    .cmd-k-btn:hover {
      border-color: var(--border-hover);
      color: var(--text-secondary);
    }
    .cmd-k-btn i { font-size: 13px; }
    .cmd-k-btn span { flex: 1; text-align: left; }
    .cmd-k-btn kbd {
      font-size: 10px;
      padding: 2px 5px;
      border-radius: 4px;
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--text-muted);
      font-family: inherit;
    }

    /* Notification bell */
    .notif-btn {
      position: relative;
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: 16px;
      cursor: pointer;
      padding: 6px;
      border-radius: 6px;
      transition: all 0.15s;
    }
    .notif-btn:hover { background: var(--bg-hover); color: var(--text); }
    .notif-badge {
      position: absolute;
      top: 0;
      right: 0;
      font-size: 9px;
      font-weight: 700;
      background: var(--danger);
      color: #fff;
      width: 15px;
      height: 15px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .layout {
      display: flex;
      padding-top: 52px;
      height: 100vh;
    }
    .sidebar {
      width: 220px;
      flex-shrink: 0;
      border-right: 1px solid var(--border);
      overflow-y: auto;
      background: var(--bg-card);
      padding: 12px 8px;
    }
    .content {
      flex: 1;
      padding: 32px;
      padding-bottom: 56px;
      overflow-y: auto;
      background: var(--bg);
    }

    .status-bar {
      position: fixed;
      bottom: 0;
      left: 220px;
      right: 0;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      background: var(--bg-card);
      border-top: 1px solid var(--border);
      font-size: 11px;
      color: var(--text-muted);
      z-index: 100;
    }
    .status-left, .status-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }
    .status-dot.connected {
      background: var(--success);
      box-shadow: 0 0 4px var(--success);
    }
    .shortcut-hint {
      padding: 1px 6px;
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: 3px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
    }
  `],
})
export class AppComponent implements OnInit {
  private api = inject(ApiService);
  loadingService = inject(LoadingService);

  namespaces: string[] = [];
  currentNamespace = '';
  currentContext = '...';
  clusterHealth: 'healthy' | 'degraded' | 'critical' = 'healthy';
  anomalyCount = 0;

  ngOnInit() {
    this.api.getNamespaces().subscribe(res => {
      this.namespaces = res.namespaces;
      this.currentNamespace = res.current;
    });

    this.api.getContexts().subscribe(res => {
      this.currentContext = res.current ?? '...';
    });

    // Determine cluster health from overview
    this.api.getOverview().subscribe(res => {
      if ((res.pods.critical ?? 0) > 0 || res.nodes.warning > 0) {
        this.clusterHealth = 'critical';
      } else if ((res.pods.warning ?? 0) > 0 || (res.deployments.unavailable ?? 0) > 0) {
        this.clusterHealth = 'degraded';
      } else {
        this.clusterHealth = 'healthy';
      }
    });

    // Check anomalies for notification badge
    this.api.anomalies().subscribe(res => {
      this.anomalyCount = (res.alerts || []).length;
    });
  }

  onNamespaceChange(ns: string) {
    this.api.switchNamespace(ns).subscribe(() => {
      this.currentNamespace = ns;
      window.location.reload();
    });
  }

  openPalette() {
    // Trigger Cmd+K programmatically
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
  }
}
