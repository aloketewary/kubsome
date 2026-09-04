import { Component, OnInit, OnDestroy, inject } from '@angular/core';
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
import { StatusBeaconComponent } from './shared/components/futuristic/status-beacon.component';
import { ShellTerminalComponent } from './shared/components/shell-terminal.component';
import { TerminalDockService } from './core/services/terminal-dock.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, Select, FormsModule, ShellComponent, ShellTerminalComponent, CommandPaletteComponent, AiFloatComponent, ToastAlertsComponent, BreadcrumbComponent, ConnectionStatusComponent, ErrorToastComponent, ConfirmDialogComponent, StatusBeaconComponent],
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
      @if (clusterEnv !== 'default') {
        <div class="env-bar" [class.env-prod]="clusterEnv === 'prod'" [class.env-sit]="clusterEnv === 'sit'" [class.env-dev]="clusterEnv === 'dev'"></div>
      }
      <div class="topbar-left">
        <button class="mobile-nav-toggle" type="button" (click)="toggleMobileNav()"
          [attr.aria-expanded]="sidebarMobileOpen" aria-controls="primary-navigation" aria-label="Toggle navigation">
          <i class="pi" [class.pi-bars]="!sidebarMobileOpen" [class.pi-times]="sidebarMobileOpen" aria-hidden="true"></i>
        </button>
        <a class="topbar-brand" routerLink="/monitor/dashboard" aria-label="Kubsome dashboard">
          <i class="pi pi-box" aria-hidden="true"></i>
          <span class="brand-stack">
            <span class="brand-text">Kubsome</span>
            <span class="brand-kicker">OPS CONSOLE</span>
          </span>
        </a>
        @if (clusterEnv !== 'default') {
          <span class="env-pill" [class.env-pill-prod]="clusterEnv === 'prod'" [class.env-pill-sit]="clusterEnv === 'sit'" [class.env-pill-dev]="clusterEnv === 'dev'">{{ clusterEnv }}</span>
        }
        <div class="topbar-divider"></div>
        <div class="workspace-label" (click)="dashMenuOpen = !dashMenuOpen"
             (keydown.enter)="dashMenuOpen = !dashMenuOpen" (keydown.space)="$event.preventDefault(); dashMenuOpen = !dashMenuOpen"
             role="button" tabindex="0" aria-haspopup="menu" [attr.aria-expanded]="dashMenuOpen">
          <i class="pi pi-th-large"></i>
          <span>{{ activeDashName || 'Workspace' }}</span>
          <i class="pi pi-chevron-down ws-chevron"></i>
        </div>
        @if (dashMenuOpen) {
          <div class="dash-menu" (mouseleave)="dashMenuOpen = false" role="menu">
            @if (savedDashList.length > 0) {
              @for (d of savedDashList; track d.name) {
                <a class="dash-menu-item" [routerLink]="'/monitor/my-dashboard'" [queryParams]="{name: d.name}" (click)="selectDash(d); dashMenuOpen = false" role="menuitem">
                  <i class="pi pi-th-large"></i>
                  <span>{{ d.name }}</span>
                  <span class="dm-count">{{ d.widgets.length }}</span>
                </a>
              }
              <div class="dash-menu-divider"></div>
            }
            <a class="dash-menu-item dash-menu-new" [routerLink]="'/monitor/my-dashboard'" (click)="dashMenuOpen = false" role="menuitem">
              <i class="pi pi-plus"></i>
              <span>{{ savedDashList.length > 0 ? 'New Dashboard' : 'Create Custom Dashboard' }}</span>
            </a>
          </div>
        }
      </div>

      <div class="topbar-center">
        <button type="button" class="cmd-k-btn" (click)="openPalette()" aria-label="Open command palette">
          <i class="pi pi-search" aria-hidden="true"></i>
          <span>Search...</span>
          <kbd>⌘K</kbd>
        </button>
      </div>

      <div class="topbar-right">
        <div class="scope-selector" aria-label="Active cluster scope">
          <span class="scope-caption">SCOPE</span>
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
        <button type="button" class="notif-btn" title="Anomaly alerts" aria-controls="anomaly-panel"
          [attr.aria-label]="anomalyCount > 0 ? 'Open anomaly alerts' : 'Open anomaly alerts, none active'"
          [attr.aria-expanded]="showNotifications" (click)="showNotifications = !showNotifications">
          <i class="pi pi-bell" aria-hidden="true"></i>
          @if (anomalyCount > 0) { <span class="notif-badge" aria-hidden="true">{{ anomalyCount }}</span> }
        </button>
        @if (showNotifications) {
          <div class="notif-backdrop" (click)="showNotifications = false"></div>
          <div id="anomaly-panel" class="notif-panel" role="region" aria-label="Anomaly alerts">
            <div class="notif-header">
              <div class="notif-heading">
                <span class="notif-kicker">ANOMALY FEED</span>
                <strong>Alerts</strong>
                <span class="notif-count">{{ anomalyCount }} ACTIVE</span>
              </div>
              <div class="notif-actions">
                @if (anomalies.length > 0) {
                  <button type="button" class="notif-clear" (click)="clearAllNotifications()">Clear all</button>
                }
                <button type="button" class="notif-close" (click)="showNotifications = false" aria-label="Close anomaly alerts"><i class="pi pi-times" aria-hidden="true"></i></button>
              </div>
            </div>
            <div class="notif-list" role="list" aria-live="polite">
              @for (alert of anomalies; track $index) {
                <div class="notif-item" role="listitem"
                  [class.notif-critical]="alert.severity === 'critical'"
                  [class.notif-warning]="alert.severity === 'warning'">
                  <app-status-beacon [status]="alertStatus(alert.severity)" size="sm" />
                  <div class="notif-body">
                    <span class="notif-title">{{ alert.title || alert.type || 'Alert' }}</span>
                    <span class="notif-desc">{{ alert.message || alert.detail || '' }}</span>
                    <span class="notif-severity">{{ alert.severity || 'info' }}</span>
                  </div>
                  <button type="button" class="notif-dismiss" (click)="dismissNotification($index)" aria-label="Dismiss alert"><i class="pi pi-times" aria-hidden="true"></i></button>
                </div>
              }
              @if (anomalies.length === 0) {
                <div class="notif-empty" role="status"><i class="pi pi-check-circle" aria-hidden="true"></i><span>ALL CLEAR / NO ACTIVE ALERTS</span></div>
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
    <div class="layout"
      [class.sidebar-collapsed]="sidebarCollapsed"
      [class.terminal-attached]="!!terminalDock.session()"
      [class.terminal-minimized]="terminalDock.minimized()">
      <aside id="primary-navigation" class="sidebar" [class.rail]="sidebarCollapsed" [class.mobile-open]="sidebarMobileOpen"
        (click)="handleSidebarClick($event)">
        @if (clusterEnv !== 'default') {
          <div class="sidebar-env-strip" [class.strip-prod]="clusterEnv === 'prod'" [class.strip-sit]="clusterEnv === 'sit'" [class.strip-dev]="clusterEnv === 'dev'"></div>
        }
        <app-shell [collapsed]="sidebarCollapsed" />
        <button type="button" class="collapse-toggle" (click)="toggleSidebar()"
          [attr.aria-expanded]="!sidebarCollapsed"
          [attr.aria-label]="sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          [title]="sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'">
          <i class="pi" [class.pi-chevron-left]="!sidebarCollapsed" [class.pi-chevron-right]="sidebarCollapsed" aria-hidden="true"></i>
        </button>
      </aside>
      @if (sidebarMobileOpen) {
        <button class="mobile-sidebar-backdrop" type="button" (click)="sidebarMobileOpen = false" aria-label="Close navigation"></button>
      }
      <main class="content">
        <div class="content-inner">
          <app-breadcrumb />
          <router-outlet />
        </div>
      </main>
    </div>

    @if (terminalDock.session(); as session) {
      <section class="terminal-dock"
        [class.terminal-dock-minimized]="terminalDock.minimized()"
        [class.terminal-dock-sidebar-collapsed]="sidebarCollapsed"
        [class.terminal-dock-status-live]="terminalDock.status() === 'live'"
        [class.terminal-dock-status-connecting]="terminalDock.status() === 'connecting'"
        [class.terminal-dock-status-error]="terminalDock.status() === 'error'"
        [class.terminal-dock-status-disconnected]="terminalDock.status() === 'disconnected'"
        aria-label="Attached pod terminal">
        <header class="terminal-dock-header">
          <div class="terminal-dock-identity">
            <div class="terminal-dock-glyph" aria-hidden="true">
              <i class="pi pi-terminal"></i>
              <span>01</span>
            </div>
            <div class="terminal-dock-identity-copy">
              <span class="terminal-dock-kicker">EXEC SESSION / PERSISTENT LINK</span>
              <div class="terminal-dock-pod-line">
                <code>{{ session.podName }}</code>
                <span class="terminal-dock-session-tag">pod shell</span>
              </div>
            </div>
          </div>
          <div class="terminal-dock-scope" aria-label="Current cluster scope">
            <span class="terminal-dock-scope-label">SCOPE</span>
            <div class="terminal-dock-scope-path">
              <span>cluster</span><strong>{{ currentContext }}</strong>
              <b>/</b>
              <span>ns</span><strong>{{ currentNamespace }}</strong>
            </div>
          </div>
          <div class="terminal-dock-status" aria-live="polite">
            <span class="terminal-dock-status-mark"></span>
            <span class="terminal-dock-status-label">{{ terminalDock.status() }}</span>
          </div>
          <div class="terminal-dock-actions">
            <button type="button" class="terminal-dock-action" (click)="terminalDock.toggleMinimized()"
              [attr.aria-label]="terminalDock.minimized() ? 'Expand terminal' : 'Minimize terminal'"
              [title]="terminalDock.minimized() ? 'Expand terminal' : 'Minimize terminal'">
              <i class="pi" [class.pi-chevron-up]="terminalDock.minimized()" [class.pi-chevron-down]="!terminalDock.minimized()" aria-hidden="true"></i>
            </button>
            <button type="button" class="terminal-dock-action terminal-dock-end" (click)="terminalDock.end()"
              aria-label="End shell session" title="End shell session">
              <i class="pi pi-times" aria-hidden="true"></i>
            </button>
          </div>
        </header>
        <div class="terminal-dock-ribbon" aria-label="Terminal session details">
          <span><i class="pi pi-bolt" aria-hidden="true"></i> interactive shell</span>
          <span><i class="pi pi-link" aria-hidden="true"></i> root attached</span>
          <span class="terminal-dock-ribbon-note">minimize preserves session</span>
        </div>
        <div class="terminal-dock-body" [class.terminal-dock-body-hidden]="terminalDock.minimized()">
          <app-shell-terminal [podName]="session.podName" />
        </div>
      </section>
    }

    <!-- Status Bar -->
    <footer class="status-bar" [class.status-bar-sidebar-collapsed]="sidebarCollapsed">
      <div class="status-left">
        <span class="status-kicker">SCOPE</span>
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
      left: 0;
      right: 0;
      height: 56px;
      display: flex;
      align-items: center;
      padding: 0 24px;
      background: rgba(11, 9, 8, 0.92);
      border-bottom: 1px solid rgba(255, 255, 255, 0.03);
      z-index: 1002;
      gap: 16px;
      box-sizing: border-box;
      transition: background 0.3s, border-color 0.3s;
      backdrop-filter: blur(16px) saturate(180%);
      -webkit-backdrop-filter: blur(16px) saturate(180%);
    }
    .topbar::after {
      content: '';
      position: absolute;
      bottom: 0; left: 40px; right: 40px;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(208, 156, 96, 0.08), transparent);
      pointer-events: none;
    }
    .topbar-env-prod, .topbar-env-sit, .topbar-env-dev { }

    /* ─── Environment Indicator Bar ────────────────────────────────── */
    .env-bar {
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 2px;
      z-index: 1;
    }
    .env-bar.env-prod {
      background: linear-gradient(90deg, #f43f5e, #dc2626, #f43f5e);
      box-shadow: 0 0 8px rgba(244, 63, 94, 0.4), 0 1px 4px rgba(244, 63, 94, 0.2);
    }
    .env-bar.env-sit {
      background: linear-gradient(90deg, #f59e0b, #d97706, #f59e0b);
      box-shadow: 0 0 8px rgba(245, 158, 11, 0.3), 0 1px 4px rgba(245, 158, 11, 0.15);
    }
    .env-bar.env-dev {
      background: linear-gradient(90deg, #10b981, #059669, #10b981);
      box-shadow: 0 0 8px rgba(16, 185, 129, 0.3), 0 1px 4px rgba(16, 185, 129, 0.15);
    }

    /* ─── Environment Pill ─────────────────────────────────────────── */
    .env-pill {
      font-size: 8px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 2px 6px;
      border-radius: 4px;
      margin-left: 4px;
    }
    .env-pill-prod { background: rgba(244, 63, 94, 0.12); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.2); }
    .env-pill-sit { background: rgba(245, 158, 11, 0.1); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.2); }
    .env-pill-dev { background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); }
    .topbar-left {
      display: flex;
      align-items: center;
      min-width: 200px;
      position: relative;
    }
    .topbar-brand {
      display: flex; align-items: center; gap: 8px;
      text-decoration: none; color: rgba(245, 240, 235, 0.9);
      font-size: 14px; font-weight: 700; letter-spacing: -0.02em;
      padding: 6px 10px;
      transition: all 0.15s;
    }
    .topbar-brand:hover { color: #d09c60; }
    .topbar-brand i { font-size: 16px; color: #d09c60; text-shadow: 0 0 8px rgba(208, 156, 96, 0.3); }
    .brand-text { }
    .topbar-divider {
      width: 1px; height: 20px; background: rgba(94, 84, 75, 0.2); margin: 0 10px;
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
      padding: 0;
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
      width: 6px; height: 6px; border-radius: 50%;
    }
    .scope-dot.dot-healthy { background: var(--success); box-shadow: 0 0 4px var(--success); }
    .scope-dot.dot-degraded { background: var(--warning); box-shadow: 0 0 4px var(--warning); }
    .scope-dot.dot-critical { background: var(--danger); box-shadow: 0 0 4px var(--danger); }
    .scope-key {
      font-size: 9px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .scope-sep {
      font-size: 12px;
      color: rgba(94, 84, 75, 0.3);
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
      background: rgba(245, 240, 235, 0.02);
      border: 1px solid rgba(94, 84, 75, 0.15);
      border-radius: 8px;
      color: rgba(168, 158, 148, 0.5);
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .cmd-k-btn:hover {
      border-color: rgba(208, 156, 96, 0.15);
      color: rgba(245, 240, 235, 0.7);
      background: rgba(208, 156, 96, 0.03);
      box-shadow: 0 0 12px -4px rgba(208, 156, 96, 0.1);
    }
    .cmd-k-btn i { font-size: 12px; }
    .cmd-k-btn span { flex: 1; text-align: left; }
    .cmd-k-btn kbd {
      font-size: 9px;
      padding: 2px 5px;
      border-radius: 4px;
      background: rgba(245, 240, 235, 0.03);
      border: 1px solid rgba(94, 84, 75, 0.15);
      color: rgba(168, 158, 148, 0.4);
      font-family: 'JetBrains Mono', monospace;
    }

    /* Notification bell */
    .notif-btn {
      position: relative;
      padding: 6px;
      border: 1px solid transparent;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--text-muted);
      font-size: 16px;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
    }
    .notif-btn:hover,
    .notif-btn:focus-visible { background: var(--danger-subtle); border-color: rgba(var(--danger-rgb), .3); color: var(--danger); }
    .notif-badge {
      position: absolute;
      top: -2px;
      right: -3px;
      min-width: 16px;
      height: 16px;
      padding: 0 3px;
      border: 1px solid var(--bg);
      border-radius: 4px;
      background: var(--danger);
      color: #fff;
      font: 700 9px/14px var(--font-mono);
      text-align: center;
    }
    .notif-backdrop { position: fixed; inset: 0; z-index: 1999; }
    .notif-panel {
      position: absolute;
      top: 50px;
      right: 12px;
      width: min(380px, calc(100vw - 24px));
      max-height: min(460px, calc(100vh - 76px));
      overflow: hidden;
      display: flex;
      flex-direction: column;
      z-index: 2000;
      border: 1px solid rgba(var(--accent-rgb), .28);
      border-radius: var(--radius-sm);
      background: var(--surface-card);
      box-shadow: var(--shadow-lg), 0 0 0 1px rgba(var(--accent-rgb), .04);
    }
    .notif-panel::before {
      height: 2px;
      flex-shrink: 0;
      background: linear-gradient(90deg, var(--accent), transparent 78%);
      content: '';
    }
    .notif-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
      border-bottom: 1px solid var(--border);
      background: var(--surface-elevated);
    }
    .notif-heading { display: flex; min-width: 0; align-items: baseline; gap: 8px; }
    .notif-kicker { color: var(--accent); font: 700 8px var(--font-mono); letter-spacing: .14em; }
    .notif-heading strong { color: var(--text); font-size: 13px; }
    .notif-count { color: var(--text-muted); font: 9px var(--font-mono); letter-spacing: .06em; }
    .notif-close { padding: 4px; border: 1px solid transparent; border-radius: 4px; background: transparent; color: var(--text-muted); cursor: pointer; }
    .notif-close:hover, .notif-close:focus-visible { border-color: var(--border-hover); background: var(--surface-hover); color: var(--text); }
    .notif-list { max-height: 400px; overflow-y: auto; }
    .notif-item {
      --notif-accent: var(--info);
      --notif-accent-rgb: var(--info-rgb);
      position: relative;
      display: flex;
      align-items: flex-start;
      gap: 9px;
      min-width: 0;
      padding: 12px 14px;
      border-bottom: 1px solid var(--border-subtle);
      background: transparent;
      transition: background 0.15s;
    }
    .notif-item::before { position: absolute; inset: 0 auto 0 0; width: 2px; background: var(--notif-accent); box-shadow: 0 0 12px rgba(var(--notif-accent-rgb), .25); content: ''; }
    .notif-item.notif-warning { --notif-accent: var(--warning); --notif-accent-rgb: var(--warning-rgb); }
    .notif-item.notif-critical { --notif-accent: var(--danger); --notif-accent-rgb: var(--danger-rgb); }
    .notif-item:hover { background: rgba(var(--notif-accent-rgb), .05); }
    .notif-item:last-child { border-bottom: none; }
    .notif-item app-status-beacon { margin-top: 4px; }
    .notif-body { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 4px; }
    .notif-title { color: var(--text); font-size: 12px; font-weight: 600; }
    .notif-desc { overflow-wrap: anywhere; color: var(--text-secondary); font-size: 11px; line-height: 1.4; }
    .notif-severity { color: var(--notif-accent); font: 700 8px var(--font-mono); letter-spacing: .12em; text-transform: uppercase; }
    .notif-actions { display: flex; align-items: center; gap: 6px; }
    .notif-clear { padding: 3px 6px; border: 1px solid transparent; border-radius: 4px; background: transparent; color: var(--accent); font: 10px var(--font-mono); cursor: pointer; }
    .notif-clear:hover, .notif-clear:focus-visible { border-color: rgba(var(--accent-rgb), .25); background: var(--accent-subtle); }
    .notif-dismiss { align-self: flex-start; padding: 3px; border: 1px solid transparent; border-radius: 3px; background: transparent; color: var(--text-muted); font-size: 10px; cursor: pointer; opacity: .7; }
    .notif-dismiss:hover, .notif-dismiss:focus-visible { border-color: rgba(var(--danger-rgb), .25); color: var(--danger); opacity: 1; }
    .notif-empty { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 28px 18px; color: var(--text-muted); font: 10px var(--font-mono); letter-spacing: .08em; text-align: center; }
    .notif-empty i { color: var(--success); }
    @media (max-width: 640px) { .notif-panel { top: 46px; right: 12px; } .notif-heading { flex-wrap: wrap; gap: 4px 8px; } .notif-kicker { flex-basis: 100%; } }
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
      margin-left: 240px;
      box-sizing: border-box;
      overflow-y: auto;
      overflow-x: hidden;
      transition: margin-left 0.2s ease;
    }
    .content-inner {
      padding: 20px 20px;
    }
    .sidebar {
      width: 240px;
      flex-shrink: 0;
      border-right: 1px solid rgba(94, 84, 75, 0.12);
      overflow-y: auto;
      overflow-x: hidden;
      background: rgba(11, 9, 8, 0.98);
      padding: 0;
      z-index: 1001;
      height: calc(100vh - 56px);
      position: fixed;
      top: 56px;
      left: 0;
      padding: 8px 6px;
      transition: width 0.2s ease, background 0.3s, border-color 0.3s;
    }
    .sidebar-env-prod, .sidebar-env-sit, .sidebar-env-dev { }

    /* ─── Sidebar Environment Strip ───────────────────────────────── */
    .sidebar-env-strip {
      position: absolute;
      top: 0; left: 0; bottom: 0;
      width: 2px;
      z-index: 2;
      pointer-events: none;
    }
    .strip-prod {
      background: linear-gradient(180deg, #f43f5e, rgba(244, 63, 94, 0.1));
      box-shadow: 1px 0 6px rgba(244, 63, 94, 0.2);
    }
    .strip-sit {
      background: linear-gradient(180deg, #f59e0b, rgba(245, 158, 11, 0.1));
      box-shadow: 1px 0 6px rgba(245, 158, 11, 0.15);
    }
    .strip-dev {
      background: linear-gradient(180deg, #10b981, rgba(16, 185, 129, 0.1));
      box-shadow: 1px 0 6px rgba(16, 185, 129, 0.15);
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
      border: 1px solid rgba(94, 84, 75, 0.15);
      background: rgba(245, 240, 235, 0.02);
      color: rgba(168, 158, 148, 0.5);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      transition: all 0.12s;
      z-index: 10;
    }
    .collapse-toggle:hover { border-color: rgba(208, 156, 96, 0.2); color: #d09c60; background: rgba(208, 156, 96, 0.04); }
    .sidebar-collapsed .status-bar { left: 48px; }
    .sidebar-collapsed .content { margin-left: 48px; }

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
      background: rgba(11, 9, 8, 0.95);
      border-top: 1px solid rgba(94, 84, 75, 0.1);
      font-size: 10px;
      color: rgba(168, 158, 148, 0.45);
      z-index: 100;
      box-sizing: border-box;
      font-family: 'JetBrains Mono', monospace;
      backdrop-filter: blur(8px);
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

    /* ─── Light Mode ──────────────────────────────────────────────────── */
    :host-context([data-theme="light"]) .topbar {
      background: rgba(255, 255, 255, 0.88);
      border-bottom-color: rgba(0, 0, 0, 0.05);
      backdrop-filter: blur(16px) saturate(180%);
    }
    :host-context([data-theme="light"]) .topbar::after {
      background: linear-gradient(90deg, transparent, rgba(154, 81, 41, 0.08), transparent);
    }
    :host-context([data-theme="light"]) .topbar-brand { color: rgba(0, 0, 0, 0.85); }
    :host-context([data-theme="light"]) .topbar-brand i { color: #9a5129; text-shadow: none; }
    :host-context([data-theme="light"]) .topbar-divider { background: rgba(0, 0, 0, 0.08); }
    :host-context([data-theme="light"]) .cmd-k-btn {
      background: rgba(0, 0, 0, 0.02);
      border-color: rgba(0, 0, 0, 0.06);
      color: rgba(0, 0, 0, 0.35);
    }
    :host-context([data-theme="light"]) .cmd-k-btn:hover {
      border-color: rgba(154, 81, 41, 0.15);
      color: rgba(0, 0, 0, 0.6);
      background: rgba(154, 81, 41, 0.03);
      box-shadow: none;
    }
    :host-context([data-theme="light"]) .cmd-k-btn kbd {
      background: rgba(0, 0, 0, 0.03);
      border-color: rgba(0, 0, 0, 0.06);
      color: rgba(0, 0, 0, 0.3);
    }
    :host-context([data-theme="light"]) .sidebar {
      background: rgba(252, 250, 248, 0.95);
      border-right-color: rgba(0, 0, 0, 0.05);
    }
    :host-context([data-theme="light"]) .collapse-toggle {
      border-color: rgba(0, 0, 0, 0.06);
      background: rgba(0, 0, 0, 0.02);
      color: rgba(0, 0, 0, 0.35);
    }
    :host-context([data-theme="light"]) .collapse-toggle:hover {
      border-color: rgba(154, 81, 41, 0.2);
      color: #9a5129;
      background: rgba(154, 81, 41, 0.04);
    }
    :host-context([data-theme="light"]) .status-bar {
      background: rgba(252, 250, 248, 0.92);
      border-top-color: rgba(0, 0, 0, 0.05);
      color: rgba(0, 0, 0, 0.35);
    }
    :host-context([data-theme="light"]) .env-pill-prod { background: rgba(220, 38, 38, 0.06); color: #dc2626; border-color: rgba(220, 38, 38, 0.12); }
    :host-context([data-theme="light"]) .env-pill-sit { background: rgba(180, 83, 9, 0.06); color: #b45309; border-color: rgba(180, 83, 9, 0.12); }
    :host-context([data-theme="light"]) .env-pill-dev { background: rgba(22, 163, 74, 0.06); color: #16a34a; border-color: rgba(22, 163, 74, 0.12); }
    :host-context([data-theme="light"]) .strip-prod {
      background: linear-gradient(180deg, #dc2626, rgba(220, 38, 38, 0.03));
      box-shadow: 1px 0 4px rgba(220, 38, 38, 0.06);
    }
    :host-context([data-theme="light"]) .strip-sit {
      background: linear-gradient(180deg, #b45309, rgba(180, 83, 9, 0.03));
      box-shadow: 1px 0 4px rgba(180, 83, 9, 0.05);
    }
    :host-context([data-theme="light"]) .strip-dev {
      background: linear-gradient(180deg, #16a34a, rgba(22, 163, 74, 0.03));
      box-shadow: 1px 0 4px rgba(22, 163, 74, 0.05);
    }
    :host-context([data-theme="light"]) .workspace-label { color: rgba(0, 0, 0, 0.45); }
    :host-context([data-theme="light"]) .workspace-label:hover { background: rgba(0, 0, 0, 0.03); color: rgba(0, 0, 0, 0.75); }
    :host-context([data-theme="light"]) .workspace-label i { color: #9a5129; }
    :host-context([data-theme="light"]) .dash-menu {
      background: #fff; border-color: rgba(0, 0, 0, 0.06);
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
    }
    :host-context([data-theme="light"]) .dash-menu-item { color: rgba(0, 0, 0, 0.55); }
    :host-context([data-theme="light"]) .dash-menu-item:hover { background: rgba(0, 0, 0, 0.02); color: rgba(0, 0, 0, 0.8); }
    :host-context([data-theme="light"]) .dash-menu-divider { background: rgba(0, 0, 0, 0.05); }
    :host-context([data-theme="light"]) .notif-panel {
      background: #fff; border-color: rgba(0, 0, 0, 0.06);
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
    }
    :host-context([data-theme="light"]) .notif-header { border-bottom-color: rgba(0, 0, 0, 0.05); }
    :host-context([data-theme="light"]) .notif-item { border-bottom-color: rgba(0, 0, 0, 0.03); }
    :host-context([data-theme="light"]) .notif-item:hover { background: rgba(0, 0, 0, 0.015); }

    /* SaaS Noir shell: opaque surfaces, quiet controls, responsive navigation. */
    .mobile-nav-toggle {
      display: none;
      width: 34px;
      height: 34px;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--bg-elevated);
      color: var(--text-secondary);
      cursor: pointer;
    }

    .topbar {
      height: 60px;
      padding: 0 20px;
      background: var(--bg-card);
      border-bottom-color: var(--border);
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
    }

    .topbar::after {
      display: none;
    }

    .topbar-left {
      min-width: 232px;
    }

    .topbar-brand {
      padding: 6px 8px;
      color: var(--text);
      font-size: 15px;
    }

    .topbar-brand:hover {
      color: var(--accent);
    }

    .topbar-brand i {
      color: var(--accent);
      text-shadow: none;
    }

    .workspace-label {
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 550;
      letter-spacing: 0;
      text-transform: none;
    }

    .workspace-label:hover,
    .cmd-k-btn:hover {
      background: var(--bg-hover);
      border-color: var(--border-hover);
      color: var(--text);
      box-shadow: none;
    }

    .env-bar.env-prod { background: var(--danger); box-shadow: none; }
    .env-bar.env-sit { background: var(--warning); box-shadow: none; }
    .env-bar.env-dev { background: var(--success); box-shadow: none; }

    .cmd-k-btn {
      min-height: 34px;
      padding: 6px 10px;
      background: var(--bg-elevated);
      border-color: var(--border);
      border-radius: 8px;
      color: var(--text-muted);
    }

    .cmd-k-btn kbd {
      background: var(--bg-card);
      border-color: var(--border);
      color: var(--text-muted);
    }

    .scope-key {
      color: var(--text-muted);
      font-size: 10px;
      letter-spacing: 0;
      text-transform: none;
    }

    .scope-dot.dot-healthy,
    .scope-dot.dot-degraded,
    .scope-dot.dot-critical,
    .status-dot.connected {
      box-shadow: none;
    }

    .sidebar {
      top: 60px;
      width: 232px;
      height: calc(100dvh - 60px);
      background: var(--bg-card);
      border-right-color: var(--border);
      padding: 8px 6px;
    }

    .sidebar-env-strip {
      width: 2px;
    }

    .strip-prod { background: var(--danger); box-shadow: none; }
    .strip-sit { background: var(--warning); box-shadow: none; }
    .strip-dev { background: var(--success); box-shadow: none; }

    .content {
      min-height: 100dvh;
      padding-top: 60px;
      margin-left: 232px;
    }

    .content-inner {
      max-width: 1600px;
      margin: 0 auto;
      padding: 24px 28px 36px;
    }

    .status-bar {
      left: 232px;
      background: var(--bg-card);
      border-top-color: var(--border);
      color: var(--text-muted);
      backdrop-filter: none;
    }

    .status-dot.connected {
      background: var(--success);
    }

    .sidebar-collapsed .content { margin-left: 48px; }
    .sidebar-collapsed .status-bar { left: 48px; }

    .mobile-sidebar-backdrop {
      display: none;
    }

    :host-context([data-theme="light"]) .topbar,
    :host-context([data-theme="light"]) .sidebar,
    :host-context([data-theme="light"]) .status-bar {
      background: var(--bg-card);
      border-color: var(--border);
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
    }

    :host-context([data-theme="light"]) .cmd-k-btn {
      background: var(--bg-elevated);
      border-color: var(--border);
      color: var(--text-muted);
    }

    :host-context([data-theme="light"]) .workspace-label,
    :host-context([data-theme="light"]) .status-bar {
      color: var(--text-secondary);
    }

    @media (max-width: 900px) {
      .topbar {
        padding: 0 14px;
        gap: 10px;
      }

      .topbar-left {
        min-width: 0;
      }

      .topbar-center {
        max-width: none;
      }

      .scope-selector {
        display: none;
      }

      .sidebar {
        width: min(280px, calc(100vw - 48px));
        transform: translateX(-100%);
        transition: transform 0.18s var(--transition-smooth);
        box-shadow: 12px 0 32px rgba(0, 0, 0, 0.28);
      }

      .sidebar.mobile-open {
        transform: translateX(0);
      }

      .sidebar.mobile-open.rail {
        width: min(280px, calc(100vw - 48px));
      }

      .sidebar.mobile-open.rail .nav-label,
      .sidebar.mobile-open.rail .nav-item span,
      .sidebar.mobile-open.rail .nav-item kbd {
        display: flex;
      }

      .sidebar.mobile-open.rail .nav-item {
        justify-content: flex-start;
        padding: 7px 10px;
        margin: 2px 6px;
      }

      .sidebar.mobile-open.rail .fav-remove,
      .sidebar.mobile-open.rail .star-btn {
        display: block;
      }

      .content,
      .sidebar-collapsed .content {
        margin-left: 0;
      }

      .status-bar,
      .sidebar-collapsed .status-bar {
        left: 0;
      }

      .mobile-nav-toggle {
        display: inline-flex;
      }

      .mobile-sidebar-backdrop {
        display: block;
        position: fixed;
        inset: 60px 0 24px;
        z-index: 1000;
        border: 0;
        background: rgba(0, 0, 0, 0.42);
      }

      .content-inner {
        padding: 20px 20px 32px;
      }
    }

    @media (max-width: 560px) {
      .brand-text,
      .topbar-divider,
      .workspace-label {
        display: none;
      }

      .topbar-center {
        margin-left: auto;
      }

      .content-inner {
        padding: 16px 14px 28px;
      }

      .status-right {
        display: none;
      }
    }

    .layout.terminal-attached .content {
      padding-bottom: 360px;
    }

    .layout.terminal-attached.terminal-minimized .content {
      padding-bottom: 72px;
    }

    .terminal-dock {
      position: fixed;
      right: 0;
      bottom: 24px;
      left: 232px;
      z-index: 90;
      display: flex;
      flex-direction: column;
      height: min(360px, 42dvh);
      min-height: 240px;
      border-top: 1px solid var(--accent);
      background: var(--bg-card);
      box-shadow: 0 -12px 32px rgba(0, 0, 0, 0.22);
      transition: left 0.2s ease, height 0.18s var(--transition-smooth), box-shadow 0.18s ease;
    }

    .terminal-dock.terminal-dock-sidebar-collapsed {
      left: 48px;
    }

    .terminal-dock.terminal-dock-minimized {
      height: 40px;
      min-height: 40px;
      box-shadow: 0 -6px 18px rgba(0, 0, 0, 0.16);
    }

    .terminal-dock-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 40px;
      padding: 0 12px;
      border-bottom: 1px solid var(--border);
      background: var(--bg-elevated);
      color: var(--text-secondary);
      font-family: var(--font-mono);
      font-size: 10px;
      flex-shrink: 0;
    }

    .terminal-dock-title,
    .terminal-dock-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .terminal-dock-title > i {
      color: var(--accent);
      font-size: 12px;
    }

    .terminal-dock-title code {
      max-width: min(36vw, 420px);
      overflow: hidden;
      color: var(--text);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .terminal-dock-separator {
      color: var(--text-muted);
    }

    .terminal-dock-state {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      margin-left: 6px;
      color: var(--success);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .terminal-dock-state-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: currentColor;
      box-shadow: 0 0 5px currentColor;
    }

    .terminal-dock-action {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 1px solid transparent;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
    }

    .terminal-dock-action:hover,
    .terminal-dock-action:focus-visible {
      border-color: var(--border-hover);
      color: var(--text);
      outline: none;
    }

    .terminal-dock-end:hover,
    .terminal-dock-end:focus-visible {
      border-color: rgba(var(--danger-rgb), 0.4);
      color: var(--danger);
    }

    .terminal-dock-body {
      display: flex;
      min-height: 0;
      flex: 1;
      overflow: hidden;
    }

    .terminal-dock-body-hidden {
      display: flex;
      visibility: hidden;
      pointer-events: none;
    }

    .terminal-dock-body app-shell-terminal {
      display: block;
      width: 100%;
      min-height: 0;
    }

    @media (max-width: 900px) {
      .layout.terminal-attached .content {
        padding-bottom: 360px;
      }

      .terminal-dock,
      .terminal-dock.terminal-dock-sidebar-collapsed {
        left: 0;
      }
    }

    @media (max-width: 560px) {
      .layout.terminal-attached .content,
      .layout.terminal-attached.terminal-minimized .content {
        padding-bottom: 72px;
      }

      .terminal-dock {
        height: min(420px, 54dvh);
        min-height: 220px;
      }

      .terminal-dock-title code {
        max-width: 34vw;
      }

      .terminal-dock-state {
        display: none;
      }
    }
    /* Futuristic attached session bay */
    .layout.terminal-attached {
      --terminal-dock-height: min(390px, 44dvh);
    }

    .layout.terminal-attached.terminal-minimized {
      --terminal-dock-height: 40px;
    }

    .layout.terminal-attached .content {
      padding-bottom: calc(var(--terminal-dock-height) + 24px);
    }

    .terminal-dock {
      isolation: isolate;
      height: var(--terminal-dock-height);
      min-height: 260px;
      overflow: hidden;
      border: 1px solid rgba(var(--accent-rgb), 0.34);
      border-bottom: 0;
      border-top: 2px solid var(--accent);
      background: linear-gradient(135deg, var(--bg-card), var(--bg-elevated));
      box-shadow: 0 -16px 42px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.035);
      transition: left 0.2s ease, height 0.18s var(--transition-smooth), border-color 0.18s ease;
    }

    .terminal-dock::before {
      position: absolute;
      inset: 0;
      z-index: -1;
      background: linear-gradient(90deg, rgba(var(--accent-rgb), 0.055), transparent 22%, transparent 78%, rgba(var(--accent-rgb), 0.025));
      content: '';
      pointer-events: none;
    }

    .terminal-dock::after {
      position: absolute;
      inset: 0;
      z-index: 3;
      background: repeating-linear-gradient(180deg, transparent 0, transparent 4px, rgba(var(--accent-rgb), 0.012) 5px);
      content: '';
      pointer-events: none;
    }

    .terminal-dock-header,
    .terminal-dock-ribbon,
    .terminal-dock-body {
      position: relative;
      z-index: 4;
    }

    .terminal-dock-header {
      min-height: 58px;
      padding: 8px 14px;
      border-bottom: 1px solid rgba(var(--accent-rgb), 0.12);
      background: rgba(var(--accent-rgb), 0.025);
      gap: 18px;
    }

    .terminal-dock-identity,
    .terminal-dock-pod-line,
    .terminal-dock-scope-path,
    .terminal-dock-status,
    .terminal-dock-ribbon,
    .terminal-dock-ribbon span {
      display: flex;
      align-items: center;
    }

    .terminal-dock-identity {
      min-width: 220px;
      gap: 10px;
    }

    .terminal-dock-glyph {
      display: grid;
      width: 34px;
      height: 34px;
      place-items: center;
      border: 1px solid rgba(var(--accent-rgb), 0.46);
      background: rgba(var(--accent-rgb), 0.08);
      color: var(--accent);
      box-shadow: inset 0 0 16px rgba(var(--accent-rgb), 0.06);
    }

    .terminal-dock-glyph i { font-size: 14px; }
    .terminal-dock-glyph span {
      position: absolute;
      margin: 24px 0 0 24px;
      padding: 1px 3px;
      background: var(--bg-card);
      color: var(--accent);
      font-size: 7px;
      letter-spacing: 0.08em;
    }

    .terminal-dock-identity-copy {
      display: flex;
      min-width: 0;
      flex-direction: column;
      gap: 3px;
    }

    .terminal-dock-kicker,
    .terminal-dock-scope-label,
    .terminal-dock-ribbon,
    .terminal-dock-session-tag {
      font-family: var(--font-mono);
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .terminal-dock-kicker,
    .terminal-dock-scope-label {
      color: var(--text-muted);
      font-size: 8px;
      font-weight: 700;
    }

    .terminal-dock-pod-line {
      min-width: 0;
      gap: 8px;
    }

    .terminal-dock-pod-line code {
      max-width: min(28vw, 340px);
      overflow: hidden;
      color: var(--text);
      font-size: 12px;
      font-weight: 700;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .terminal-dock-session-tag {
      padding: 2px 5px;
      border: 1px solid rgba(var(--accent-rgb), 0.24);
      color: var(--accent);
      font-size: 7px;
      white-space: nowrap;
    }

    .terminal-dock-scope {
      display: flex;
      min-width: 0;
      flex-direction: column;
      gap: 4px;
      margin-left: auto;
      padding-left: 18px;
      border-left: 1px solid var(--border-subtle);
    }

    .terminal-dock-scope-path {
      min-width: 0;
      gap: 6px;
      color: var(--text-muted);
      font-family: var(--font-mono);
      font-size: 9px;
      white-space: nowrap;
    }

    .terminal-dock-scope-path strong {
      max-width: 140px;
      overflow: hidden;
      color: var(--text-secondary);
      font-weight: 600;
      text-overflow: ellipsis;
    }

    .terminal-dock-scope-path b {
      color: var(--accent);
      font-weight: 400;
    }

    .terminal-dock-status {
      gap: 6px;
      min-height: 24px;
      padding: 0 8px;
      border: 1px solid var(--border);
      color: var(--text-muted);
      font-family: var(--font-mono);
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .terminal-dock-status-mark {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
    }

    .terminal-dock-status-live { color: var(--success); }
    .terminal-dock-status-connecting { color: var(--warning); }
    .terminal-dock-status-error { color: var(--danger); }
    .terminal-dock-status-disconnected { color: var(--text-muted); }
    .terminal-dock-status-live .terminal-dock-status-mark { box-shadow: 0 0 7px currentColor; }

    .terminal-dock-ribbon {
      min-height: 27px;
      gap: 18px;
      padding: 0 16px;
      border-bottom: 1px solid var(--border-subtle);
      color: var(--text-muted);
      font-size: 8px;
    }

    .terminal-dock-ribbon span { gap: 5px; }
    .terminal-dock-ribbon i { color: var(--accent); font-size: 9px; }
    .terminal-dock-ribbon-note { margin-left: auto; color: var(--text-muted); }

    .terminal-dock-body {
      background: rgba(0, 0, 0, 0.12);
    }

    .terminal-dock-minimized {
      min-height: 40px;
    }

    .terminal-dock-minimized .terminal-dock-header {
      min-height: 40px;
      padding-top: 3px;
      padding-bottom: 3px;
    }

    .terminal-dock-minimized .terminal-dock-glyph {
      width: 27px;
      height: 27px;
    }

    .terminal-dock-minimized .terminal-dock-glyph span,
    .terminal-dock-minimized .terminal-dock-kicker,
    .terminal-dock-minimized .terminal-dock-scope,
    .terminal-dock-minimized .terminal-dock-ribbon {
      display: none;
    }

    .terminal-dock-minimized .terminal-dock-identity { min-width: 0; }
    .terminal-dock-minimized .terminal-dock-status { margin-left: auto; }

    @media (max-width: 900px) {
      .layout.terminal-attached { --terminal-dock-height: min(390px, 48dvh); }
      .terminal-dock-identity { min-width: 0; }
      .terminal-dock-scope { display: none; }
    }

    @media (max-width: 560px) {
      .layout.terminal-attached { --terminal-dock-height: min(430px, 60dvh); }
      .terminal-dock-header { gap: 8px; padding-inline: 10px; }
      .terminal-dock-pod-line code { max-width: 40vw; }
      .terminal-dock-ribbon { gap: 10px; padding-inline: 10px; }
      .terminal-dock-ribbon-note { display: none !important; }
      .terminal-dock-status-label { display: none; }
    }

    @media (prefers-reduced-motion: reduce) {
      .terminal-dock { transition: none; }
    }

    /* Operational appbar finish: scope first, chrome second. */
    .topbar {
      border-bottom-color: var(--border);
      box-shadow: 0 1px 0 rgba(var(--accent-rgb), 0.05);
    }

    .topbar-brand,
    .mobile-nav-toggle,
    .workspace-label,
    .cmd-k-btn,
    .notif-btn {
      outline-offset: 2px;
    }

    .topbar-brand:focus-visible,
    .mobile-nav-toggle:focus-visible,
    .workspace-label:focus-visible,
    .cmd-k-btn:focus-visible,
    .notif-btn:focus-visible,
    .dash-menu-item:focus-visible,
    .notif-close:focus-visible,
    .notif-clear:focus-visible,
    .notif-dismiss:focus-visible {
      outline: 2px solid var(--focus-ring);
      outline-offset: 2px;
    }

    .workspace-label {
      border: 1px solid transparent;
    }

    .workspace-label:hover,
    .workspace-label:focus-visible {
      border-color: var(--border-hover);
    }

    .cmd-k-btn {
      border-color: var(--border);
      background: var(--bg-elevated);
    }

    .cmd-k-btn:hover,
    .cmd-k-btn:focus-visible {
      border-color: rgba(var(--accent-rgb), 0.34);
      background: var(--accent-subtle);
    }

    .cmd-k-btn i {
      color: var(--accent);
    }

    .scope-selector {
      gap: 2px;
      padding: 3px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--bg-elevated);
    }

    .scope-item {
      min-height: 27px;
      padding: 1px 5px;
      border: 1px solid transparent;
      border-radius: 5px;
    }

    .scope-item:focus-within {
      border-color: rgba(var(--accent-rgb), 0.34);
      background: var(--accent-subtle);
    }

    .scope-sep {
      color: var(--text-muted);
      opacity: 0.7;
    }

    .notif-btn {
      border: 1px solid transparent;
    }

    .notif-btn:hover,
    .notif-btn:focus-visible {
      border-color: rgba(var(--danger-rgb), 0.3);
      background: var(--danger-subtle);
      color: var(--danger);
    }

    .notif-panel {
      border-color: rgba(var(--accent-rgb), 0.28);
      box-shadow: var(--shadow-lg), 0 0 0 1px rgba(var(--accent-rgb), 0.04);
    }

    .notif-header {
      background: var(--surface-elevated);
    }

    .notif-close,
    .notif-clear,
    .notif-dismiss {
      outline-offset: 2px;
    }

    .notif-dismiss:focus-visible {
      opacity: 1;
    }

    @media (prefers-reduced-motion: reduce) {
      .topbar,
      .cmd-k-btn,
      .workspace-label,
      .notif-btn {
        transition: none;
      }
    }

    /* Pods/Jobs telemetry language for appbar chrome. */
    .topbar {
      border-bottom-color: var(--border);
      box-shadow: inset 0 -1px 0 rgba(var(--info-rgb), 0.08);
    }

    .topbar-brand {
      align-items: center;
      gap: 10px;
      min-height: 38px;
      border-left: 2px solid var(--accent);
      background: linear-gradient(90deg, var(--accent-subtle), transparent 84%);
    }

    .topbar-brand i {
      font-size: 15px;
    }

    .brand-stack {
      display: flex;
      flex-direction: column;
      gap: 1px;
      line-height: 1;
    }

    .brand-kicker,
    .cmd-k-kicker,
    .scope-caption,
    .status-kicker {
      color: var(--text-muted);
      font-family: var(--font-mono);
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .brand-kicker {
      color: var(--accent);
      font-size: 7px;
      letter-spacing: 0.15em;
    }

    .cmd-k-btn {
      display: flex;
      align-items: center;
      gap: 9px;
      min-height: 38px;
      padding: 5px 8px;
      border-left: 2px solid var(--accent);
      background: linear-gradient(90deg, var(--accent-subtle), transparent 82%), var(--surface-elevated);
    }

    .cmd-k-icon {
      display: inline-flex;
      width: 25px;
      height: 25px;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(var(--accent-rgb), 0.25);
      background: var(--accent-subtle);
      color: var(--accent);
    }

    .cmd-k-icon i {
      color: currentColor;
      font-size: 11px;
    }

    .cmd-k-copy {
      display: flex;
      min-width: 0;
      flex: 1;
      flex-direction: column;
      gap: 2px;
      align-items: flex-start;
    }

    .cmd-k-kicker,
    .cmd-k-placeholder {
      flex: none;
      text-align: left;
    }

    .cmd-k-kicker {
      color: var(--accent);
      font-size: 7px;
      letter-spacing: 0.14em;
      line-height: 1;
    }

    .cmd-k-placeholder {
      color: var(--text-secondary);
      font-family: var(--font-mono);
      font-size: 10px;
      line-height: 1;
    }

    .cmd-k-btn kbd {
      min-width: 28px;
      text-align: center;
    }

    .scope-selector {
      min-height: 38px;
      gap: 4px;
      padding: 3px 4px 3px 8px;
      border-left: 2px solid var(--accent);
      background: linear-gradient(90deg, var(--accent-subtle), transparent 74%), var(--surface-elevated);
    }

    .scope-caption {
      padding-right: 4px;
      color: var(--accent);
      font-size: 7px;
      letter-spacing: 0.14em;
    }

    .scope-item {
      min-height: 29px;
      padding: 1px 5px;
    }

    .scope-key {
      font-family: var(--font-mono);
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .scope-sep {
      color: var(--accent);
      font-family: var(--font-mono);
      font-size: 11px;
    }

    .status-bar {
      min-height: 24px;
      border-top-color: rgba(var(--info-rgb), 0.14);
      background: linear-gradient(90deg, var(--accent-subtle), transparent 32%), var(--surface-card);
    }

    .status-left {
      gap: 8px;
    }

    .status-kicker {
      color: var(--accent);
      font-size: 7px;
      letter-spacing: 0.14em;
    }

    .status-left > span:not(.status-kicker):not(.status-dot):not(.status-sep),
    .status-right .shortcut-hint {
      font-family: var(--font-mono);
      font-size: 9px;
    }

    .status-right .shortcut-hint {
      padding: 2px 6px;
      border-color: var(--border);
      background: var(--surface-elevated);
    }

    @media (max-width: 900px) {
      .scope-caption {
        display: none;
      }
    }

    @media (max-width: 560px) {
      .brand-kicker,
      .cmd-k-kicker {
        display: none;
      }

      .cmd-k-btn {
        min-height: 34px;
      }

      .cmd-k-icon {
        width: 22px;
        height: 22px;
      }
    }

    /* Restore compact command-bar treatment. */
    .cmd-k-btn {
      min-height: 34px;
      padding: 6px 10px;
      border-left: 1px solid var(--border);
      background: var(--bg-elevated);
      border-radius: 8px;
    }

    .cmd-k-btn:hover,
    .cmd-k-btn:focus-visible {
      border-color: var(--border-hover);
      background: var(--bg-hover);
    }

    .cmd-k-btn > i {
      color: var(--text-muted);
      font-size: 12px;
    }

    .cmd-k-btn > span {
      flex: 1;
      color: var(--text-muted);
      font-family: var(--font-sans);
      font-size: 12px;
      text-align: left;
    }

    .cmd-k-btn kbd {
      min-width: auto;
      text-align: center;
    }

    /* Footer is sibling of layout, so bind collapsed state directly. */
    .status-bar.status-bar-sidebar-collapsed {
      left: 48px;
    }

    @media (max-width: 900px) {
      .status-bar.status-bar-sidebar-collapsed {
        left: 0;
      }
    }
  `],
})
export class AppComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private http = inject(HttpClient);
  loadingService = inject(LoadingService);
  private prefsService = inject(PreferencesService); // ensures prefs load on startup
  terminalDock = inject(TerminalDockService);

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
  private anomalyPollInterval: any;
  sidebarCollapsed = false;
  sidebarMobileOpen = false;
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
    this.pollAnomalies();
    this.anomalyPollInterval = setInterval(() => this.pollAnomalies(), 30000);
  }

  ngOnDestroy() {
    clearInterval(this.anomalyPollInterval);
  }

  pollAnomalies() {
    this.api.anomalies().subscribe(res => {
      this.anomalies = res.alerts || [];
      this.anomalyCount = this.anomalies.length;
    });
  }

  alertStatus(severity: string): 'critical' | 'warning' | 'info' {
    if (severity === 'critical') return 'critical';
    if (severity === 'warning' || severity === 'high') return 'warning';
    return 'info';
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

  toggleMobileNav() {
    this.sidebarMobileOpen = !this.sidebarMobileOpen;
    if (this.sidebarMobileOpen) this.sidebarCollapsed = false;
  }

  handleSidebarClick(event: MouseEvent) {
    if ((event.target as HTMLElement).closest('a')) this.sidebarMobileOpen = false;
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
