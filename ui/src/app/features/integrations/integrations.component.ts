import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { PageInfoComponent } from '../../shared/components/page-info.component';
import { SpotlightComponent } from '../../shared/components/spotlight.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { RelatedPagesComponent } from '../../shared/components/related-pages.component';

@Component({
  selector: 'app-integrations',
  standalone: true,
  imports: [ButtonModule, TagModule, PageInfoComponent, SpotlightComponent, RelatedPagesComponent, PageHeaderComponent],
  template: `
    <app-spotlight id="integrations" title="Integrations" icon="pi pi-link"
      description="Connect external tools like Prometheus, Grafana, and alerting systems."
      [capabilities]="['Auto-discovery', 'Health checks', 'Connect/disconnect', 'Status monitoring']" [compact]="true" />

    <app-page-header title="Integrations" [subtitle]="integrations.length + ' connected · ' + discovered.length + ' discovered'">
        <button pButton icon="pi pi-search" label="Discover" class="p-button-outlined p-button-sm" (click)="discover()" [loading]="discovering"></button>
        <button pButton icon="pi pi-refresh" class="p-button-outlined p-button-sm p-button-rounded" (click)="refresh()" [loading]="loading"></button>
        <app-page-info title="Integrations" description="Manage connections to external monitoring, alerting, and observability tools in your cluster."
          [tips]="['Green = connected and healthy', 'Yellow = connected but degraded', 'Use Discover to auto-detect tools']"
          [commands]="['connect', 'disconnect <name>', 'connect discover', 'integrations']" />
    </app-page-header>

    <!-- Connected Integrations -->
    @if (integrations.length) {
      <h2 class="section-title">Connected</h2>
      <div class="integrations-grid">
        @for (item of integrations; track item.name) {
          <div class="integration-card" [class.healthy]="item.status === 'connected'" [class.degraded]="item.status === 'degraded'">
            <div class="card-header">
              <i [class]="iconFor(item.name)"></i>
              <div class="card-info">
                <strong>{{ item.name }}</strong>
                <span class="card-url">{{ item.url || '—' }}</span>
              </div>
              <p-tag [value]="item.status" [severity]="statusSeverity(item.status)" [rounded]="true" size="small" />
            </div>
            @if (item.version) {
              <div class="card-meta">v{{ item.version }}</div>
            }
            <div class="card-actions">
              <button pButton icon="pi pi-times" label="Disconnect" class="p-button-text p-button-sm p-button-danger" (click)="disconnect(item.name)"></button>
            </div>
          </div>
        }
      </div>
    }

    <!-- Discovered (not yet connected) -->
    @if (discovered.length) {
      <h2 class="section-title">Discovered</h2>
      <div class="integrations-grid">
        @for (item of discovered; track item.name) {
          <div class="integration-card discovered">
            <div class="card-header">
              <i [class]="iconFor(item.name)"></i>
              <div class="card-info">
                <strong>{{ item.name }}</strong>
                <span class="card-url">{{ item.url || 'Auto-detected' }}</span>
              </div>
              <p-tag value="available" severity="info" [rounded]="true" size="small" />
            </div>
            <div class="card-actions">
              <button pButton icon="pi pi-link" label="Connect" class="p-button-outlined p-button-sm" (click)="connect(item.name, item.url)"></button>
            </div>
          </div>
        }
      </div>
    }

    @if (!integrations.length && !discovered.length && !loading) {
      <div class="empty-state">
        <i class="pi pi-link"></i>
        <h3>No Integrations</h3>
        <p>Click <strong>Discover</strong> to auto-detect tools in your cluster, or connect manually via CLI.</p>
      </div>
    }

    @if (loading && !integrations.length) {
      <div class="loading"><div class="spin"></div> Loading integrations...</div>
    }

    <app-related-pages label="Related" [pages]="relatedPages" />
  `,
  styles: [`


    .section-title { font-size: 14px; font-weight: 600; margin: 24px 0 12px; color: var(--text-secondary); }

    .integrations-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
    .integration-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1); }
    .integration-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px -6px rgba(0,0,0,0.15); border-color: var(--border-hover); }
    .integration-card.healthy { border-left: 3px solid var(--success); }
    .integration-card.degraded { border-left: 3px solid var(--warning); }
    .integration-card.discovered { border-left: 3px solid var(--accent); }

    .card-header { display: flex; align-items: center; gap: 12px; }
    .card-header > i { font-size: 20px; color: var(--accent); }
    .card-info { flex: 1; display: flex; flex-direction: column; }
    .card-info strong { font-size: 14px; }
    .card-url { font-size: 11px; color: var(--text-muted); font-family: 'JetBrains Mono', monospace; }
    .card-meta { font-size: 11px; color: var(--text-muted); margin-top: 8px; }
    .card-actions { margin-top: 12px; display: flex; justify-content: flex-end; }

    .empty-state { text-align: center; padding: 60px 20px; color: var(--text-muted); }
    .empty-state i { font-size: 48px; margin-bottom: 16px; opacity: 0.3; }
    .empty-state h3 { font-size: 18px; margin: 0 0 8px; color: var(--text-primary); }
    .loading { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 60px; color: var(--text-muted); }
    .spin { width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (max-width: 768px) {
      .integrations-grid { grid-template-columns: 1fr; }
    }
  `],
})
export class IntegrationsComponent implements OnInit {
  private http = inject(HttpClient);
  integrations: any[] = [];
  discovered: any[] = [];
  loading = false;
  discovering = false;

