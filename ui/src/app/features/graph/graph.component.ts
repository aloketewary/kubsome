import { Component, ElementRef, inject, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { Select } from 'primeng/select';
import cytoscape from 'cytoscape';
import { SpotlightComponent } from '../../shared/components/spotlight.component';

@Component({
  selector: 'app-graph',
  standalone: true,
  imports: [FormsModule, ButtonModule, TagModule, TooltipModule, Select, SpotlightComponent],
  template: `
    <app-spotlight id="graph" title="Service Map" icon="pi pi-sitemap"
      description="Visualize relationships between pods, services, and deployments with health-aware topology."
      [capabilities]="['Interactive graph', 'Health-aware coloring', 'Click to inspect', 'Multiple layouts']" [compact]="true" />

    <div class="page-header">
      <div>
        <h1>Service Map</h1>
        <p class="subtitle">Interactive resource topology · {{ nodeCount }} nodes · {{ edgeCount }} edges</p>
      </div>
      <div class="controls">
        <p-select [options]="deployments" [(ngModel)]="selectedDep" placeholder="Select deployment..." [style]="{ width: '220px' }" [filter]="true" />
        <button pButton label="Trace" icon="pi pi-sitemap" class="p-button-sm" (click)="trace()" [disabled]="!selectedDep" [loading]="loading"></button>
        <div class="layout-toggle">
          @for (l of layouts; track l.id) {
            <button class="layout-btn" [class.active]="currentLayout === l.id" (click)="changeLayout(l.id)" [pTooltip]="l.label">
              <i [class]="l.icon"></i>
            </button>
          }
        </div>
        <button pButton icon="pi pi-expand" class="p-button-outlined p-button-sm p-button-rounded" (click)="fit()" pTooltip="Fit to Screen"></button>
      </div>
    </div>

    <div class="graph-container">
      <!-- Graph Viewport -->
      <div class="graph-viewport">
        <div #cyContainer class="cy-container"></div>

        @if (!traceData && !loading) {
          <div class="viewport-overlay">
            <div class="start-state">
              <div class="start-icon"><i class="pi pi-sitemap"></i></div>
              <h3>Trace Resource Topology</h3>
              <p>Select a deployment to visualize its full resource chain: Ingress → Service → Deployment → ReplicaSet → Pods</p>
              <div class="quick-actions">
                @for (dep of deployments.slice(0, 4); track dep) {
                  <button class="quick-btn" (click)="selectedDep = dep; trace()">{{ shortName(dep) }}</button>
                }
              </div>
            </div>
          </div>
        }

        @if (loading) {
          <div class="viewport-overlay">
            <div class="loading-state">
              <div class="spin"></div>
              <span>Tracing {{ selectedDep }}...</span>
            </div>
          </div>
        }

        <!-- Legend -->
        @if (traceData) {
          <div class="legend">
            <div class="legend-item"><span class="legend-dot dot-ingress"></span> Ingress</div>
            <div class="legend-item"><span class="legend-dot dot-service"></span> Service</div>
            <div class="legend-item"><span class="legend-dot dot-deployment"></span> Deployment</div>
            <div class="legend-item"><span class="legend-dot dot-replicaset"></span> ReplicaSet</div>
            <div class="legend-item"><span class="legend-dot dot-pod"></span> Pod</div>
            <div class="legend-item"><span class="legend-dot dot-unhealthy"></span> Unhealthy</div>
          </div>
        }

        <!-- Stats Overlay -->
        @if (traceData) {
          <div class="stats-overlay">
            <div class="stat-chip"><i class="pi pi-box"></i> {{ nodeCount }}</div>
            <div class="stat-chip"><i class="pi pi-arrows-h"></i> {{ edgeCount }}</div>
            @if (unhealthyCount > 0) {
              <div class="stat-chip stat-danger"><i class="pi pi-exclamation-triangle"></i> {{ unhealthyCount }}</div>
            }
          </div>
        }
      </div>

      <!-- Detail Panel -->
      @if (selectedNode) {
        <div class="detail-panel" [@panelAnim]>
          <div class="dp-header">
            <div class="dp-icon" [class]="'dp-' + selectedNode.kind.toLowerCase()">
              <i [class]="kindIcon(selectedNode.kind)"></i>
            </div>
            <div class="dp-info">
              <span class="dp-kind">{{ selectedNode.kind }}</span>
              <span class="dp-name">{{ selectedNode.label }}</span>
            </div>
            <button class="dp-close" (click)="selectedNode = null"><i class="pi pi-times"></i></button>
          </div>

          <div class="dp-body">
            @if (selectedNode.status) {
              <div class="dp-row">
                <span class="dp-label">Status</span>
                <span class="dp-value" [class.val-healthy]="selectedNode.status === 'Running'" [class.val-unhealthy]="selectedNode.status !== 'Running'">
                  {{ selectedNode.status }}
                </span>
              </div>
            }
            @if (selectedNode.restarts !== undefined) {
              <div class="dp-row">
                <span class="dp-label">Restarts</span>
                <span class="dp-value" [class.val-unhealthy]="selectedNode.restarts >= 5">{{ selectedNode.restarts }}</span>
              </div>
            }
            @if (selectedNode.replicas !== undefined) {
              <div class="dp-row">
                <span class="dp-label">Replicas</span>
                <span class="dp-value">{{ selectedNode.replicas }}</span>
              </div>
            }
            @if (selectedNode.image) {
              <div class="dp-row">
                <span class="dp-label">Image</span>
                <code class="dp-value dp-code">{{ selectedNode.image }}</code>
              </div>
            }
            @if (selectedNode.node) {
              <div class="dp-row">
                <span class="dp-label">Node</span>
                <span class="dp-value">{{ selectedNode.node }}</span>
              </div>
            }
          </div>

          <div class="dp-actions">
            @if (selectedNode.kind === 'Pod') {
              <button pButton icon="pi pi-search" label="Inspect" class="p-button-sm p-button-outlined" (click)="navigateTo('/pods')"></button>
              <button pButton icon="pi pi-align-left" label="Logs" class="p-button-sm p-button-outlined" (click)="navigateTo('/logs')"></button>
            }
            @if (selectedNode.kind === 'Deployment') {
              <button pButton icon="pi pi-send" label="Rollout" class="p-button-sm p-button-outlined" (click)="navigateTo('/deployments')"></button>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .controls { display: flex; gap: 8px; align-items: center; }

    .layout-toggle {
      display: flex; gap: 2px; background: var(--bg-elevated); border-radius: 8px; padding: 3px;
      border: 1px solid var(--border);
    }
    .layout-btn {
      width: 28px; height: 28px; border-radius: 5px; border: none;
      background: transparent; color: var(--text-muted); cursor: pointer;
      display: flex; align-items: center; justify-content: center; font-size: 12px;
      transition: all 0.15s;
    }
    .layout-btn:hover { color: var(--text); background: var(--bg-hover); }
    .layout-btn.active { background: var(--accent); color: #fff; }

    /* Container */
    .graph-container { display: flex; gap: 0; height: calc(100vh - 200px); }

    .graph-viewport {
      flex: 1; position: relative;
      background: radial-gradient(ellipse at center, #0a0a0f 0%, #000 100%);
      border: 1px solid var(--border); border-radius: var(--radius);
      overflow: hidden;
    }
    .cy-container { width: 100%; height: 100%; }

    /* Overlays */
    .viewport-overlay {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
    }
    .start-state { text-align: center; padding: 32px; }
    .start-icon {
      width: 64px; height: 64px; border-radius: 16px; margin: 0 auto 20px;
      background: linear-gradient(135deg, var(--accent-subtle), rgba(139,92,246,0.15));
      display: flex; align-items: center; justify-content: center; font-size: 28px; color: var(--accent);
      box-shadow: 0 0 40px rgba(59,130,246,0.2);
    }
    .start-state h3 { font-size: 20px; font-weight: 700; margin: 0 0 8px; color: var(--text); }
    .start-state p { font-size: 13px; color: var(--text-secondary); margin: 0 0 20px; max-width: 400px; line-height: 1.5; }
    .quick-actions { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }
    .quick-btn {
      padding: 6px 14px; border-radius: 8px; border: 1px solid var(--border);
      background: var(--bg-elevated); color: var(--text-secondary); font-size: 11px;
      font-family: 'JetBrains Mono', monospace; cursor: pointer; transition: all 0.2s;
    }
    .quick-btn:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-subtle); }

    .loading-state { display: flex; align-items: center; gap: 10px; color: var(--text-muted); font-size: 13px; }
    .spin { width: 18px; height: 18px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Legend */
    .legend {
      position: absolute; top: 16px; left: 16px;
      display: flex; flex-direction: column; gap: 6px;
      padding: 12px 16px; background: rgba(15,15,17,0.85); backdrop-filter: blur(8px);
      border: 1px solid var(--border); border-radius: 10px;
    }
    .legend-item { display: flex; align-items: center; gap: 8px; font-size: 10px; color: var(--text-muted); }
    .legend-dot { width: 10px; height: 10px; border-radius: 50%; border: 2px solid; }
    .dot-ingress { border-color: #f59e0b; background: rgba(245,158,11,0.2); }
    .dot-service { border-color: #10b981; background: rgba(16,185,129,0.2); }
    .dot-deployment { border-color: #3b82f6; background: rgba(59,130,246,0.3); }
    .dot-replicaset { border-color: #6366f1; background: rgba(99,102,241,0.2); }
    .dot-pod { border-color: #8b5cf6; background: rgba(139,92,246,0.2); }
    .dot-unhealthy { border-color: #ef4444; background: rgba(239,68,68,0.3); }

    /* Stats */
    .stats-overlay {
      position: absolute; bottom: 16px; left: 16px;
      display: flex; gap: 8px;
    }
    .stat-chip {
      display: flex; align-items: center; gap: 5px;
      padding: 6px 12px; background: rgba(15,15,17,0.85); backdrop-filter: blur(8px);
      border: 1px solid var(--border); border-radius: 8px;
      font-size: 11px; font-weight: 600; color: var(--text-secondary);
    }
    .stat-chip i { font-size: 11px; color: var(--text-muted); }
    .stat-danger { color: var(--danger); border-color: var(--danger); }
    .stat-danger i { color: var(--danger); }

    /* Detail Panel */
    .detail-panel {
      width: 280px; flex-shrink: 0;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
      margin-left: 12px; padding: 0; overflow: hidden;
      animation: slideIn 0.25s cubic-bezier(0.34,1.56,0.64,1);
    }
    @keyframes slideIn { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: translateX(0); } }

    .dp-header {
      display: flex; align-items: center; gap: 10px;
      padding: 16px 16px 12px; border-bottom: 1px solid var(--border);
    }
    .dp-icon {
      width: 36px; height: 36px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center; font-size: 16px;
    }
    .dp-deployment { background: rgba(59,130,246,0.15); color: #3b82f6; }
    .dp-service { background: rgba(16,185,129,0.15); color: #10b981; }
    .dp-pod { background: rgba(139,92,246,0.15); color: #8b5cf6; }
    .dp-replicaset { background: rgba(99,102,241,0.15); color: #6366f1; }
    .dp-ingress { background: rgba(245,158,11,0.15); color: #f59e0b; }
    .dp-info { flex: 1; display: flex; flex-direction: column; }
    .dp-kind { font-size: 9px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .dp-name { font-size: 12px; font-weight: 600; font-family: 'JetBrains Mono', monospace; overflow: hidden; text-overflow: ellipsis; }
    .dp-close {
      width: 24px; height: 24px; border-radius: 6px; border: none;
      background: transparent; color: var(--text-muted); cursor: pointer;
      display: flex; align-items: center; justify-content: center; font-size: 12px;
    }
    .dp-close:hover { background: var(--bg-hover); color: var(--text); }

    .dp-body { padding: 12px 16px; }
    .dp-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--border); }
    .dp-row:last-child { border-bottom: none; }
    .dp-label { font-size: 11px; color: var(--text-muted); }
    .dp-value { font-size: 12px; font-weight: 500; }
    .dp-code { font-family: 'JetBrains Mono', monospace; font-size: 10px; max-width: 150px; overflow: hidden; text-overflow: ellipsis; }
    .val-healthy { color: var(--success); }
    .val-unhealthy { color: var(--danger); }

    .dp-actions { padding: 12px 16px; border-top: 1px solid var(--border); display: flex; gap: 6px; }
  `]
})
export class GraphComponent implements OnInit, OnDestroy {
  @ViewChild('cyContainer', { static: true }) cyContainer!: ElementRef;
  private http = inject(HttpClient);
  private cy: cytoscape.Core | null = null;

