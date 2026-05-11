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
      <div class="logo-area">
        <i class="pi pi-box logo-icon"></i>
        @if (!collapsed) { <span class="logo-text">Kubsome</span> }
      </div>
      <div class="ctx-block" [class.glass]="!collapsed">
        <div class="ctx-dot" [class.dot-ok]="clusterOk" [class.dot-bad]="!clusterOk"></div>
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
        <span class="nav-label">Favorites</span>
        @for (item of favorites; track item.path) {
          <div class="fav-row">
            <a [routerLink]="item.path" routerLinkActive="active" class="nav-item fav-item">
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
      <span class="nav-label" (click)="monitorCollapsed = !monitorCollapsed" style="cursor: pointer;">
        <i class="pi collapse-icon" [class.pi-chevron-down]="!monitorCollapsed" [class.pi-chevron-right]="monitorCollapsed"></i>
        Monitor
      </span>
      @if (!monitorCollapsed) {
        @for (item of monitorItems; track item.path) {
          <div class="nav-row">
            <a [routerLink]="item.path" routerLinkActive="active" class="nav-item">
              <i [class]="item.icon"></i>
              <span>{{ item.label }}</span>
            </a>
            <button class="star-btn" [class.starred]="isFavorite(item.path)" (click)="toggleFavorite(item.path)" title="Toggle favorite">
              <i class="pi" [class.pi-star-fill]="isFavorite(item.path)" [class.pi-star]="!isFavorite(item.path)"></i>
            </button>
          </div>
        }
      }
    </nav>

    <nav class="nav-section">
      <span class="nav-label" (click)="opsCollapsed = !opsCollapsed" style="cursor: pointer;">
        <i class="pi collapse-icon" [class.pi-chevron-down]="!opsCollapsed" [class.pi-chevron-right]="opsCollapsed"></i>
        Operations
      </span>
      @if (!opsCollapsed) {
        @for (item of opsItems; track item.path) {
          <div class="nav-row">
            <a [routerLink]="item.path" routerLinkActive="active" class="nav-item">
              <i [class]="item.icon"></i>
              <span>{{ item.label }}</span>
            </a>
            <button class="star-btn" [class.starred]="isFavorite(item.path)" (click)="toggleFavorite(item.path)" title="Toggle favorite">
              <i class="pi" [class.pi-star-fill]="isFavorite(item.path)" [class.pi-star]="!isFavorite(item.path)"></i>
            </button>
          </div>
        }
      }
    </nav>

    <nav class="nav-section">
      <span class="nav-label" (click)="aiCollapsed = !aiCollapsed" style="cursor: pointer;">
        <i class="pi collapse-icon" [class.pi-chevron-down]="!aiCollapsed" [class.pi-chevron-right]="aiCollapsed"></i>
        Intelligence
      </span>
      @if (!aiCollapsed) {
        @for (item of aiItems; track item.path) {
          <a [routerLink]="item.path" routerLinkActive="active" class="nav-item">
            <i [class]="item.icon"></i>
            <span>{{ item.label }}</span>
          </a>
        }
      }
    </nav>

    <div class="nav-footer">
      <a class="nav-item" (click)="openHelp()">
        <i class="pi pi-question-circle"></i>
        <span>Help</span>
        <kbd>H</kbd>
      </a>
    </div>

    @if (helpVisible) {
      <div class="help-overlay" (click)="helpVisible = false">
        <div class="help-modal" (click)="$event.stopPropagation()">
          <div class="help-header">
            <span>Kubsome Help</span>
            <button class="help-close" (click)="helpVisible = false"><i class="pi pi-times"></i></button>
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
      border-radius: var(--radius);
      background: var(--bg-elevated);
      border: 1px solid var(--border);
    }
    .context-card {
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 8px 12px;
      margin: 0 8px;
    }
    .cc-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cc-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--success);
      box-shadow: 0 0 4px var(--success);
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
      margin-bottom: 8px;
    }
    .nav-label {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 9px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 4px 10px 4px;
      user-select: none;
      cursor: pointer;
    }
    .collapse-icon {
      font-size: 9px;
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      margin: 1px 8px;
      border-radius: var(--radius);
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      text-decoration: none;
      overflow: hidden;
      white-space: nowrap;
    }
    .nav-item:hover {
      background: var(--bg-hover);
      color: var(--text);
      transform: translateX(2px);
    }
    .nav-item.active {
      background: var(--accent-subtle);
      color: var(--accent);
      box-shadow: inset 2px 0 0 var(--accent);
    }
    .nav-item i {
      font-size: 13px;
      width: 16px;
      text-align: center;
    }
    .nav-item kbd {
      margin-left: auto;
      font-size: 9px;
      padding: 1px 4px;
      border-radius: 3px;
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      color: var(--text-muted);
    }
    .fav-row, .nav-row {
      display: flex;
      align-items: center;
    }
    .fav-row .nav-item, .nav-row .nav-item { flex: 1; }
    .fav-remove, .star-btn {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      font-size: 10px;
      opacity: 0;
      transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
    }
    .fav-row:hover .fav-remove, .nav-row:hover .star-btn { opacity: 0.6; }
    .fav-remove:hover { opacity: 1 !important; color: var(--danger); }
    .star-btn:hover { opacity: 1 !important; color: var(--warning); }
    .star-btn.starred { opacity: 0.8; color: var(--warning); }
    .star-btn.starred:hover { opacity: 1; }
    .nav-footer {
      margin-top: auto;
      padding-top: 6px;
      border-top: 1px solid var(--border);
    }
    .help-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.6);
      backdrop-filter: blur(4px); z-index: 9000;
      display: flex; align-items: center; justify-content: center;
    }
    .help-modal {
      width: min(650px, 90vw); max-height: 80vh; background: var(--bg-card);
      border: 1px solid var(--border); border-radius: var(--radius);
      box-shadow: 0 20px 60px rgba(0,0,0,0.5); display: flex; flex-direction: column;
      overflow: hidden;
      animation: helpIn 0.25s cubic-bezier(0.34,1.56,0.64,1);
    }
    @keyframes helpIn { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
    @media (max-width: 768px) {
      .help-modal { width: 100vw; height: 100vh; max-height: 100vh; border-radius: 0; }
    }
    .help-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 20px; border-bottom: 1px solid var(--border);
      font-size: 15px; font-weight: 600;
    }
    .help-close {
      background: none; border: none; color: var(--text-muted);
      cursor: pointer; padding: 4px; border-radius: 4px;
    }
    .help-close:hover { background: var(--bg-hover); color: var(--text); }
    .help-body { padding: 20px; overflow-y: auto; }
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
  aiCollapsed = false;

  private prefsService = inject(PreferencesService);
  favorites: { path: string; icon: string; label: string }[] = [];

  monitorItems = [
    { path: '/dashboard', icon: 'pi pi-objects-column', label: 'Dashboard' },
    { path: '/monitor', icon: 'pi pi-desktop', label: 'Monitor' },
    { path: '/gateway-monitor', icon: 'pi pi-server', label: 'Gateway' },
    { path: '/pods', icon: 'pi pi-box', label: 'Pods' },
    { path: '/events', icon: 'pi pi-bolt', label: 'Events' },
    { path: '/metrics', icon: 'pi pi-chart-bar', label: 'Metrics' },
    { path: '/namespace', icon: 'pi pi-th-large', label: 'Namespace' },
    { path: '/timeline', icon: 'pi pi-history', label: 'Timeline' },
    { path: '/scorecard', icon: 'pi pi-trophy', label: 'Scorecard' },
    { path: '/cost', icon: 'pi pi-dollar', label: 'Optimization' },
    { path: '/cost-estimate', icon: 'pi pi-calculator', label: 'Cost' },
  ];

  opsItems = [
    { path: '/deployments', icon: 'pi pi-send', label: 'Deployments' },
    { path: '/logs', icon: 'pi pi-align-left', label: 'Logs' },
    { path: '/jobs', icon: 'pi pi-clock', label: 'Jobs' },
    { path: '/rbac', icon: 'pi pi-shield', label: 'RBAC' },
    { path: '/network', icon: 'pi pi-globe', label: 'Network' },
    { path: '/resources', icon: 'pi pi-database', label: 'Resources' },
    { path: '/secrets', icon: 'pi pi-lock', label: 'Pull Secrets' },
    { path: '/incident', icon: 'pi pi-exclamation-circle', label: 'Incident' },
    { path: '/graph', icon: 'pi pi-sitemap', label: 'Service Map' },
    { path: '/yaml', icon: 'pi pi-file-edit', label: 'YAML Editor' },
    { path: '/yaml-diff', icon: 'pi pi-copy', label: 'YAML Diff' },
    { path: '/runbooks', icon: 'pi pi-book', label: 'Runbooks' },
    { path: '/compare', icon: 'pi pi-arrows-h', label: 'Compare' },
  ];

  aiItems = [
    { path: '/ai', icon: 'pi pi-sparkles', label: 'AI Assistant' },
    { path: '/log-correlation', icon: 'pi pi-link', label: 'Log Correlate' },
    { path: '/pins', icon: 'pi pi-bookmark', label: 'Pins' },
    { path: '/watches', icon: 'pi pi-eye', label: 'Watches' },
    { path: '/terminal', icon: 'pi pi-code', label: 'Terminal' },
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
  private allItems = [
    { path: '/dashboard', icon: 'pi pi-objects-column', label: 'Dashboard' },
    { path: '/pods', icon: 'pi pi-box', label: 'Pods' },
    { path: '/events', icon: 'pi pi-bolt', label: 'Events' },
    { path: '/metrics', icon: 'pi pi-chart-bar', label: 'Metrics' },
    { path: '/deployments', icon: 'pi pi-send', label: 'Deployments' },
    { path: '/logs', icon: 'pi pi-align-left', label: 'Logs' },
    { path: '/jobs', icon: 'pi pi-clock', label: 'Jobs' },
    { path: '/terminal', icon: 'pi pi-code', label: 'Terminal' },
    { path: '/ai', icon: 'pi pi-sparkles', label: 'AI Assistant' },
    { path: '/incident', icon: 'pi pi-exclamation-circle', label: 'Incident' },
  ];

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
