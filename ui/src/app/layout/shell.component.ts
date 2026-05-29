import { Component, OnInit, HostListener, inject, Input } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ContextsResponse } from '../core/models';
import { PreferencesService } from '../core/services/preferences.service';
import { ApiService } from '../core/services/api.service';
import { HelpDialogComponent } from '../shared/components/help-dialog.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, HelpDialogComponent],
  template: `
    <div class="sidebar-header" [class.header-mini]="collapsed">
      <div class="ctx-block" [class.glass]="!collapsed">
        <div class="ctx-dot" [class.dot-ok]="clusterOk" [class.dot-bad]="!clusterOk" role="status" [attr.aria-label]="clusterOk ? 'Cluster connected' : 'Cluster unreachable'"></div>
        @if (!collapsed) {
          <div class="ctx-info">
            <span class="ctx-name">{{ currentContext }}</span>
          </div>
        }
      </div>
    </div>

    <!-- Favorites -->
    @if (favorites.length > 0) {
      <nav class="nav-section">
        <span class="nav-label" tabindex="-1">Favorites</span>
        @for (item of favorites; track item.path) {
          <div class="fav-row">
            <a [routerLink]="item.path" routerLinkActive="active" class="nav-item fav-item" tabindex="0">
              <i [class]="item.icon"></i>
              <span>{{ item.label }}</span>
            </a>
            <button class="fav-remove" (click)="removeFavorite(item.path)" title="Remove from favorites">
              <i class="pi pi-times"></i>
            </button>
          </div>
        }
      </nav>
    }

    <nav class="nav-section">
      <span class="nav-label" (click)="monitorCollapsed = !monitorCollapsed" (keydown)="onKey($event, toggleMonitor.bind(this))"
            tabindex="0" role="button" aria-label="Toggle Monitor Section" [attr.aria-expanded]="!monitorCollapsed">
        <i class="pi collapse-icon" [class.pi-chevron-down]="!monitorCollapsed" [class.pi-chevron-right]="monitorCollapsed"></i>
        Monitor
      </span>
      @if (!monitorCollapsed) {
        @for (item of monitorItems; track item.path) {
          <div class="nav-row">
            <a [routerLink]="item.path" routerLinkActive="active" class="nav-item" tabindex="0">
              <i [class]="item.icon"></i>
              <span>{{ item.label }}</span>
              @if (item.badge) { <span class="nav-badge">{{ item.badge }}</span> }
            </a>
            <button class="star-btn" [class.starred]="isFavorite(item.path)" (click)="toggleFavorite(item.path)" title="Toggle favorite">
              <i class="pi" [class.pi-star-fill]="isFavorite(item.path)" [class.pi-star]="!isFavorite(item.path)"></i>
            </button>
          </div>
        }
      }
    </nav>

    <nav class="nav-section">
      <span class="nav-label" (click)="opsCollapsed = !opsCollapsed" (keydown)="onKey($event, toggleOps.bind(this))"
            tabindex="0" role="button" aria-label="Toggle Operations Section" [attr.aria-expanded]="!opsCollapsed">
        <i class="pi collapse-icon" [class.pi-chevron-down]="!opsCollapsed" [class.pi-chevron-right]="opsCollapsed"></i>
        Operations
      </span>
      @if (!opsCollapsed) {
        @for (item of opsItems; track item.path) {
          <div class="nav-row">
            <a [routerLink]="item.path" routerLinkActive="active" class="nav-item" tabindex="0">
              <i [class]="item.icon"></i>
              <span>{{ item.label }}</span>
              @if (item.badge) { <span class="nav-badge">{{ item.badge }}</span> }
            </a>
            <button class="star-btn" [class.starred]="isFavorite(item.path)" (click)="toggleFavorite(item.path)" title="Toggle favorite">
              <i class="pi" [class.pi-star-fill]="isFavorite(item.path)" [class.pi-star]="!isFavorite(item.path)"></i>
            </button>
          </div>
        }
      }
    </nav>

    <nav class="nav-section">
      <span class="nav-label" (click)="infraCollapsed = !infraCollapsed" (keydown)="onKey($event, toggleInfra.bind(this))"
            tabindex="0" role="button" aria-label="Toggle Infrastructure Section" [attr.aria-expanded]="!infraCollapsed">
        <i class="pi collapse-icon" [class.pi-chevron-down]="!infraCollapsed" [class.pi-chevron-right]="infraCollapsed"></i>
        Infrastructure
      </span>
      @if (!infraCollapsed) {
        @for (item of infraItems; track item.path) {
          <div class="nav-row">
            <a [routerLink]="item.path" routerLinkActive="active" class="nav-item" tabindex="0">
              <i [class]="item.icon"></i>
              <span>{{ item.label }}</span>
              @if (item.badge) { <span class="nav-badge">{{ item.badge }}</span> }
            </a>
            <button class="star-btn" [class.starred]="isFavorite(item.path)" (click)="toggleFavorite(item.path)" title="Toggle favorite">
              <i class="pi" [class.pi-star-fill]="isFavorite(item.path)" [class.pi-star]="!isFavorite(item.path)"></i>
            </button>
          </div>
        }
      }
    </nav>

    <nav class="nav-section">
      <span class="nav-label" (click)="costCollapsed = !costCollapsed" (keydown)="onKey($event, toggleCost.bind(this))"
            tabindex="0" role="button" aria-label="Toggle Cost Section" [attr.aria-expanded]="!costCollapsed">
        <i class="pi collapse-icon" [class.pi-chevron-down]="!costCollapsed" [class.pi-chevron-right]="costCollapsed"></i>
        Cost & Analytics
      </span>
      @if (!costCollapsed) {
        @for (item of costItems; track item.path) {
          <div class="nav-row">
            <a [routerLink]="item.path" routerLinkActive="active" class="nav-item" tabindex="0">
              <i [class]="item.icon"></i>
              <span>{{ item.label }}</span>
              @if (item.badge) { <span class="nav-badge">{{ item.badge }}</span> }
            </a>
            <button class="star-btn" [class.starred]="isFavorite(item.path)" (click)="toggleFavorite(item.path)" title="Toggle favorite">
              <i class="pi" [class.pi-star-fill]="isFavorite(item.path)" [class.pi-star]="!isFavorite(item.path)"></i>
            </button>
          </div>
        }
      }
    </nav>

    <nav class="nav-section">
      <span class="nav-label" (click)="aiCollapsed = !aiCollapsed" (keydown)="onKey($event, toggleAi.bind(this))"
            tabindex="0" role="button" aria-label="Toggle Tools Section" [attr.aria-expanded]="!aiCollapsed">
        <i class="pi collapse-icon" [class.pi-chevron-down]="!aiCollapsed" [class.pi-chevron-right]="aiCollapsed"></i>
        Intelligence & Tools
      </span>
      @if (!aiCollapsed) {
        @for (item of aiItems; track item.path) {
          <a [routerLink]="item.path" routerLinkActive="active" class="nav-item" tabindex="0">
            <i [class]="item.icon"></i>
            <span>{{ item.label }}</span>
            @if (item.badge) { <span class="nav-badge">{{ item.badge }}</span> }
          </a>
        }
      }
    </nav>

    <div class="nav-footer">
      <a class="nav-item" (click)="openHelp()" (keydown)="onKey($event, openHelp.bind(this))" tabindex="0" role="button">
        <i class="pi pi-question-circle"></i>
        <span>Help</span>
        <kbd>H</kbd>
      </a>
    </div>

    @if (helpVisible) {
      <div class="help-overlay" (click)="helpVisible = false" (keydown.escape)="helpVisible = false">
        <div class="help-modal" role="dialog" aria-modal="true" aria-label="Kubsome Help" (click)="$event.stopPropagation()">
          <div class="help-header">
            <span id="help-dialog-title">Kubsome Help</span>
            <button class="help-close" (click)="helpVisible = false" aria-label="Close help dialog" #helpCloseBtn>
              <i class="pi pi-times"></i>
            </button>
          </div>
          <div class="help-body">
            <app-help-dialog />
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: calc(100vh - 48px - 24px); overflow-y: auto; overflow-x: hidden; }
    :host-context(.rail) .nav-label { display: none; }
    :host-context(.rail) .nav-item span { display: none; }
    :host-context(.rail) .nav-item kbd { display: none; }
    :host-context(.rail) .nav-item { justify-content: center; padding: 8px; margin: 1px 2px; }
    :host-context(.rail) .nav-item i { margin: 0; }
    :host-context(.rail) .fav-remove, :host-context(.rail) .star-btn { display: none; }
    :host-context(.rail) .nav-footer .nav-item span { display: none; }
    :host-context(.rail) .header-mini { padding: 12px 4px 8px; }
    :host-context(.rail) .logo-area { justify-content: center; }
    :host-context(.rail) .ctx-block { justify-content: center; padding: 6px; }
    .sidebar-header {
      padding: 20px 12px 16px;
    }
    .logo-area {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
      padding-left: 8px;
    }
    .logo-icon {
      font-size: 20px;
      color: var(--accent);
    }
    .logo-text {
      font-weight: 800;
      font-size: 18px;
      letter-spacing: -0.02em;
    }
    .ctx-block {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 0;
      background: transparent;
      border: none;
      border-bottom: 1px solid rgba(94, 84, 75, 0.1);
    }
    .ctx-dot {
      width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
    }
    .dot-ok { background: #10b981; box-shadow: 0 0 6px rgba(16, 185, 129, 0.5); }
    .dot-bad { background: #f43f5e; box-shadow: 0 0 6px rgba(244, 63, 94, 0.5); animation: ctxPulse 2s ease-in-out infinite; }
    @keyframes ctxPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
    .ctx-name {
      font-size: 11px; font-weight: 600; color: rgba(245, 240, 235, 0.75);
      font-family: 'JetBrains Mono', monospace;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .logo-icon {
      font-size: 20px;
      color: var(--accent);
    }
    .logo-text {
      font-weight: 800;
      font-size: 18px;
      letter-spacing: -0.02em;
    }
    .nav-section {
      margin-bottom: 4px;
      padding-top: 8px;
      border-top: 1px solid rgba(94, 84, 75, 0.06);
    }
    .nav-section:first-of-type { border-top: none; padding-top: 0; }
    .nav-label {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 9px;
      font-weight: 700;
      color: rgba(168, 158, 148, 0.45);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 6px 12px 4px;
      user-select: none;
      cursor: pointer;
      outline: none;
    }
    .nav-label:focus-visible { color: #d09c60; }
    .collapse-icon {
      font-size: 8px;
      opacity: 0.5;
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 7px 12px;
      margin: 0 8px;
      border-radius: 0;
      font-size: 12px;
      font-weight: 500;
      color: rgba(168, 158, 148, 0.5);
      cursor: pointer;
      transition: all 0.12s;
      text-decoration: none;
      overflow: hidden;
      white-space: nowrap;
      border: none;
      border-left: 2px solid transparent;
    }
    .nav-item:hover {
      color: rgba(245, 240, 235, 0.85);
      background: transparent;
      transform: translateX(2px);
    }
    .nav-item.active {
      color: #d09c60;
      border-left-color: #d09c60;
      background: transparent;
    }
    .nav-item:focus-visible {
      outline: none;
      border-left-color: rgba(208, 156, 96, 0.4);
    }
    .nav-badge {
      font-size: 7px; font-weight: 800; padding: 1px 4px; border-radius: 0;
      background: transparent; color: rgba(208, 156, 96, 0.7); margin-left: 6px;
      text-transform: uppercase; letter-spacing: 0.06em;
      border: 1px solid rgba(208, 156, 96, 0.2);
    }
    .nav-item i {
      font-size: 12px;
      width: 16px;
      text-align: center;
      opacity: 0.4;
    }
    .nav-item:hover i { opacity: 0.7; }
    .nav-item.active i { opacity: 1; }
    .nav-item kbd {
      margin-left: auto;
      font-size: 9px;
      padding: 1px 4px;
      border-radius: 0;
      background: transparent;
      border: none;
      border-left: 1px solid rgba(94, 84, 75, 0.12);
      color: rgba(168, 158, 148, 0.35);
      font-family: 'JetBrains Mono', monospace;
      padding-left: 6px;
    }
    .fav-row, .nav-row {
      display: flex;
      align-items: center;
    }
    .fav-row .nav-item, .nav-row .nav-item { flex: 1; }
    .fav-remove, .star-btn {
      background: none;
      border: none;
      color: rgba(168, 158, 148, 0.4);
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      font-size: 10px;
      opacity: 0;
      transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
      outline: none;
    }
    .fav-row:hover .fav-remove, .nav-row:hover .star-btn { opacity: 0.6; }
    .fav-row .fav-remove:focus-visible, .nav-row .star-btn:focus-visible { opacity: 1; color: #f59e0b; box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.4); }
    .fav-remove:hover { opacity: 1 !important; color: #f43f5e; }
    .star-btn:hover { opacity: 1 !important; color: #f59e0b; }
    .star-btn.starred { opacity: 0.8; color: #f59e0b; }
    .star-btn.starred:hover { opacity: 1; }
    .nav-footer {
      margin-top: auto;
      padding-top: 6px;
      border-top: 1px solid rgba(94, 84, 75, 0.12);
    }
    .help-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.6);
      backdrop-filter: blur(4px); z-index: 9000;
      display: flex; align-items: center; justify-content: center;
    }
    .help-modal {
      width: min(650px, 90vw); max-height: 80vh;
      background: linear-gradient(180deg, rgba(13, 17, 28, 0.98) 0%, rgba(8, 11, 20, 1) 100%);
      border: 1px solid rgba(94, 84, 75, 0.2); border-radius: 14px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.7); display: flex; flex-direction: column;
      overflow: hidden;
      animation: helpIn 0.25s cubic-bezier(0.34,1.56,0.64,1);
    }
    @keyframes helpIn { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
    @media (max-width: 768px) {
      .help-modal { width: 100vw; height: 100vh; max-height: 100vh; border-radius: 0; }
    }
    .help-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 20px; border-bottom: 1px solid rgba(94, 84, 75, 0.12);
      font-size: 15px; font-weight: 600;
    }
    .help-close {
      background: none; border: none; color: rgba(168, 158, 148, 0.5);
      cursor: pointer; padding: 4px; border-radius: 4px;
    }
    .help-close:hover { background: rgba(245, 240, 235, 0.04); color: rgba(245, 240, 235, 0.85); }
    .help-close:focus-visible { outline: none; background: rgba(208, 156, 96, 0.04); color: #d09c60; box-shadow: 0 0 0 2px rgba(208, 156, 96, 0.3); }
    .help-body { padding: 20px; overflow-y: auto; }

    /* ─── Light Mode ──────────────────────────────────────────────── */
    :host-context([data-theme="light"]) .ctx-block {
      border-bottom-color: rgba(0, 0, 0, 0.06);
    }
    :host-context([data-theme="light"]) .ctx-name { color: rgba(0, 0, 0, 0.7); }
    :host-context([data-theme="light"]) .nav-label { color: rgba(0, 0, 0, 0.35); }
    :host-context([data-theme="light"]) .nav-label:focus-visible { color: #9a5129; }
    :host-context([data-theme="light"]) .nav-item { color: rgba(0, 0, 0, 0.4); }
    :host-context([data-theme="light"]) .nav-item:hover {
      color: rgba(0, 0, 0, 0.8);
    }
    :host-context([data-theme="light"]) .nav-item.active {
      color: #9a5129;
      border-left-color: #9a5129;
    }
    :host-context([data-theme="light"]) .nav-item:focus-visible {
      border-left-color: rgba(154, 81, 41, 0.3);
    }
    :host-context([data-theme="light"]) .nav-badge {
      color: rgba(154, 81, 41, 0.7); border-color: rgba(154, 81, 41, 0.15);
    }
    :host-context([data-theme="light"]) .nav-item i { opacity: 0.5; }
    :host-context([data-theme="light"]) .nav-item.active i { opacity: 1; }
    :host-context([data-theme="light"]) .nav-item kbd {
      border-left-color: rgba(0, 0, 0, 0.06);
      color: rgba(0, 0, 0, 0.25);
    }
    :host-context([data-theme="light"]) .fav-remove, :host-context([data-theme="light"]) .star-btn {
      color: rgba(0, 0, 0, 0.3);
    }
    :host-context([data-theme="light"]) .nav-footer {
      border-top-color: rgba(0, 0, 0, 0.06);
    }
    :host-context([data-theme="light"]) .help-modal {
      background: #ffffff;
      border-color: rgba(0, 0, 0, 0.1);
    }
    :host-context([data-theme="light"]) .help-header {
      border-bottom-color: rgba(0, 0, 0, 0.06);
    }
    :host-context([data-theme="light"]) .help-close { color: rgba(0, 0, 0, 0.4); }
    :host-context([data-theme="light"]) .help-close:hover { background: rgba(0, 0, 0, 0.04); color: rgba(0, 0, 0, 0.8); }
  `],
})
export class ShellComponent implements OnInit {
  @Input() collapsed = false;
  private http = inject(HttpClient);
  private router = inject(Router);
  private api = inject(ApiService);

