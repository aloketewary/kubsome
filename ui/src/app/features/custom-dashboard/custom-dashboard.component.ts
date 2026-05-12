import { Component, inject, OnInit, OnDestroy } from '@angular/core';
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
  config?: any;
  data?: any;
  loading?: boolean;
}

const WIDGET_CATALOG = [
  { type: 'pod_count', title: 'Pod Count', icon: 'pi pi-box', color: '#3b82f6', desc: 'Total pods with health breakdown', size: 'sm' as const },
  { type: 'node_count', title: 'Node Status', icon: 'pi pi-server', color: '#22c55e', desc: 'Node count and readiness', size: 'sm' as const },
  { type: 'deployment_health', title: 'Deployment Health', icon: 'pi pi-send', color: '#a855f7', desc: 'Healthy vs degraded deployments', size: 'sm' as const },
  { type: 'health_score', title: 'Health Score', icon: 'pi pi-heart', color: '#ef4444', desc: 'Overall cluster health percentage', size: 'sm' as const },
  { type: 'recent_events', title: 'Recent Events', icon: 'pi pi-bolt', color: '#eab308', desc: 'Latest cluster events', size: 'md' as const },
  { type: 'top_pods_cpu', title: 'Top CPU Pods', icon: 'pi pi-chart-bar', color: '#f97316', desc: 'Highest CPU consumers', size: 'md' as const },
  { type: 'cost_summary', title: 'Cost Summary', icon: 'pi pi-dollar', color: '#10b981', desc: 'Monthly cost estimate', size: 'sm' as const },
  { type: 'anomalies', title: 'Anomalies', icon: 'pi pi-exclamation-triangle', color: '#ef4444', desc: 'Active anomaly alerts', size: 'md' as const },
  { type: 'namespace_pods', title: 'Namespace Pods', icon: 'pi pi-th-large', color: '#06b6d4', desc: 'Pod distribution by status', size: 'sm' as const },
  { type: 'uptime', title: 'Uptime', icon: 'pi pi-clock', color: '#22c55e', desc: 'Cluster availability status', size: 'sm' as const },
];

