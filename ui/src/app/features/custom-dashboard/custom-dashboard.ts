import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';

interface Widget {
  id: string;
  type: string;
  title: string;
  size: 'sm' | 'md' | 'lg';
  refreshInterval: number;
  config?: any;
  data?: any;
  loading?: boolean;
  lastRefresh?: number;
}

const WIDGET_CATALOG = [
  { type: 'pod_count', title: 'Pod Count', icon: 'pi pi-box', color: '#3b82f6', desc: 'Total pods with health breakdown', size: 'sm' as const },
  { type: 'node_count', title: 'Node Status', icon: 'pi pi-server', color: '#22c55e', desc: 'Node count and readiness', size: 'sm' as const },
  { type: 'deployment_health', title: 'Deployment Health', icon: 'pi pi-send', color: '#a855f7', desc: 'Healthy vs degraded deployments', size: 'sm' as const },
  { type: 'health_score', title: 'Health Score', icon: 'pi pi-heart', color: '#ef4444', desc: 'Overall cluster health percentage', size: 'sm' as const },
  { type: 'recent_events', title: 'Recent Events', icon: 'pi pi-bolt', color: '#eab308', desc: 'Latest cluster events', size: 'md' as const },
  { type: 'top_pods_cpu', title: 'Top CPU Pods', icon: 'pi pi-chart-bar', color: '#f97316', desc: 'Highest CPU consumers', size: 'md' as const },
  { type: 'top_pods_memory', title: 'Top Memory Pods', icon: 'pi pi-database', color: '#8b5cf6', desc: 'Highest memory consumers', size: 'md' as const },
  { type: 'cost_summary', title: 'Cost Summary', icon: 'pi pi-dollar', color: '#10b981', desc: 'Monthly cost estimate', size: 'sm' as const },
  { type: 'anomalies', title: 'Anomalies', icon: 'pi pi-exclamation-triangle', color: '#ef4444', desc: 'Active anomaly alerts', size: 'md' as const },
  { type: 'namespace_pods', title: 'Namespace Pods', icon: 'pi pi-th-large', color: '#06b6d4', desc: 'Pod distribution by status', size: 'sm' as const },
  { type: 'uptime', title: 'Uptime', icon: 'pi pi-clock', color: '#22c55e', desc: 'Cluster availability status', size: 'sm' as const },
  { type: 'warning_events', title: 'Warning Events', icon: 'pi pi-exclamation-circle', color: '#f59e0b', desc: 'Only warning-type events', size: 'md' as const },
  { type: 'restart_pods', title: 'High Restart Pods', icon: 'pi pi-replay', color: '#ef4444', desc: 'Pods with most restarts', size: 'md' as const },
  { type: 'ingress_count', title: 'Ingress Routes', icon: 'pi pi-link', color: '#ec4899', desc: 'Active ingress count', size: 'sm' as const },
  { type: 'cronjob_count', title: 'CronJobs', icon: 'pi pi-history', color: '#a855f7', desc: 'Scheduled jobs count', size: 'sm' as const },
  { type: 'security_issues', title: 'Security Issues', icon: 'pi pi-shield', color: '#ef4444', desc: 'Misconfiguration findings', size: 'sm' as const },
  { type: 'context_info', title: 'Cluster Context', icon: 'pi pi-globe', color: '#3b82f6', desc: 'Current context and namespace', size: 'sm' as const },
  { type: 'endpoint_health', title: 'Endpoint Health', icon: 'pi pi-sitemap', color: '#14b8a6', desc: 'Service endpoints status', size: 'sm' as const },
];