  currentContext = '...';
  clusterOk = true;
  helpVisible = false;
  monitorCollapsed = false;
  opsCollapsed = false;
  infraCollapsed = false;
  costCollapsed = false;
  aiCollapsed = false;

  private prefsService = inject(PreferencesService);
  favorites: { path: string; icon: string; label: string }[] = [];

  monitorItems: any[] = [
    { path: '/dashboard', icon: 'pi pi-objects-column', label: 'Dashboard' },
    { path: '/monitor', icon: 'pi pi-desktop', label: 'Monitor' },
    { path: '/health-signals', icon: 'pi pi-wave-pulse', label: 'Signals', badge: 'NEW' },
    { path: '/pods', icon: 'pi pi-box', label: 'Pods' },
    { path: '/events', icon: 'pi pi-bolt', label: 'Events' },
    { path: '/metrics', icon: 'pi pi-chart-line', label: 'Metrics' },
    { path: '/scorecard', icon: 'pi pi-trophy', label: 'Scorecard' },
    { path: '/timeline', icon: 'pi pi-history', label: 'Timeline' },
    { path: '/doctor', icon: 'pi pi-heart', label: 'Health' },
  ];

  opsItems: any[] = [
    { path: '/deployments', icon: 'pi pi-send', label: 'Deployments' },
    { path: '/logs', icon: 'pi pi-align-left', label: 'Logs' },
    { path: '/jobs', icon: 'pi pi-clock', label: 'Jobs' },
    { path: '/namespace', icon: 'pi pi-th-large', label: 'Namespace' },
    { path: '/resources', icon: 'pi pi-database', label: 'Resources' },
    { path: '/rbac', icon: 'pi pi-shield', label: 'RBAC' },
    { path: '/network', icon: 'pi pi-globe', label: 'Network' },
    { path: '/secrets', icon: 'pi pi-lock', label: 'Pull Secrets' },
    { path: '/incident', icon: 'pi pi-exclamation-circle', label: 'Incident' },
    { path: '/audit', icon: 'pi pi-file-check', label: 'Audit' },
    { path: '/yaml', icon: 'pi pi-file-edit', label: 'YAML Editor' },
    { path: '/yaml-diff', icon: 'pi pi-copy', label: 'YAML Diff' },
  ];