  deployments: string[] = [];
  selectedDep = '';
  traceData: any = null;
  loading = false;
  nodeCount = 0;
  edgeCount = 0;
  unhealthyCount = 0;
  selectedNode: any = null;
  currentLayout = 'breadthfirst';

  layouts = [
    { id: 'breadthfirst', label: 'Tree', icon: 'pi pi-sitemap' },
    { id: 'cose', label: 'Force', icon: 'pi pi-circle' },
    { id: 'grid', label: 'Grid', icon: 'pi pi-th-large' },
  ];

  ngOnInit() {
    this.http.get<any>('/api/deployments').subscribe(res => {
      this.deployments = (res.deployments || []).map((d: any) => d.name);
    });
  }

  ngOnDestroy() { this.cy?.destroy(); }

  trace() {
    if (!this.selectedDep) return;
    this.loading = true;
    this.selectedNode = null;
    this.http.get<any>(`/api/trace/${this.selectedDep}`).subscribe({
      next: res => {
        this.traceData = res.trace || res;
        this.loading = false;
        this.renderGraph(this.traceData);
      },
      error: () => { this.loading = false; },
    });
  }

  fit() { this.cy?.fit(undefined, 50); }

  changeLayout(layout: string) {
    this.currentLayout = layout;
    if (this.cy) {
      this.cy.layout(this.getLayoutOptions(layout)).run();
    }
  }

