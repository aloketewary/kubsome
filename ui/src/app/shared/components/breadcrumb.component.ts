import { Component, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  template: `
    @if (trail.length > 1) {
      <nav class="breadcrumb">
        @for (item of trail; track $index; let last = $last) {
          @if (!last) {
            <a class="crumb" (click)="go(item.path)">{{ item.label }}</a>
            <i class="pi pi-chevron-right separator"></i>
          } @else {
            <span class="crumb current">{{ item.label }}</span>
          }
        }
      </nav>
    }
  `,
  styles: [`
    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 16px;
      font-size: 12px;
    }
    .crumb {
      color: var(--text-muted);
      cursor: pointer;
      transition: color 0.12s;
    }
    .crumb:hover { color: var(--accent); }
    .crumb.current { color: var(--text-secondary); cursor: default; }
    .separator { font-size: 8px; color: var(--text-muted); }
  `],
})
export class BreadcrumbComponent {
  private router = inject(Router);
  trail: { label: string; path: string }[] = [];

  private labels: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/pods': 'Pods',
    '/events': 'Events',
    '/metrics': 'Metrics',
    '/deployments': 'Deployments',
    '/logs': 'Logs',
    '/jobs': 'Jobs',
    '/rbac': 'RBAC',
    '/network': 'Network',
    '/incident': 'Incident',
    '/namespace': 'Namespace',
    '/ai': 'AI Assistant',
    '/terminal': 'Terminal',
    '/search': 'Search',
  };

  constructor() {
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      const path = e.urlAfterRedirects || e.url;
      const basePath = '/' + path.split('/')[1]?.split('?')[0];
      const label = this.labels[basePath] || basePath;

      // Keep last 3 in trail, avoid duplicates at end
      if (this.trail.length === 0 || this.trail[this.trail.length - 1].path !== basePath) {
        this.trail.push({ label, path: basePath });
        if (this.trail.length > 3) this.trail.shift();
      }
    });
  }

  go(path: string) {
    this.router.navigate([path]);
  }
}