  infraItems: any[] = [
    { path: '/graph', icon: 'pi pi-sitemap', label: 'Service Map' },
    { path: '/gateway-monitor', icon: 'pi pi-server', label: 'Gateway' },
    { path: '/gitops', icon: 'pi pi-sync', label: 'GitOps', badge: 'NEW' },
    { path: '/mesh', icon: 'pi pi-share-alt', label: 'Service Mesh', badge: 'NEW' },
    { path: '/integrations', icon: 'pi pi-link', label: 'Integrations', badge: 'NEW' },
    { path: '/compare', icon: 'pi pi-arrows-h', label: 'Compare' },
    { path: '/policy', icon: 'pi pi-verified', label: 'Policy' },
    { path: '/taints', icon: 'pi pi-ban', label: 'Node Taints' },
    { path: '/node-ops', icon: 'pi pi-cog', label: 'Node Ops', badge: 'NEW' },
    { path: '/resource-ops', icon: 'pi pi-wrench', label: 'Resource Ops', badge: 'NEW' },
  ];

  costItems: any[] = [
    { path: '/analytics', icon: 'pi pi-chart-bar', label: 'Analytics', badge: 'NEW' },
    { path: '/cost', icon: 'pi pi-dollar', label: 'Optimization' },
    { path: '/cost-estimate', icon: 'pi pi-calculator', label: 'Cost Estimate' },
    { path: '/rightsizing', icon: 'pi pi-sliders-h', label: 'Right-Sizing', badge: 'NEW' },
    { path: '/helm', icon: 'pi pi-server', label: 'Helm', badge: 'NEW' },
    { path: '/port-forwards', icon: 'pi pi-link', label: 'Port Forwards', badge: 'NEW' },
    { path: '/blast-radius', icon: 'pi pi-bullseye', label: 'Blast Radius', badge: 'NEW' },
    { path: '/chargeback', icon: 'pi pi-wallet', label: 'Chargeback', badge: 'NEW' },
    { path: '/idle-resources', icon: 'pi pi-trash', label: 'Idle Resources', badge: 'NEW' },
  ];