@Component({
  selector: 'app-custom-dashboard',
  standalone: true,
  imports: [FormsModule, ButtonModule, TagModule, TooltipModule, DialogModule],
  template: `
    <div class="page-header">
      <div>
        <div class="title-row">
          @if (editingName) {
            <input class="dash-name-input" [(ngModel)]="dashboardName" (keyup.enter)="editingName = false; saveDashboard()" (blur)="editingName = false; saveDashboard()" autofocus />
          } @else {
            <h1 (click)="editingName = true">{{ dashboardName || 'My Dashboard' }}</h1>
            <i class="pi pi-pencil edit-name-icon" (click)="editingName = true" pTooltip="Rename"></i>
          }
        </div>
        <p class="subtitle">{{ widgets.length }} widgets</p>
      </div>
      <div class="header-actions">
        <button pButton icon="pi pi-plus" label="Add Widget" class="p-button-sm" (click)="catalogVisible = true"></button>
        <button pButton icon="pi pi-save" label="Save" class="p-button-sm p-button-outlined" (click)="saveDashboard()" pTooltip="Save dashboard"></button>
        <button pButton icon="pi pi-refresh" class="p-button-sm p-button-outlined p-button-rounded" (click)="refreshAll()" pTooltip="Refresh all"></button>
        @if (widgets.length > 0) {
          <button pButton icon="pi pi-trash" class="p-button-sm p-button-text p-button-danger" (click)="clearAll()" pTooltip="Clear all widgets"></button>
        }
      </div>
    </div>

    <!-- Saved Dashboards -->
    @if (savedDashboards.length > 0) {
      <div class="saved-bar">
        @for (dash of savedDashboards; track dash.name) {
          <button class="saved-chip" [class.active]="dash.name === dashboardName" (click)="loadDashboard(dash)">
            <i class="pi pi-th-large"></i> {{ dash.name }}
            <span class="chip-count">{{ dash.widgets.length }}</span>
          </button>
        }
        <button class="saved-chip new-chip" (click)="newDashboard()">
          <i class="pi pi-plus"></i> New
        </button>
      </div>
    }

    <!-- Empty State -->
    @if (widgets.length === 0) {
      <div class="empty-state">
        <div class="empty-icon"><i class="pi pi-th-large"></i></div>
        <h2>Build Your Dashboard</h2>
        <p>Add widgets to create a personalized cluster overview.</p>
        <button pButton icon="pi pi-plus" label="Add First Widget" class="p-button-sm" (click)="catalogVisible = true"></button>
      </div>
    }

    <!-- Widget Grid -->
    <div class="widget-grid">
      @for (widget of widgets; track widget.id; let i = $index) {
        <div class="widget-card" [class]="'widget-' + widget.size" [class.dragging]="dragIndex === i" [class.drag-over]="dropIndex === i"
             draggable="true" (dragstart)="onDragStart(i)" (dragover)="onDragOver($event, i)" (dragend)="onDragEnd()" (drop)="onDrop(i)">
          <div class="widget-header">
            <i class="pi pi-bars drag-handle"></i>
            <span class="widget-title">{{ widget.title }}</span>
            <div class="widget-actions">
              <i class="pi pi-refresh" pTooltip="Refresh" (click)="refreshWidget(widget)"></i>
              <i class="pi pi-times" pTooltip="Remove" (click)="removeWidget(widget.id)"></i>
            </div>
          </div>
          <div class="widget-body">
            @if (widget.loading) {
              <div class="widget-loading"><div class="spin"></div></div>
            } @else {
              @switch (widget.type) {
                @case ('pod_count') { @if (widget.data) {
                  <div class="metric-widget">
                    <span class="metric-value">{{ widget.data.healthy }}</span>
                    <span class="metric-total">/ {{ widget.data.total }}</span>
                    <span class="metric-label">healthy pods</span>
                    <div class="metric-bar"><div class="mbar-fill" [style.width.%]="widget.data.total ? (widget.data.healthy / widget.data.total * 100) : 0"></div></div>
                  </div>
                }}
                @case ('node_count') { @if (widget.data) {
                  <div class="metric-widget">
                    <span class="metric-value">{{ widget.data.healthy }}</span>
                    <span class="metric-total">/ {{ widget.data.total }}</span>
                    <span class="metric-label">nodes ready</span>
                    <div class="metric-bar bar-green"><div class="mbar-fill" [style.width.%]="widget.data.total ? (widget.data.healthy / widget.data.total * 100) : 0"></div></div>
                  </div>
                }}
                @case ('deployment_health') { @if (widget.data) {
                  <div class="metric-widget">
                    <span class="metric-value">{{ widget.data.healthy }}</span>
                    <span class="metric-total">/ {{ widget.data.total }}</span>
                    <span class="metric-label">deployments available</span>
                    @if (widget.data.unavailable > 0) {
                      <span class="metric-alert">{{ widget.data.unavailable }} degraded</span>
                    }
                  </div>
                }}
                @case ('health_score') { @if (widget.data) {
                  <div class="score-widget">
                    <div class="score-ring">
                      <svg viewBox="0 0 36 36">
                        <path class="ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <path class="ring-fill" [attr.stroke-dasharray]="widget.data.pct + ', 100'" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      </svg>
                      <span class="score-val">{{ widget.data.pct }}%</span>
                    </div>
                  </div>
                }}
                @case ('recent_events') { @if (widget.data) {
                  <div class="events-widget">
                    @for (ev of widget.data.slice(0, 5); track $index) {
                      <div class="ev-row">
                        <span class="ev-dot" [class.ev-warn]="ev.type === 'Warning'"></span>
                        <span class="ev-reason">{{ ev.reason }}</span>
                        <span class="ev-obj">{{ ev.object }}</span>
                      </div>
                    }
                    @if (widget.data.length === 0) { <span class="widget-empty">No events</span> }
                  </div>
                }}
                @case ('top_pods_cpu') { @if (widget.data) {
                  <div class="top-widget">
                    @for (pod of widget.data.slice(0, 5); track pod.name) {
                      <div class="top-row">
                        <span class="top-name">{{ shortName(pod.name) }}</span>
                        <span class="top-val">{{ pod.cpu }}</span>
                      </div>
                    }
                    @if (widget.data.length === 0) { <span class="widget-empty">No metrics</span> }
                  </div>
                }}
                @case ('cost_summary') { @if (widget.data) {
                  <div class="metric-widget">
                    <span class="metric-value cost-val">\${{ widget.data.total }}</span>
                    <span class="metric-label">estimated / month</span>
                    <span class="metric-sub">{{ widget.data.count }} deployments</span>
                  </div>
                }}
                @case ('anomalies') { @if (widget.data) {
                  <div class="events-widget">
                    @for (a of widget.data.slice(0, 5); track $index) {
                      <div class="ev-row">
                        <span class="ev-dot ev-warn"></span>
                        <span class="ev-reason">{{ a.message || a.title }}</span>
                      </div>
                    }
                    @if (widget.data.length === 0) { <span class="widget-empty">No anomalies ✓</span> }
                  </div>
                }}
                @case ('namespace_pods') { @if (widget.data) {
                  <div class="metric-widget">
                    <span class="metric-value">{{ widget.data.total }}</span>
                    <span class="metric-label">pods in namespace</span>
                    <div class="ns-pills">
                      <span class="ns-pill ns-ok">{{ widget.data.running }} running</span>
                      @if (widget.data.other > 0) { <span class="ns-pill ns-bad">{{ widget.data.other }} other</span> }
                    </div>
                  </div>
                }}
                @case ('uptime') { @if (widget.data) {
                  <div class="metric-widget">
                    <span class="metric-value" [class.val-ok]="!widget.data.cluster_down" [class.val-bad]="widget.data.cluster_down">
                      {{ widget.data.cluster_down ? 'DOWN' : 'UP' }}
                    </span>
                    <span class="metric-label">{{ widget.data.day || '' }}</span>
                  </div>
                }}
                @default {
                  <span class="widget-empty">Unknown widget</span>
                }
              }
            }
          </div>
        </div>
      }
    </div>

    <!-- Widget Catalog Dialog -->
    <p-dialog [(visible)]="catalogVisible" header="Add Widget" [modal]="true" [style]="{ width: '520px' }" [appendTo]="'body'">
      <div class="catalog-grid">
        @for (item of catalog; track item.type) {
          <div class="catalog-card" (click)="addWidget(item)" [class.catalog-added]="hasWidget(item.type)">
            <div class="cat-icon" [style.background]="item.color + '15'" [style.color]="item.color">
              <i [class]="item.icon"></i>
            </div>
            <div class="cat-info">
              <span class="cat-name">{{ item.title }}</span>
              <span class="cat-desc">{{ item.desc }}</span>
            </div>
            @if (hasWidget(item.type)) {
              <i class="pi pi-check cat-check"></i>
            }
          </div>
        }
      </div>
    </p-dialog>
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; cursor: pointer; }
    .page-header h1:hover { color: var(--accent); }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .header-actions { display: flex; gap: 8px; }
    .title-row { display: flex; align-items: center; gap: 8px; }
    .edit-name-icon { font-size: 12px; color: var(--text-muted); cursor: pointer; opacity: 0.5; }
    .edit-name-icon:hover { opacity: 1; color: var(--accent); }
    .dash-name-input {
      font-size: 24px; font-weight: 700; letter-spacing: -0.03em;
      background: transparent; border: none; border-bottom: 2px solid var(--accent);
      color: var(--text); outline: none; width: 250px;
    }

    /* Saved Dashboards */
    .saved-bar {
      display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap;
    }
    .saved-chip {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 12px; border-radius: 8px; border: 1px solid var(--border);
      background: var(--bg-card); color: var(--text-secondary); font-size: 12px;
      cursor: pointer; transition: all 0.15s;
    }
    .saved-chip:hover { border-color: var(--accent); color: var(--accent); }
    .saved-chip.active { border-color: var(--accent); background: var(--accent-subtle); color: var(--accent); font-weight: 600; }
    .saved-chip i { font-size: 11px; }
    .chip-count { font-size: 10px; background: var(--bg-elevated); padding: 1px 5px; border-radius: 8px; }
    .new-chip { border-style: dashed; color: var(--text-muted); }
    .new-chip:hover { border-color: var(--success); color: var(--success); }

    /* Empty */
    .empty-state {
      display: flex; flex-direction: column; align-items: center; gap: 12px;
      padding: 60px; text-align: center;
    }
    .empty-icon { font-size: 36px; color: var(--text-muted); opacity: 0.3; }
    .empty-state h2 { font-size: 18px; font-weight: 700; margin: 0; }
    .empty-state p { font-size: 13px; color: var(--text-muted); margin: 0; }

    /* Grid */
    .widget-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 12px;
    }
    .widget-sm { grid-column: span 1; }
    .widget-md { grid-column: span 2; }
    .widget-lg { grid-column: span 3; }
    @media (max-width: 768px) { .widget-md, .widget-lg { grid-column: span 1; } }

    .widget-card {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
      overflow: hidden; transition: all 0.2s; cursor: grab;
    }
    .widget-card:hover { border-color: var(--border-hover); box-shadow: 0 4px 16px rgba(0,0,0,0.15); }
    .widget-card:hover .widget-actions { opacity: 1; }
    .widget-card.dragging { opacity: 0.4; transform: scale(0.95); }
    .widget-card.drag-over { border-color: var(--accent); border-style: dashed; }

    .widget-header {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 14px; border-bottom: 1px solid var(--border);
    }
    .drag-handle { font-size: 10px; color: var(--text-muted); cursor: grab; opacity: 0.4; }
    .widget-card:hover .drag-handle { opacity: 1; }
    .widget-title { font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .widget-actions { display: flex; gap: 4px; opacity: 0.3; transition: opacity 0.15s; }
    .widget-actions i { font-size: 11px; color: var(--text-muted); cursor: pointer; padding: 4px; border-radius: 4px; }
    .widget-actions i:hover { color: var(--text); background: var(--bg-elevated); }

    .widget-body { padding: 16px; min-height: 80px; display: flex; align-items: center; justify-content: center; }
    .widget-loading { display: flex; align-items: center; justify-content: center; }
    .spin { width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .widget-empty { font-size: 12px; color: var(--text-muted); }

    /* Metric Widget */
    .metric-widget { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 100%; }
    .metric-value { font-size: 32px; font-weight: 800; letter-spacing: -0.04em; }
    .metric-total { font-size: 14px; color: var(--text-muted); margin-top: -8px; }
    .metric-label { font-size: 11px; color: var(--text-muted); }
    .metric-sub { font-size: 10px; color: var(--text-muted); }
    .metric-alert { font-size: 11px; color: var(--danger); font-weight: 600; margin-top: 4px; }
    .metric-bar { width: 100%; height: 4px; border-radius: 2px; background: var(--bg-elevated); margin-top: 8px; overflow: hidden; }
    .mbar-fill { height: 100%; border-radius: 2px; background: var(--accent); transition: width 0.5s; }
    .bar-green .mbar-fill { background: var(--success); }
    .cost-val { color: var(--success); }
    .val-ok { color: var(--success); }
    .val-bad { color: var(--danger); }
    .ns-pills { display: flex; gap: 6px; margin-top: 6px; }
    .ns-pill { font-size: 10px; padding: 2px 8px; border-radius: 10px; }
    .ns-ok { background: var(--success-subtle); color: var(--success); }
    .ns-bad { background: var(--danger-subtle); color: var(--danger); }

    /* Score Widget */
    .score-widget { display: flex; align-items: center; justify-content: center; }
    .score-ring { position: relative; width: 64px; height: 64px; }
    .score-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    .ring-bg { fill: none; stroke: var(--bg-elevated); stroke-width: 3; }
    .ring-fill { fill: none; stroke: var(--success); stroke-width: 3; stroke-linecap: round; }
    .score-val { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 800; }

    /* Events Widget */
    .events-widget { width: 100%; display: flex; flex-direction: column; gap: 6px; }
    .ev-row { display: flex; align-items: center; gap: 8px; font-size: 11px; }
    .ev-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); flex-shrink: 0; }
    .ev-dot.ev-warn { background: var(--warning); }
    .ev-reason { font-weight: 500; }
    .ev-obj { color: var(--text-muted); font-family: 'JetBrains Mono', monospace; font-size: 10px; margin-left: auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 120px; }

    /* Top Widget */
    .top-widget { width: 100%; display: flex; flex-direction: column; gap: 4px; }
    .top-row { display: flex; align-items: center; justify-content: space-between; font-size: 11px; padding: 2px 0; }
    .top-name { font-family: 'JetBrains Mono', monospace; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px; }
    .top-val { font-weight: 600; color: var(--accent); }

    /* Catalog */
    .catalog-grid { display: flex; flex-direction: column; gap: 6px; }
    .catalog-card {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 14px; border-radius: 8px; border: 1px solid var(--border);
      cursor: pointer; transition: all 0.15s;
    }
    .catalog-card:hover { border-color: var(--accent); background: var(--accent-subtle); }
    .catalog-added { opacity: 0.5; }
    .cat-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
    .cat-info { flex: 1; display: flex; flex-direction: column; }
    .cat-name { font-size: 13px; font-weight: 600; }
    .cat-desc { font-size: 11px; color: var(--text-muted); }
    .cat-check { color: var(--success); font-size: 14px; }
  `],
})
export class CustomDashboardComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
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
    this.loadWidgets();
    this.refreshAll();
    this.refreshTimer = setInterval(() => this.refreshAll(), 30000);
  }

  ngOnDestroy() { clearInterval(this.refreshTimer); }

  addWidget(item: typeof WIDGET_CATALOG[0]) {
    if (this.hasWidget(item.type)) return;
    const widget: Widget = {
      id: `${item.type}_${Date.now()}`,
      type: item.type,
      title: item.title,
      size: item.size,
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
    const saved = this.widgets.map(w => ({ id: w.id, type: w.type, title: w.title, size: w.size }));
    const list = this.loadSavedListRaw();
    const idx = list.findIndex((d: any) => d.name === name);
    if (idx >= 0) { list[idx].widgets = saved; }
    else { list.push({ name, widgets: saved }); }
    localStorage.setItem('kubsome_dashboards', JSON.stringify(list));
    this.loadSavedList();
  }

  loadDashboard(dash: { name: string; widgets: any[] }) {
    this.dashboardName = dash.name;
    this.widgets = dash.widgets.map((w: any) => ({ ...w, loading: true }));
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
    return name.length > 28 ? '...' + name.slice(-25) : name;
  }

  private fetchWidgetData(widget: Widget) {
    widget.loading = true;
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
      default:
        widget.loading = false;
    }
  }

  private saveWidgets() {
    const saved = this.widgets.map(w => ({ id: w.id, type: w.type, title: w.title, size: w.size }));
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