  navigateTo(path: string) {
    window.location.hash = path;
  }

  shortName(name: string): string {
    return name.length > 18 ? name.slice(0, 17) + '…' : name;
  }

  kindIcon(kind: string): string {
    const map: Record<string, string> = {
      Ingress: 'pi pi-globe',
      Service: 'pi pi-server',
      Deployment: 'pi pi-send',
      ReplicaSet: 'pi pi-copy',
      Pod: 'pi pi-box',
    };
    return map[kind] || 'pi pi-circle';
  }

  private getLayoutOptions(name: string): cytoscape.LayoutOptions {
    const layouts: Record<string, any> = {
      breadthfirst: { name: 'breadthfirst', directed: true, padding: 60, spacingFactor: 1.4 },
      cose: { name: 'cose', padding: 50, nodeRepulsion: () => 8000, idealEdgeLength: () => 80, animate: true, animationDuration: 500 },
      grid: { name: 'grid', padding: 40, rows: 3 },
    };
    return layouts[name] || layouts['breadthfirst'];
  }

  private renderGraph(data: any) {
    if (this.cy) { this.cy.destroy(); this.cy = null; }

    const elements: cytoscape.ElementDefinition[] = [];
    const nodeMetadata: Record<string, any> = {};

    // Build nodes
    if (data.ingress) {
      const name = data.ingress.name || data.ingress;
      elements.push({ data: { id: 'ingress', label: name, kind: 'Ingress' } });
      nodeMetadata['ingress'] = { kind: 'Ingress', label: name };
    }
    if (data.service) {
      const name = data.service.name || data.service;
      elements.push({ data: { id: 'service', label: name, kind: 'Service' } });
      nodeMetadata['service'] = { kind: 'Service', label: name };
    }
    if (data.deployment) {
      const name = data.deployment.name || data.deployment;
      const replicas = data.deployment.replicas;
      elements.push({ data: { id: 'deployment', label: name, kind: 'Deployment' } });
      nodeMetadata['deployment'] = { kind: 'Deployment', label: name, replicas };
    }
    if (data.replicasets) {
      data.replicasets.forEach((rs: any) => {
        const id = rs.uid || rs.name;
        elements.push({ data: { id, label: rs.name, kind: 'ReplicaSet' } });
        nodeMetadata[id] = { kind: 'ReplicaSet', label: rs.name, replicas: rs.replicas };
      });
    }

    this.unhealthyCount = 0;
    if (data.pods) {
      data.pods.forEach((p: any) => {
        const healthy = p.status === 'Running' && (p.restarts || 0) < 5;
        if (!healthy) this.unhealthyCount++;
        elements.push({ data: { id: p.name, label: p.name, kind: 'Pod', healthy: healthy ? 'yes' : 'no' } });
        nodeMetadata[p.name] = {
          kind: 'Pod', label: p.name, status: p.status,
          restarts: p.restarts, node: p.node, image: p.image,
        };
      });
    }

    // Build edges
    if (data.ingress && data.service) elements.push({ data: { source: 'ingress', target: 'service' } });
    if (data.service && data.deployment) elements.push({ data: { source: 'service', target: 'deployment' } });
    if (data.deployment && data.replicasets) {
      data.replicasets.forEach((rs: any) => {
        elements.push({ data: { source: 'deployment', target: rs.uid || rs.name } });
      });
    }
    if (data.pods) {
      data.pods.forEach((p: any) => {
        const target = p.name;
        if (p.owner_uid) {
          elements.push({ data: { source: p.owner_uid, target } });
        } else if (data.replicasets?.length) {
          elements.push({ data: { source: data.replicasets[0].uid || data.replicasets[0].name, target } });
        }
      });
    }

    this.nodeCount = elements.filter(e => !e.data.source).length;
    this.edgeCount = elements.filter(e => !!e.data.source).length;

    this.cy = cytoscape({
      container: this.cyContainer.nativeElement,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'color': '#a1a1aa',
            'font-size': '9px',
            'font-family': "'JetBrains Mono', monospace",
            'text-valign': 'bottom',
            'text-margin-y': 8,
            'text-max-width': '80px',
            'text-wrap': 'ellipsis',
            'background-color': '#1a1a22',
            'border-width': 2,
            'border-color': '#32323a',
            'width': 32,
            'height': 32,
            'transition-property': 'border-color, background-color, width, height',
            'transition-duration': 200,
          } as any
        },
        {
          selector: 'node[kind="Ingress"]',
          style: { 'border-color': '#f59e0b', 'background-color': 'rgba(245,158,11,0.15)', 'width': 36, 'height': 36, 'shape': 'diamond' } as any
        },
        {
          selector: 'node[kind="Service"]',
          style: { 'border-color': '#10b981', 'background-color': 'rgba(16,185,129,0.15)', 'width': 36, 'height': 36, 'shape': 'round-hexagon' } as any
        },
        {
          selector: 'node[kind="Deployment"]',
          style: { 'border-color': '#3b82f6', 'background-color': 'rgba(59,130,246,0.2)', 'width': 44, 'height': 44, 'border-width': 3 } as any
        },
        {
          selector: 'node[kind="ReplicaSet"]',
          style: { 'border-color': '#6366f1', 'background-color': 'rgba(99,102,241,0.15)', 'width': 30, 'height': 30 } as any
        },
        {
          selector: 'node[kind="Pod"]',
          style: { 'border-color': '#8b5cf6', 'background-color': 'rgba(139,92,246,0.15)', 'width': 28, 'height': 28 } as any
        },
        {
          selector: 'node[healthy="no"]',
          style: {
            'border-color': '#ef4444',
            'background-color': 'rgba(239,68,68,0.2)',
            'border-width': 3,
            'border-style': 'dashed',
          } as any
        },
        {
          selector: 'node:active, node:selected',
          style: {
            'border-color': '#fff',
            'border-width': 3,
            'overlay-opacity': 0,
          } as any
        },
        {
          selector: 'edge',
          style: {
            'width': 1.5,
            'line-color': '#2a2a35',
            'target-arrow-color': '#4a4a55',
            'target-arrow-shape': 'triangle',
            'arrow-scale': 0.8,
            'curve-style': 'bezier',
            'line-style': 'solid',
            'opacity': 0.7,
          } as any
        },
        {
          selector: 'edge:active',
          style: { 'line-color': '#3b82f6', 'target-arrow-color': '#3b82f6', 'opacity': 1, 'width': 2 } as any
        },
      ],
      layout: this.getLayoutOptions(this.currentLayout),
      minZoom: 0.3,
      maxZoom: 3,
      wheelSensitivity: 0.3,
    });

    // Click handler for node detail
    this.cy.on('tap', 'node', (evt) => {
      const id = evt.target.id();
      this.selectedNode = nodeMetadata[id] || { kind: 'Unknown', label: id };
    });

    // Click background to deselect
    this.cy.on('tap', (evt) => {
      if (evt.target === this.cy) {
        this.selectedNode = null;
      }
    });
  }
}