  aiItems: any[] = [
    { path: '/ai', icon: 'pi pi-sparkles', label: 'AI Assistant' },
    { path: '/log-correlation', icon: 'pi pi-arrows-alt', label: 'Log Correlate' },
    { path: '/runbooks', icon: 'pi pi-book', label: 'Runbooks' },
    { path: '/pins', icon: 'pi pi-bookmark', label: 'Pins' },
    { path: '/watches', icon: 'pi pi-eye', label: 'Watches' },
    { path: '/schedule', icon: 'pi pi-calendar', label: 'Schedules' },
    { path: '/terminal', icon: 'pi pi-code', label: 'Terminal' },
    { path: '/profiles', icon: 'pi pi-user', label: 'Profiles', badge: 'NEW' },
    { path: '/stats', icon: 'pi pi-percentage', label: 'Usage Stats' },
    { path: '/settings', icon: 'pi pi-cog', label: 'Settings' },
  ];

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    const tag = (event.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (event.key === 'h' || event.key === 'H') this.openHelp();

    // G + key navigation shortcuts
    if (this.pendingG) {
      this.pendingG = false;
      switch (event.key) {
        case 'd': this.router.navigate(['/dashboard']); break;
        case 'p': this.router.navigate(['/pods']); break;
        case 'e': this.router.navigate(['/events']); break;
        case 'l': this.router.navigate(['/logs']); break;
        case 't': this.router.navigate(['/terminal']); break;
        case 'a': this.router.navigate(['/ai']); break;
        case 'm': this.router.navigate(['/metrics']); break;
        case 'r': this.router.navigate(['/runbooks']); break;
        case 's': this.router.navigate(['/settings']); break;
      }
      return;
    }
    if (event.key === 'g') {
      this.pendingG = true;
      setTimeout(() => this.pendingG = false, 500);
    }
  }