  relatedPages = [
    { path: '/gitops', icon: 'pi pi-sync', label: 'GitOps', description: 'ArgoCD/Flux sync status' },
    { path: '/mesh', icon: 'pi pi-share-alt', label: 'Service Mesh', description: 'Istio/Linkerd mesh visibility' },
    { path: '/graph', icon: 'pi pi-sitemap', label: 'Service Map', description: 'Dependency graph visualization' },
    { path: '/settings', icon: 'pi pi-cog', label: 'Settings', description: 'Configure connection defaults' },
  ];

  ngOnInit() { this.refresh(); }

  refresh() {
    this.loading = true;
    this.http.get<any>('/api/integrations').subscribe({
      next: (res) => { this.integrations = res.integrations || []; this.loading = false; },
      error: () => { this.integrations = []; this.loading = false; },
    });
  }

  discover() {
    this.discovering = true;
    this.http.get<any>('/api/integrations/discover').subscribe({
      next: (res) => {
        this.discovered = (res.discovered || []).filter(
          (d: any) => !this.integrations.find(i => i.name === d.name)
        );
        this.discovering = false;
      },
      error: () => { this.discovering = false; },
    });
  }

  connect(name: string, url?: string) {
    this.http.post<any>('/api/integrations/connect', { name, url }).subscribe({
      next: () => { this.refresh(); this.discovered = this.discovered.filter(d => d.name !== name); },
    });
  }

  disconnect(name: string) {
    this.http.post<any>('/api/integrations/disconnect', { name }).subscribe({
      next: () => { this.refresh(); },
    });
  }

  statusSeverity(status: string): "success" | "warn" | "danger" | "info" | "secondary" | "contrast" | undefined {
    if (status === 'connected') return 'success';
    if (status === 'degraded') return 'warn';
    if (status === 'disconnected') return 'danger';
    return 'info';
  }

  iconFor(name: string): string {
    const map: Record<string, string> = {
      prometheus: 'pi pi-chart-line',
      grafana: 'pi pi-chart-bar',
      alertmanager: 'pi pi-bell',
      jaeger: 'pi pi-share-alt',
      loki: 'pi pi-file',
      argocd: 'pi pi-sync',
      flux: 'pi pi-sync',
    };
    return map[name.toLowerCase()] || 'pi pi-box';
  }
}
