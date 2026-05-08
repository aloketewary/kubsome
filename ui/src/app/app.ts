import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Select } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { ApiService } from './core/services/api.service';
import { LoadingService } from './core/services/loading.service';
import { PreferencesService } from './core/services/preferences.service';
import { ShellComponent } from './layout/shell.component';
import { CommandPaletteComponent } from './shared/components/command-palette.component';
import { AiFloatComponent } from './shared/components/ai-float.component';
import { ToastAlertsComponent } from './shared/components/toast-alerts.component';
import { BreadcrumbComponent } from './shared/components/breadcrumb.component';
import { ConnectionStatusComponent } from './shared/components/connection-status.component';
import { ErrorToastComponent } from './shared/components/error-toast.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Select, FormsModule, ShellComponent, CommandPaletteComponent, AiFloatComponent, ToastAlertsComponent, BreadcrumbComponent, ConnectionStatusComponent, ErrorToastComponent],
  template: `
    <!-- Connection Status (top-most) -->
    <app-connection-status />

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
          <span class="logo-text">Kubsome</span>
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
        <div class="scope-selector">
          <div class="scope-item">
            <span class="scope-dot" [class]="'dot-' + clusterHealth"></span>
            <span class="scope-key">cluster</span>
            <p-select
              [options]="contexts"
              [(ngModel)]="currentContext"
              (ngModelChange)="onContextChange($event)"
              [filter]="true"
              filterPlaceholder="Search..."
              [style]="{ width: 'auto', minWidth: '120px', maxWidth: '250px', border: 'none', background: 'transparent' }"
            />
          </div>
          <span class="scope-sep">/</span>
          <div class="scope-item">
            <span class="scope-key">ns</span>
            <p-select
              [options]="namespaces"
              [(ngModel)]="currentNamespace"
              (ngModelChange)="onNamespaceChange($event)"
              placeholder="namespace"
              [filter]="true"
              filterPlaceholder="Search..."
              [style]="{ width: 'auto', minWidth: '100px', maxWidth: '200px', border: 'none', background: 'transparent' }"
            />
          </div>
        </div>
        @if (anomalyCount > 0) {
          <button class="notif-btn" title="Anomalies detected" (click)="showNotifications = !showNotifications">
            <i class="pi pi-bell"></i>
            <span class="notif-badge">{{ anomalyCount }}</span>
          </button>
        }
        @if (showNotifications) {
          <div class="notif-panel">
            <div class="notif-header">
              <span>Alerts ({{ anomalyCount }})</span>
              <div class="notif-actions">
                @if (anomalies.length > 0) {
                  <button class="notif-clear" (click)="clearAllNotifications()">Clear all</button>
                }
                <button class="notif-close" (click)="showNotifications = false"><i class="pi pi-times"></i></button>
              </div>
            </div>
            <div class="notif-list">
              @for (alert of anomalies; track $index) {
                <div class="notif-item">
                  <i class="pi pi-exclamation-triangle notif-icon"></i>
                  <div class="notif-body">
                    <span class="notif-title">{{ alert.title || alert.type || 'Alert' }}</span>
                    <span class="notif-desc">{{ alert.message || alert.detail || '' }}</span>
                  </div>
                  <button class="notif-dismiss" (click)="dismissNotification($index)"><i class="pi pi-times"></i></button>
                </div>
              }
              @if (anomalies.length === 0) {
                <div class="notif-empty"><i class="pi pi-check-circle"></i> All clear — no alerts</div>
              }
            </div>
          </div>
        }
      </div>
    </header>

    <!-- Error Toasts -->
    <app-error-toast />

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
        <span class="shortcut-hint">Made in India</span>
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
      height: 48px;
      display: flex;
      align-items: center;
      padding: 0 12px;
      background: var(--bg-card);
      border-bottom: 1px solid var(--border);
      z-index: 1000;
      gap: 8px;
    }
    .topbar-left {
      display: flex;
      align-items: center;
    }
    .topbar-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .topbar-center {
      flex: 1;
      display: flex;
      justify-content: center;
      max-width: 320px;
      margin: 0 auto;
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .logo-icon { font-size: 16px; color: var(--accent); }
    .logo-text { font-size: 14px; font-weight: 700; letter-spacing: -0.03em; }

    /* Scope selector: cluster / namespace as breadcrumb path */
    .scope-selector {
      display: flex;
      align-items: center;
      padding: 2px 4px;
      // background: var(--bg-elevated);
      // border: 1px solid var(--border);
      // border-radius: 8px;
      gap: 1px;
    }
    .scope-selector .p-select-label {
      overflow: visible !important;
      text-overflow: unset !important;
      white-space: nowrap !important;
    }
    .scope-item {
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .scope-dot {
      width: 6px; height: 6px; border-radius: 50%;
    }
    .scope-dot.dot-healthy { background: var(--success); box-shadow: 0 0 4px var(--success); }
    .scope-dot.dot-degraded { background: var(--warning); box-shadow: 0 0 4px var(--warning); }
    .scope-dot.dot-critical { background: var(--danger); box-shadow: 0 0 4px var(--danger); }
    .scope-key {
      font-size: 9px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .scope-sep {
      font-size: 14px;
      color: var(--border-hover);
      margin: 0 1px;
    }

    /* Cluster health badge */
    .cluster-badge {
      display: flex;
      align-items: center;
      gap: 2px;
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

    .notif-panel {
      position: absolute; top: 48px; right: 12px;
      width: 320px; max-height: 400px;
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: var(--radius); box-shadow: 0 12px 40px rgba(0,0,0,0.5);
      z-index: 2000; display: flex; flex-direction: column; overflow: hidden;
    }
    .notif-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px; border-bottom: 1px solid var(--border);
      font-size: 13px; font-weight: 600;
    }
    .notif-close { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; border-radius: 4px; }
    .notif-close:hover { background: var(--bg-hover); color: var(--text); }
    .notif-list { overflow-y: auto; max-height: 340px; }
    .notif-item {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 10px 16px; border-bottom: 1px solid var(--border);
      transition: background 0.1s;
    }
    .notif-item:hover { background: var(--bg-hover); }
    .notif-item:last-child { border-bottom: none; }
    .notif-icon { color: var(--warning); font-size: 14px; margin-top: 2px; }
    .notif-body { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .notif-title { font-size: 12px; font-weight: 500; }
    .notif-desc { font-size: 11px; color: var(--text-muted); }
    .notif-actions { display: flex; align-items: center; gap: 6px; }
    .notif-clear {
      background: none; border: none; color: var(--accent); font-size: 11px;
      cursor: pointer; padding: 2px 6px; border-radius: 4px;
    }
    .notif-clear:hover { background: var(--accent-subtle); }
    .notif-dismiss {
      background: none; border: none; color: var(--text-muted); cursor: pointer;
      padding: 2px; border-radius: 3px; font-size: 10px; opacity: 0;
      transition: opacity 0.1s;
    }
    .notif-item:hover .notif-dismiss { opacity: 1; }
    .notif-dismiss:hover { color: var(--danger); }
    .notif-empty {
      padding: 24px; text-align: center; color: var(--text-muted); font-size: 12px;
      display: flex; align-items: center; justify-content: center; gap: 6px;
    }
    .notif-empty i { color: var(--success); }
    .layout {
      display: flex;
      padding-top: 48px;
      height: 100vh;
    }
    .sidebar {
      width: 200px;
      flex-shrink: 0;
      border-right: 1px solid var(--border);
      overflow-y: auto;
      background: var(--bg-card);
      padding: 8px 6px;
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
      left: 200px;
      right: 0;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 12px;
      background: var(--bg-card);
      border-top: 1px solid var(--border);
      font-size: 10px;
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
  private prefsService = inject(PreferencesService); // ensures prefs load on startup

  namespaces: string[] = [];
  contexts: string[] = [];
  currentNamespace = '';
  private initialNamespace = '';
  currentContext = '...';
  private initialContext = '';
  clusterHealth: 'healthy' | 'degraded' | 'critical' = 'healthy';
  anomalyCount = 0;
  showNotifications = false;
  anomalies: any[] = [];

  ngOnInit() {
    this.api.getNamespaces().subscribe(res => {
      this.namespaces = res.namespaces;
      this.currentNamespace = res.current;
      this.initialNamespace = res.current;
    });

    this.api.getContexts().subscribe(res => {
      this.currentContext = res.current ?? '...';
      this.initialContext = res.current ?? '';
      this.contexts = (res.contexts || []).map((c: any) => c.name);
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
      this.anomalies = res.alerts || [];
      this.anomalyCount = this.anomalies.length;
    });
  }

  onNamespaceChange(ns: string) {
    if (!ns || ns === this.initialNamespace) return;
    this.initialNamespace = ns;
    this.api.switchNamespace(ns).subscribe(() => {
      window.location.reload();
    });
  }

  onContextChange(ctx: string) {
    if (!ctx || ctx === this.initialContext) return;
    this.initialContext = ctx;
    this.api.switchContext(ctx).subscribe(() => {
      window.location.reload();
    });
  }

  clearAllNotifications() {
    this.anomalies = [];
    this.anomalyCount = 0;
  }

  dismissNotification(index: number) {
    this.anomalies.splice(index, 1);
    this.anomalyCount = this.anomalies.length;
  }

  openPalette() {
    // Trigger Cmd+K programmatically
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
  }
}