  private pendingG = false;

  openHelp() { this.helpVisible = true; }

  toggleMonitor() { this.monitorCollapsed = !this.monitorCollapsed; }
  toggleOps() { this.opsCollapsed = !this.opsCollapsed; }
  toggleInfra() { this.infraCollapsed = !this.infraCollapsed; }
  toggleCost() { this.costCollapsed = !this.costCollapsed; }
  toggleAi() { this.aiCollapsed = !this.aiCollapsed; }

  onKey(event: KeyboardEvent, action: Function) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      action();
    }
  }

  ngOnInit() {
    this.loadFavorites();
    this.http.get<any>('/api/contexts').subscribe({
      next: (res) => { this.currentContext = res.current ?? 'none'; },
      error: () => {},
    });
    this.http.get<any>('/api/uptime').subscribe({
      next: (res) => { this.clusterOk = res.api_reachable && !res.cluster_down; },
      error: () => { this.clusterOk = false; },
    });
  }
  private get allItems() {
    return [...this.monitorItems, ...this.opsItems, ...this.infraItems, ...this.costItems, ...this.aiItems];
  }

  loadFavorites() {
    const paths = this.prefsService.get('sidebarFavorites');
    this.favorites = paths.map(p => this.allItems.find(i => i.path === p)).filter(Boolean) as any[];
  }

  toggleFavorite(path: string) {
    if (this.isFavorite(path)) {
      this.removeFavorite(path);
    } else {
      this.addFavorite(path);
    }
  }

  removeFavorite(path: string) {
    const paths = this.prefsService.get('sidebarFavorites').filter(p => p !== path);
    this.prefsService.set('sidebarFavorites', paths);
    this.loadFavorites();
  }

  addFavorite(path: string) {
    const paths = this.prefsService.get('sidebarFavorites');
    if (!paths.includes(path)) {
      this.prefsService.set('sidebarFavorites', [...paths, path]);
      this.loadFavorites();
    }
  }

  isFavorite(path: string): boolean {
    return this.prefsService.get('sidebarFavorites').includes(path);
  }

}
