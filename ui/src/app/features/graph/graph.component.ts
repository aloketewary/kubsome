import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { Select } from 'primeng/select';

interface GraphNode {
  name: string;
  kind: string;
  layer: number;
}

@Component({
  selector: 'app-graph',
  standalone: true,
  imports: [FormsModule, ButtonModule, TagModule, TooltipModule, Select],
  template: `
    <div class="page-header">
      <div>
        <h1>Service Map</h1>
        <p class="subtitle">Resource dependency visualization</p>
      </div>
      <div class="controls">
        <p-select [options]="deployments" [(ngModel)]="selectedDep" placeholder="Select deployment..." [style]="{ width: '240px' }" [filter]="true" />
        <button pButton label="Trace" icon="pi pi-sitemap" class="p-button-sm" (click)="trace()" [disabled]="!selectedDep"></button>
      </div>
    </div>

    @if (!traceData && !selectedDep) {
      <!-- Start State -->
      <div class="start-state">
        <div class="start-icon"><i class="pi pi-sitemap"></i></div>
        <h3>Visualize Dependencies</h3>
        <p>Select a deployment to trace its resource relationships — services, pods, configmaps, secrets, and ingress routes.</p>
      </div>
    }

    @if (layers.length > 0) {
      <!-- Legend -->
      <div class="legend-bar">
        @for (item of legendItems; track item.kind) {
          <span class="legend-item">
            <span class="legend-dot" [style.background]="item.color"></span>
            {{ item.kind }}
          </span>
        }
      </div>

      <!-- Layered Graph -->
      <div class="graph-flow">
        @for (layer of layers; track $index) {
          <!-- Layer -->
          <div class="flow-layer">
            <div class="layer-nodes">
              @for (node of layer; track node.name) {
                <div class="flow-node" [class]="'fn-' + node.kind" [pTooltip]="node.kind + ': ' + node.name">
                  <div class="fn-icon">
                    <i class="pi" [class]="nodeIcon(node.kind)"></i>
                  </div>
                  <div class="fn-info">
                    <span class="fn-name">{{ shortName(node.name) }}</span>
                    <span class="fn-kind">{{ node.kind }}</span>
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Connector between layers -->
          @if ($index < layers.length - 1) {
            <div class="flow-connectors">
              <div class="connector-line"></div>
              <div class="connector-arrows">
                @for (n of layers[$index + 1]; track n.name) {
                  <i class="pi pi-chevron-down"></i>
                }
              </div>
            </div>
          }
        }
      </div>

      <!-- Summary -->
      <div class="graph-summary">
        <div class="gs-item"><span class="gs-val">{{ totalNodes }}</span><span class="gs-label">Resources</span></div>
        <div class="gs-item"><span class="gs-val">{{ layers.length }}</span><span class="gs-label">Layers</span></div>
        <div class="gs-item"><span class="gs-val">{{ podCount }}</span><span class="gs-label">Pods</span></div>
      </div>
    }

    @if (traceData && layers.length === 0) {
      <div class="empty-state"><i class="pi pi-info-circle"></i> No dependency data for this deployment</div>
    }
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .controls { display: flex; gap: 8px; align-items: center; }

    /* Start State */
    .start-state {
      text-align: center; padding: 64px 32px;
      background: var(--bg-card); border: 1px dashed var(--border); border-radius: var(--radius);
    }
    .start-icon {
      width: 56px; height: 56px; border-radius: 50%; margin: 0 auto 16px;
      background: var(--accent-subtle); color: var(--accent);
      display: flex; align-items: center; justify-content: center; font-size: 24px;
    }
    .start-state h3 { font-size: 18px; font-weight: 600; margin: 0 0 8px; }
    .start-state p { font-size: 13px; color: var(--text-secondary); margin: 0; max-width: 400px; margin: 0 auto; line-height: 1.5; }

    /* Legend */
    .legend-bar {
      display: flex; gap: 16px; margin-bottom: 20px;
      padding: 10px 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-sm);
    }
    .legend-item { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-secondary); }
    .legend-dot { width: 10px; height: 10px; border-radius: 3px; }

    /* Graph Flow */
    .graph-flow {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 32px; display: flex; flex-direction: column; align-items: center; gap: 0;
    }
    .flow-layer { width: 100%; }
    .layer-nodes {
      display: flex; justify-content: center; gap: 12px; flex-wrap: wrap;
    }
    .flow-node {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 16px; border-radius: 10px;
      border: 1px solid var(--border); background: var(--bg-elevated);
      transition: all 0.15s; cursor: default;
    }
    .flow-node:hover { border-color: var(--border-hover); transform: translateY(-1px); }
    .fn-Ingress { border-color: #f472b6; background: rgba(244,114,182,0.06); }
    .fn-Service { border-color: var(--success); background: var(--success-subtle); }
    .fn-Deployment { border-color: var(--accent); background: var(--accent-subtle); padding: 14px 20px; }
    .fn-ReplicaSet { border-color: var(--warning); background: var(--warning-subtle); }
    .fn-Pod { border-color: var(--purple); background: rgba(168,85,247,0.06); }
    .fn-ConfigMap, .fn-Secret { border-color: var(--text-muted); }

    .fn-icon {
      width: 28px; height: 28px; border-radius: 6px;
      display: flex; align-items: center; justify-content: center; font-size: 13px;
      background: var(--bg); color: var(--text-secondary);
    }
    .fn-Deployment .fn-icon { width: 32px; height: 32px; font-size: 15px; background: var(--accent); color: #fff; }
    .fn-info { display: flex; flex-direction: column; }
    .fn-name { font-size: 11px; font-weight: 500; font-family: 'JetBrains Mono', monospace; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .fn-kind { font-size: 9px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .fn-Deployment .fn-name { font-size: 13px; font-weight: 700; }

    /* Connectors */
    .flow-connectors {
      display: flex; flex-direction: column; align-items: center; padding: 8px 0;
    }
    .connector-line { width: 2px; height: 16px; background: var(--border); }
    .connector-arrows { display: flex; gap: 24px; color: var(--text-muted); font-size: 10px; }

    /* Summary */
    .graph-summary {
      display: flex; gap: 24px; justify-content: center; margin-top: 20px;
      padding: 12px 20px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-sm);
    }
    .gs-item { text-align: center; }
    .gs-val { display: block; font-size: 18px; font-weight: 700; }
    .gs-label { display: block; font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }

    .empty-state {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      padding: 48px; color: var(--text-muted); font-size: 13px;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-sm);
    }
    .empty-state i { font-size: 16px; }
  `],
})
export class GraphComponent implements OnInit {
  private http = inject(HttpClient);
  deployments: string[] = [];
  selectedDep = '';
  traceData: any = null;
  layers: GraphNode[][] = [];

