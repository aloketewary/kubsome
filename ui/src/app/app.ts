import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
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
import { ConfirmDialogComponent } from './shared/components/confirm-dialog.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, Select, FormsModule, ShellComponent, CommandPaletteComponent, AiFloatComponent, ToastAlertsComponent, BreadcrumbComponent, ConnectionStatusComponent, ErrorToastComponent, ConfirmDialogComponent],
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
    <header class="topbar glass" [class.topbar-env-prod]="clusterEnv === 'prod'" [class.topbar-env-sit]="clusterEnv === 'sit'" [class.topbar-env-dev]="clusterEnv === 'dev'">
      <div class="topbar-left">
        <div class="workspace-label" (click)="dashMenuOpen = !dashMenuOpen">
          <i class="pi pi-th-large"></i>
          <span>{{ activeDashName || 'Workspace' }}</span>
          <i class="pi pi-chevron-down ws-chevron"></i>
        </div>
        @if (dashMenuOpen) {
          <div class="dash-menu" (mouseleave)="dashMenuOpen = false">
            @if (savedDashList.length > 0) {
              @for (d of savedDashList; track d.name) {
                <a class="dash-menu-item" [routerLink]="'/my-dashboard'" [queryParams]="{name: d.name}" (click)="selectDash(d); dashMenuOpen = false">
                  <i class="pi pi-th-large"></i>
                  <span>{{ d.name }}</span>
                  <span class="dm-count">{{ d.widgets.length }}</span>
                </a>
              }
              <div class="dash-menu-divider"></div>
            }
            <a class="dash-menu-item dash-menu-new" [routerLink]="'/my-dashboard'" (click)="dashMenuOpen = false">
              <i class="pi pi-plus"></i>
              <span>{{ savedDashList.length > 0 ? 'New Dashboard' : 'Create Custom Dashboard' }}</span>
            </a>
          </div>
        }
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
          <div class="notif-backdrop" (click)="showNotifications = false"></div>
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

    <!-- Confirm Dialog -->
    <app-confirm-dialog />

    <!-- Floating AI -->
    <app-ai-float />

    <!-- Layout -->
    <div class="layout" [class.sidebar-collapsed]="sidebarCollapsed">
      <aside class="sidebar" [class.rail]="sidebarCollapsed" [class.sidebar-env-prod]="clusterEnv === 'prod'" [class.sidebar-env-sit]="clusterEnv === 'sit'" [class.sidebar-env-dev]="clusterEnv === 'dev'">
        <app-shell [collapsed]="sidebarCollapsed" />
        <button class="collapse-toggle" (click)="toggleSidebar()">
          <i class="pi" [class.pi-chevron-left]="!sidebarCollapsed" [class.pi-chevron-right]="sidebarCollapsed"></i>
        </button>
      </aside>
      <main class="content">
        <div class="content-inner">
          <app-breadcrumb />
          <router-outlet />
        </div>
      </main>
    </div>

    <!-- Status Bar -->
    <footer class="status-bar">
      <div class="status-left">
        <span class="status-dot connected"></span>
        <span>{{ currentContext }}</span>
        <span class="status-sep">/</span>
        <span>{{ currentNamespace }}</span>
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
      left: 240px;
      right: 0;
      height: 56px;
      display: flex;
      align-items: center;
      padding: 0 24px;
      background: var(--bg-card);
      border-bottom: 1px solid var(--border);
      z-index: 1000;
      gap: 16px;
      box-sizing: border-box;
      transition: background 0.3s, border-color 0.3s;
    }
    .topbar-env-prod {
      background: linear-gradient(to top, rgb(239, 68, 68) 70.17%, #0f0f11) !important;
      border-bottom-color: rgba(239,68,68,0.3);
    }
    .topbar-env-sit {
      background: linear-gradient(to top, rgba(245, 158, 11, 0.08) 70.17%, #0f0f11) !important;
      border-bottom-color: #f59e0bff;
    }
    .topbar-env-dev {
      background: linear-gradient(to top, rgba(34,197,94,0.08) 70.17%, #0f0f11) !important;
      border-bottom-color: rgb(34, 197, 94);
    }
    .topbar-left {
      display: flex;
      align-items: center;
      min-width: 200px;
      position: relative;
    }
    .workspace-label {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--text-muted);
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      cursor: pointer;
      padding: 6px 10px;
      border-radius: 6px;
      transition: all 0.15s;
    }
    .workspace-label:hover { background: var(--bg-elevated); color: var(--text); }
    .ws-chevron { font-size: 10px; opacity: 0.5; }
    .workspace-label i {
      font-size: 14px;
      color: var(--accent);
    }
    .dash-menu {
      position: absolute; top: 100%; left: 0; margin-top: 4px;
      min-width: 220px; padding: 6px;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.3); z-index: 1000;
      animation: fadeDown 0.15s ease;
    }
    @keyframes fadeDown { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
    .dash-menu-item {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 12px; border-radius: 6px; font-size: 12px;
      color: var(--text-secondary); text-decoration: none; cursor: pointer;
      transition: all 0.12s;
    }
    .dash-menu-item:hover { background: var(--bg-elevated); color: var(--text); }
    .dash-menu-item i { font-size: 12px; color: var(--text-muted); }
    .dm-count { margin-left: auto; font-size: 10px; color: var(--text-muted); background: var(--bg-elevated); padding: 1px 6px; border-radius: 8px; }
    .dash-menu-divider { height: 1px; background: var(--border); margin: 4px 8px; }
    .dash-menu-new i { color: var(--accent); }
    .dash-menu-new:hover { color: var(--accent); }
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
      gap: 4px;
    }
    .scope-dot {
      width: 7px; height: 7px; border-radius: 50%;
    }
    .scope-dot.dot-healthy { background: var(--success); box-shadow: 0 0 4px var(--success); }
    .scope-dot.dot-degraded { background: var(--warning); box-shadow: 0 0 4px var(--warning); }
    .scope-dot.dot-critical { background: var(--danger); box-shadow: 0 0 4px var(--danger); }
    .scope-key {
      font-size: 10px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .scope-sep {
      font-size: 14px;
      color: var(--border-hover);
      margin: 0 2px;
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

    .notif-backdrop {
      position: fixed; inset: 0; z-index: 1999;
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
      height: 100vh;
    }
    .content {
      flex: 1;
      min-height: 100vh;
      background: var(--bg);
      padding-top: 56px;
      padding-bottom: 24px;
      box-sizing: border-box;
      overflow-y: auto;
      overflow-x: hidden;
    }
    .content-inner {
      padding: 20px 20px;
    }
    .sidebar {
      width: 240px;
      flex-shrink: 0;
      border-right: 1px solid var(--border);
      overflow-y: auto;
      overflow-x: hidden;
      background: var(--bg-card);
      padding: 0;
      z-index: 1001;
      height: 100vh;
      position: fixed;
      top: 0;
      left: 0;
      padding: 8px 6px;
      transition: width 0.2s ease, background 0.3s, border-color 0.3s;
      position: relative;
    }
    .sidebar-env-prod {
      background: linear-gradient(to right, rgb(239, 68, 68) 70.17%, #0f0f11) !important;
      border-right-color: rgba(239,68,68,0.3);
    }
    .sidebar-env-sit {
      background: linear-gradient(to right, rgba(245, 158, 11, 0.08) 70.17%, #0f0f11) !important;
      border-right-color: #f59e0bff;
    }
    .sidebar-env-dev {
      background: linear-gradient(to right, rgba(34,197,94,0.08) 70.17%, #0f0f11) !important;
      border-right-color: rgb(34, 197, 94);
    }
    .sidebar.rail {
      width: 48px;
      padding: 8px 4px;
    }
    .collapse-toggle {
      position: absolute;
      bottom: 8px;
      right: 6px;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 1px solid var(--border);
      background: var(--bg-elevated);
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      transition: all 0.12s;
      z-index: 10;
    }
    .collapse-toggle:hover { border-color: var(--accent); color: var(--accent); }
    .sidebar-collapsed .status-bar { left: 48px; }

    .status-bar {
      position: fixed;
      bottom: 0;
      left: 240px;
      right: 0;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 12px;
      background: var(--bg-card);
      border-top: 1px solid var(--border);
      font-size: 11px;
      color: var(--text-muted);
      z-index: 100;
      box-sizing: border-box;
    }
    .status-left, .status-right {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .status-sep { color: var(--border-hover); }
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
  private http = inject(HttpClient);
  loadingService = inject(LoadingService);
  private prefsService = inject(PreferencesService); // ensures prefs load on startup

  namespaces: string[] = [];
  contexts: string[] = [];
  currentNamespace = '';
  private initialNamespace = '';
  currentContext = '...';
  private initialContext = '';
  clusterHealth: 'healthy' | 'degraded' | 'critical' = 'healthy';
  clusterEnv: 'prod' | 'sit' | 'dev' | 'default' = 'default';
  anomalyCount = 0;
  showNotifications = false;
  anomalies: any[] = [];
  sidebarCollapsed = false;
  dashMenuOpen = false;
  savedDashList: { name: string; widgets: any[] }[] = [];
  activeDashName = '';

  ngOnInit() {
    this.sidebarCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
    this.loadDashList();
    this.http.get<any>('/api/context-info').subscribe({
      next: (res) => {
        const env = (res.environment || '').toLowerCase();
        if (env === 'prod') this.clusterEnv = 'prod';
        else if (env === 'sit' || env === 'cit') this.clusterEnv = 'sit';
        else if (env === 'dev') this.clusterEnv = 'dev';
        else this.clusterEnv = 'default';
      },
      error: () => {},
    });
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

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    localStorage.setItem('sidebar_collapsed', String(this.sidebarCollapsed));
  }

  loadDashList() {
    try {
      this.savedDashList = JSON.parse(localStorage.getItem('kubsome_dashboards') || '[]');
      this.activeDashName = localStorage.getItem('kubsome_dashboard_name') || '';
    } catch { this.savedDashList = []; }
  }

  selectDash(dash: { name: string; widgets: any[] }) {
    localStorage.setItem('kubsome_custom_dashboard', JSON.stringify(dash.widgets));
    localStorage.setItem('kubsome_dashboard_name', dash.name);
    this.activeDashName = dash.name;
  }
}
