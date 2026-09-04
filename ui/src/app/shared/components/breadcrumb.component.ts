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
    '/monitor/dashboard': 'Dashboard',
    '/monitor/overview': 'Monitor',
    '/monitor/investigate': 'Investigate',
    '/monitor/metrics': 'Metrics',
    '/monitor/events': 'Events',
    '/monitor/logs': 'Logs',
    '/monitor/health-signals': 'Health Signals',
    '/monitor/scorecard': 'Scorecard',
    '/monitor/timeline': 'Timeline',
    '/monitor/doctor': 'Health Check',
    '/monitor/log-correlation': 'Log Correlation',
    '/monitor/my-dashboard': 'Custom Dashboard',
    '/operations/pods': 'Pods',
    '/operations/deployments': 'Deployments',
    '/operations/jobs': 'Jobs',
    '/operations/namespace': 'Namespace',
    '/operations/rbac': 'RBAC',
    '/operations/resources': 'Resources',
    '/operations/secrets': 'Secrets',
    '/operations/incident': 'Incident',
    '/operations/terminal': 'Terminal',
    '/operations/runbooks': 'Runbooks',
    '/operations/yaml': 'YAML Editor',
    '/operations/yaml-diff': 'YAML Diff',
    '/operations/audit': 'Audit',
    '/operations/schedule': 'Schedules',
    '/infrastructure/network': 'Network',
    '/infrastructure/graph': 'Service Map',
    '/infrastructure/gateway-monitor': 'Gateway',
    '/infrastructure/gitops': 'GitOps',
    '/infrastructure/policy': 'Policy',
    '/infrastructure/mesh': 'Service Mesh',
    '/infrastructure/integrations': 'Integrations',
    '/infrastructure/compare': 'Compare',
    '/infrastructure/helm': 'Helm',
    '/infrastructure/port-forwards': 'Port Forwards',
    '/infrastructure/blast-radius': 'Blast Radius',
    '/infrastructure/taints': 'Node Taints',
    '/infrastructure/node-ops': 'Node Operations',
    '/infrastructure/resource-ops': 'Resource Operations',
    '/cost-analytics/analytics': 'Analytics',
    '/cost-analytics/cost': 'Optimization',
    '/cost-analytics/cost-estimate': 'Cost Estimate',
    '/cost-analytics/rightsizing': 'Right-Sizing',
    '/cost-analytics/stats': 'Usage Analytics',
    '/cost-analytics/chargeback': 'Chargeback',
    '/cost-analytics/idle-resources': 'Idle Resources',
    '/intelligence/ai': 'AI Assistant',
    '/intelligence/search': 'Search',
    '/intelligence/pins': 'Pins',
    '/intelligence/watches': 'Watches',
    '/intelligence/profiles': 'Profiles',
    '/intelligence/plugins': 'Plugins',
    '/intelligence/settings': 'Settings',
  };

  constructor() {
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      const path = e.urlAfterRedirects || e.url;
      const routePath = '/' + path.split('?')[0].split('/').filter(Boolean).join('/');
      const segments = routePath.split('/').filter(Boolean);
      const pagePath = '/' + segments.slice(0, 2).join('/');
      const label = this.labels[pagePath] || this.titleCase(segments[1] || segments[0] || 'Home');

      // Keep last 3 in trail, avoid duplicates at end
      if (this.trail.length === 0 || this.trail[this.trail.length - 1].path !== pagePath) {
        this.trail.push({ label, path: pagePath });
        if (this.trail.length > 3) this.trail.shift();
      }
    });
  }

  go(path: string) {
    this.router.navigate([path]);
  }

  private titleCase(path: string): string {
    return path.replace('/', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
}