@Component({
  selector: 'app-custom-dashboard',
  standalone: true,
  imports: [FormsModule, ButtonModule, TagModule, TooltipModule, DialogModule],
  templateUrl: './custom-dashboard.html',
  styleUrl: './custom-dashboard.scss',
})
export class CustomDashboardComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  widgets: Widget[] = [];
  catalog = WIDGET_CATALOG;
  catalogVisible = false;
  dashboardName = 'My Dashboard';
  editingName = false;
  savedDashboards: { name: string; widgets: any[] }[] = [];
  dragIndex = -1;
  dropIndex = -1;
  private refreshTimer: any;

  ngOnInit() {
    this.loadSavedList();
    this.route.queryParams.subscribe(params => {
      if (params['name']) {
        const dash = this.savedDashboards.find(d => d.name === params['name']);
        if (dash) {
          this.loadDashboard(dash);
          return;
        }
      }
      this.loadWidgets();
    });
    this.refreshAll();
    this.refreshTimer = setInterval(() => this.tickRefresh(), 5000);
  }

  ngOnDestroy() { clearInterval(this.refreshTimer); }

  private tickRefresh() {
    const now = Date.now();
    for (const w of this.widgets) {
      const elapsed = now - (w.lastRefresh || 0);
      if (elapsed >= (w.refreshInterval || 30) * 1000) {
        this.fetchWidgetData(w);
      }
    }
  }

  addWidget(item: typeof WIDGET_CATALOG[0]) {
    if (this.hasWidget(item.type)) return;
    const widget: Widget = {
      id: `${item.type}_${Date.now()}`,
      type: item.type,
      title: item.title,
      size: item.size,
      refreshInterval: 30,
      loading: true,
    };
    this.widgets = [...this.widgets, widget];
    this.saveWidgets();
    this.fetchWidgetData(widget);
    this.catalogVisible = false;
  }

  removeWidget(id: string) {
    this.widgets = this.widgets.filter(w => w.id !== id);
    this.saveWidgets();
  }

  hasWidget(type: string): boolean {
    return this.widgets.some(w => w.type === type);
  }

  refreshAll() {
    for (const w of this.widgets) this.fetchWidgetData(w);
  }

  refreshWidget(widget: Widget) {
    widget.loading = true;
    this.fetchWidgetData(widget);
  }

  clearAll() {
    this.widgets = [];
    this.saveWidgets();
  }

  // Drag & Drop
  onDragStart(index: number) { this.dragIndex = index; }
  onDragOver(event: DragEvent, index: number) { event.preventDefault(); this.dropIndex = index; }
  onDragEnd() { this.dragIndex = -1; this.dropIndex = -1; }
  onDrop(index: number) {
    if (this.dragIndex < 0 || this.dragIndex === index) return;
    const moved = this.widgets.splice(this.dragIndex, 1)[0];
    this.widgets.splice(index, 0, moved);
    this.widgets = [...this.widgets];
    this.dragIndex = -1;
    this.dropIndex = -1;
    this.saveWidgets();
  }

  // Multi-dashboard
  saveDashboard() {
    const name = this.dashboardName || 'My Dashboard';
    const saved = this.widgets.map(w => ({ id: w.id, type: w.type, title: w.title, size: w.size, refreshInterval: w.refreshInterval }));
    const list = this.loadSavedListRaw();
    const idx = list.findIndex((d: any) => d.name === name);
    if (idx >= 0) { list[idx].widgets = saved; }
    else { list.push({ name, widgets: saved }); }
    localStorage.setItem('kubsome_dashboards', JSON.stringify(list));
    this.loadSavedList();
  }

  loadDashboard(dash: { name: string; widgets: any[] }) {
    this.dashboardName = dash.name;
    this.widgets = dash.widgets.map((w: any) => ({ ...w, refreshInterval: w.refreshInterval || 30, loading: true }));
    localStorage.setItem('kubsome_custom_dashboard', JSON.stringify(dash.widgets));
    localStorage.setItem('kubsome_dashboard_name', dash.name);
    this.refreshAll();
  }

  newDashboard() {
    this.dashboardName = 'New Dashboard';
    this.widgets = [];
    this.editingName = true;
    localStorage.setItem('kubsome_custom_dashboard', '[]');
    localStorage.setItem('kubsome_dashboard_name', this.dashboardName);
  }

  private loadSavedList() {
    this.savedDashboards = this.loadSavedListRaw();
  }

  private loadSavedListRaw(): any[] {
    try { return JSON.parse(localStorage.getItem('kubsome_dashboards') || '[]'); } catch { return []; }
  }

  shortName(name: string): string {
    return name;
  }

  private fetchWidgetData(widget: Widget) {
    widget.loading = true;
    widget.lastRefresh = Date.now();
    switch (widget.type) {
      case 'pod_count':
      case 'namespace_pods':
        this.http.get<any>('/api/overview').subscribe({
          next: (r) => {
            const total = (r.pods?.healthy || 0) + (r.pods?.warning || 0) + (r.pods?.critical || 0);
            if (widget.type === 'pod_count') {
              widget.data = { healthy: r.pods?.healthy || 0, total };
            } else {
              widget.data = { total, running: r.pods?.healthy || 0, other: (r.pods?.warning || 0) + (r.pods?.critical || 0) };
            }
            widget.loading = false;
          },
          error: () => { widget.data = { healthy: 0, total: 0 }; widget.loading = false; },
        });
        break;
      case 'node_count':
        this.http.get<any>('/api/overview').subscribe({
          next: (r) => { widget.data = { healthy: r.nodes?.healthy || 0, total: (r.nodes?.healthy || 0) + (r.nodes?.warning || 0) }; widget.loading = false; },
          error: () => { widget.data = { healthy: 0, total: 0 }; widget.loading = false; },
        });
        break;
      case 'deployment_health':
        this.http.get<any>('/api/overview').subscribe({
          next: (r) => { widget.data = { healthy: r.deployments?.healthy || 0, total: (r.deployments?.healthy || 0) + (r.deployments?.unavailable || 0), unavailable: r.deployments?.unavailable || 0 }; widget.loading = false; },
          error: () => { widget.data = { healthy: 0, total: 0, unavailable: 0 }; widget.loading = false; },
        });
        break;
      case 'health_score':
        this.http.get<any>('/api/overview').subscribe({
          next: (r) => {
            const total = (r.pods?.healthy || 0) + (r.pods?.warning || 0) + (r.pods?.critical || 0) + (r.nodes?.healthy || 0) + (r.nodes?.warning || 0) + (r.deployments?.healthy || 0) + (r.deployments?.unavailable || 0);
            const healthy = (r.pods?.healthy || 0) + (r.nodes?.healthy || 0) + (r.deployments?.healthy || 0);
            widget.data = { pct: total > 0 ? Math.round((healthy / total) * 100) : 100 };
            widget.loading = false;
          },
          error: () => { widget.data = { pct: 0 }; widget.loading = false; },
        });
        break;
      case 'recent_events':
        this.http.get<any>('/api/events?limit=5').subscribe({
          next: (r) => { widget.data = r.events || []; widget.loading = false; },
          error: () => { widget.data = []; widget.loading = false; },
        });
        break;
      case 'top_pods_cpu':
        this.http.get<any>('/api/top/pods').subscribe({
          next: (r) => { widget.data = (r.pods || []).sort((a: any, b: any) => b.cpu_millicores - a.cpu_millicores).slice(0, 5); widget.loading = false; },
          error: () => { widget.data = []; widget.loading = false; },
        });
        break;
      case 'cost_summary':
        this.http.get<any>('/api/cost-estimate').subscribe({
          next: (r) => { widget.data = { total: (r.total || 0).toFixed(0), count: (r.deployments || []).length }; widget.loading = false; },
          error: () => { widget.data = { total: '0', count: 0 }; widget.loading = false; },
        });
        break;
      case 'anomalies':
        this.http.get<any>('/api/anomalies').subscribe({
          next: (r) => { widget.data = r.alerts || []; widget.loading = false; },
          error: () => { widget.data = []; widget.loading = false; },
        });
        break;
      case 'uptime':
        this.http.get<any>('/api/uptime').subscribe({
          next: (r) => { widget.data = r; widget.loading = false; },
          error: () => { widget.data = { cluster_down: true, day: '' }; widget.loading = false; },
        });
        break;
      case 'top_pods_memory':
        this.http.get<any>('/api/top/pods').subscribe({
          next: (r) => { widget.data = (r.pods || []).sort((a: any, b: any) => b.memory_mb - a.memory_mb).slice(0, 5); widget.loading = false; },
          error: () => { widget.data = []; widget.loading = false; },
        });
        break;
      case 'warning_events':
        this.http.get<any>('/api/events?limit=20').subscribe({
          next: (r) => { widget.data = (r.events || []).filter((e: any) => e.type === 'Warning'); widget.loading = false; },
          error: () => { widget.data = []; widget.loading = false; },
        });
        break;
      case 'restart_pods':
        this.http.get<any>('/api/pods?size=0').subscribe({
          next: (r) => { widget.data = (r.pods || []).filter((p: any) => p.restarts > 0).sort((a: any, b: any) => b.restarts - a.restarts).slice(0, 5); widget.loading = false; },
          error: () => { widget.data = []; widget.loading = false; },
        });
        break;
      case 'ingress_count':
        this.http.get<any>('/api/ingress').subscribe({
          next: (r) => { widget.data = { count: (r.ingresses || []).length }; widget.loading = false; },
          error: () => { widget.data = { count: 0 }; widget.loading = false; },
        });
        break;
      case 'cronjob_count':
        this.http.get<any>('/api/cronjobs').subscribe({
          next: (r) => { widget.data = { count: (r.cronjobs || []).length }; widget.loading = false; },
          error: () => { widget.data = { count: 0 }; widget.loading = false; },
        });
        break;
      case 'security_issues':
        this.http.get<any>('/api/security').subscribe({
          next: (r) => { widget.data = { count: (r.findings || []).length }; widget.loading = false; },
          error: () => { widget.data = { count: 0 }; widget.loading = false; },
        });
        break;
      case 'context_info':
        this.http.get<any>('/api/context-info').subscribe({
          next: (r) => { widget.data = r; widget.loading = false; },
          error: () => { widget.data = { context: '—', namespace: '—' }; widget.loading = false; },
        });
        break;
      case 'endpoint_health':
        this.http.get<any>('/api/endpoints').subscribe({
          next: (r) => {
            const svcs = r.services || [];
            widget.data = { total: svcs.length, healthy: svcs.filter((s: any) => s.healthy).length, unhealthy: svcs.filter((s: any) => !s.healthy).length };
            widget.loading = false;
          },
          error: () => { widget.data = { total: 0, healthy: 0, unhealthy: 0 }; widget.loading = false; },
        });
        break;
      default:
        widget.loading = false;
    }
  }

  saveWidgets() {
    const saved = this.widgets.map(w => ({ id: w.id, type: w.type, title: w.title, size: w.size, refreshInterval: w.refreshInterval }));
    localStorage.setItem('kubsome_custom_dashboard', JSON.stringify(saved));
    localStorage.setItem('kubsome_dashboard_name', this.dashboardName);
  }

  private loadWidgets() {
    try {
      this.dashboardName = localStorage.getItem('kubsome_dashboard_name') || 'My Dashboard';
      const raw = localStorage.getItem('kubsome_custom_dashboard');
      if (raw) this.widgets = JSON.parse(raw).map((w: any) => ({ ...w, loading: true }));
    } catch { }
  }
}
