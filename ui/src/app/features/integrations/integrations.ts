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
  templateUrl: './integrations.html',
  styleUrl: './integrations.scss',
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