  legendItems = [
    { kind: 'Ingress', color: '#f472b6' },
    { kind: 'Service', color: '#22c55e' },
    { kind: 'Deployment', color: '#3b82f6' },
    { kind: 'ReplicaSet', color: '#eab308' },
    { kind: 'Pod', color: '#a855f7' },
    { kind: 'ConfigMap', color: '#6b7280' },
    { kind: 'Secret', color: '#6b7280' },
  ];

  get totalNodes() { return this.layers.reduce((sum, l) => sum + l.length, 0); }
  get podCount() { return this.layers.reduce((sum, l) => sum + l.filter(n => n.kind === 'Pod').length, 0); }

  ngOnInit() {
    this.http.get<any>('http://localhost:8000/api/deployments').subscribe(res => {
      this.deployments = (res.deployments || []).map((d: any) => d.name);
    });
  }

  trace() {
    if (!this.selectedDep) return;
    this.layers = [];
    this.http.get<any>(`http://localhost:8000/api/trace/${this.selectedDep}`).subscribe(res => {
      this.traceData = res;
      this.buildLayers(res.trace || res);
    });
  }

  nodeIcon(kind: string): string {
    const map: Record<string, string> = {
      Ingress: 'pi-link', Service: 'pi-globe', Deployment: 'pi-send',
      ReplicaSet: 'pi-copy', Pod: 'pi-box', ConfigMap: 'pi-file', Secret: 'pi-lock', Node: 'pi-server',
    };
    return map[kind] || 'pi-th-large';
  }

  shortName(name: string): string {
    return name.length > 24 ? '...' + name.slice(-21) : name;
  }

  private buildLayers(data: any) {
    const layers: GraphNode[][] = [];

    // Layer 0: Ingress
    if (data.ingress) {
      const name = typeof data.ingress === 'string' ? data.ingress : data.ingress.name;
      if (name) layers.push([{ name, kind: 'Ingress', layer: 0 }]);
    }

    // Layer 1: Service
    const svcName = typeof data.service === 'string' ? data.service : data.service?.name;
    if (svcName) layers.push([{ name: svcName, kind: 'Service', layer: 1 }]);

    // Layer 2: Deployment
    const depName = typeof data.deployment === 'string' ? data.deployment : data.deployment?.name;
    if (depName) layers.push([{ name: depName, kind: 'Deployment', layer: 2 }]);

    // Layer 3: ReplicaSets (active only)
    if (data.replicasets) {
      const active = data.replicasets.filter((rs: any) => rs.replicas > 0);
      if (active.length > 0) {
        layers.push(active.map((rs: any) => ({ name: typeof rs === 'string' ? rs : rs.name, kind: 'ReplicaSet', layer: 3 })));
      }
    }

    // Layer 4: Pods
    if (data.pods && data.pods.length > 0) {
      layers.push(data.pods.map((p: any) => ({ name: typeof p === 'string' ? p : p.name, kind: 'Pod', layer: 4 })));
    }

    // Layer 5: ConfigMaps + Secrets (side resources)
    const sideResources: GraphNode[] = [];
    if (data.configmaps) {
      for (const cm of data.configmaps) {
        sideResources.push({ name: typeof cm === 'string' ? cm : cm.name, kind: 'ConfigMap', layer: 5 });
      }
    }
    if (data.secrets) {
      for (const s of data.secrets) {
        sideResources.push({ name: typeof s === 'string' ? s : s.name, kind: 'Secret', layer: 5 });
      }
    }
    if (sideResources.length > 0) layers.push(sideResources);

    this.layers = layers;
  }
}
