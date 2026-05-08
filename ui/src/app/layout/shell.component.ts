import { Component, OnInit, HostListener, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DialogModule } from 'primeng/dialog';
import { ContextsResponse } from '../core/models';
import { HelpDialogComponent } from '../shared/components/help-dialog.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, DialogModule, HelpDialogComponent],
  template: `
    <div class="ctx-block">
      <div class="ctx-dot"></div>
      <div class="ctx-info">
        <span class="ctx-name">{{ currentContext }}</span>
      </div>
    </div>

    <!-- Favorites -->
    @if (favorites.length > 0) {
      <nav class="nav-section">
        <span class="nav-label">Favorites</span>
        @for (item of favorites; track item.path) {
          <a [routerLink]="item.path" routerLinkActive="active" class="nav-item">
            <i [class]="item.icon"></i>
            <span>{{ item.label }}</span>
          </a>
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
          <a [routerLink]="item.path" routerLinkActive="active" class="nav-item">
            <i [class]="item.icon"></i>
            <span>{{ item.label }}</span>
          </a>
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
          <a [routerLink]="item.path" routerLinkActive="active" class="nav-item">
            <i [class]="item.icon"></i>
            <span>{{ item.label }}</span>
          </a>
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

    <p-dialog header="KubeEasy Help" [(visible)]="helpVisible" [modal]="true" [style]="{ width: '650px' }">
      <app-help-dialog />
    </p-dialog>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: calc(100vh - 52px); }
    .ctx-block {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 12px 16px;
    }
    .ctx-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--success);
      box-shadow: 0 0 6px var(--success);
    }
    .ctx-name {
      font-size: 11px;
      color: var(--text-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .nav-section {
      margin-bottom: 16px;
    }
    .nav-label {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 4px 12px 6px;
      user-select: none;
    }
    .collapse-icon {
      font-size: 10px;
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 13px;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.12s ease;
      text-decoration: none;
    }
    .nav-item:hover {
      background: var(--bg-hover);
      color: var(--text);
    }
    .nav-item.active {
      background: var(--accent-subtle);
      color: var(--accent);
    }
    .nav-item i {
      font-size: 14px;
      width: 18px;
      text-align: center;
    }
    .nav-item kbd {
      margin-left: auto;
      font-size: 10px;
      padding: 1px 5px;
      border-radius: 4px;
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      color: var(--text-muted);
    }
    .nav-footer {
      margin-top: auto;
      padding-top: 8px;
      border-top: 1px solid var(--border);
    }
  `],
})
export class ShellComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);

  currentContext = '...';
  helpVisible = false;
  monitorCollapsed = false;
  opsCollapsed = false;
  aiCollapsed = false;

  favorites = [
    { path: '/dashboard', icon: 'pi pi-objects-column', label: 'Dashboard' },
    { path: '/pods', icon: 'pi pi-box', label: 'Pods' },
    { path: '/logs', icon: 'pi pi-align-left', label: 'Logs' },
  ];

  monitorItems = [
    { path: '/dashboard', icon: 'pi pi-objects-column', label: 'Dashboard' },
    { path: '/pods', icon: 'pi pi-box', label: 'Pods' },
    { path: '/events', icon: 'pi pi-bolt', label: 'Events' },
    { path: '/metrics', icon: 'pi pi-chart-bar', label: 'Metrics' },
    { path: '/namespace', icon: 'pi pi-th-large', label: 'Namespace' },
  ];

  opsItems = [
    { path: '/deployments', icon: 'pi pi-send', label: 'Deployments' },
    { path: '/logs', icon: 'pi pi-align-left', label: 'Logs' },
    { path: '/jobs', icon: 'pi pi-clock', label: 'Jobs' },
    { path: '/rbac', icon: 'pi pi-shield', label: 'RBAC' },
    { path: '/network', icon: 'pi pi-globe', label: 'Network' },
    { path: '/incident', icon: 'pi pi-exclamation-circle', label: 'Incident' },
    { path: '/graph', icon: 'pi pi-sitemap', label: 'Service Map' },
    { path: '/yaml', icon: 'pi pi-file-edit', label: 'YAML Editor' },
  ];

  aiItems = [
    { path: '/ai', icon: 'pi pi-sparkles', label: 'AI Assistant' },
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
    this.http.get<ContextsResponse>('http://localhost:8000/api/contexts').subscribe(res => {
      this.currentContext = res.current ?? 'none';
    });
  }
}
