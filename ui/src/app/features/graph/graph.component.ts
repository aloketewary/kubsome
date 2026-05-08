import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';

interface GraphNode {
  name: string;
  kind: string;
  status?: string;
}

interface GraphEdge {
  from: string;
  to: string;
  label?: string;
}

@Component({
  selector: 'app-graph',
  standalone: true,
  imports: [FormsModule, ButtonModule, TagModule, SelectModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Service Map</h1>
        <p class="subtitle">Dependency graph for your services</p>
      </div>
      <div class="controls">
        <p-select [options]="deployments" [(ngModel)]="selectedDep" placeholder="Select deployment" [style]="{ width: '220px' }" [filter]="true" />
        <button pButton label="Trace" icon="pi pi-sitemap" class="p-button-sm" (click)="trace()" [disabled]="!selectedDep"></button>
      </div>
    </div>

    @if (nodes.length > 0) {
      <div class="graph-container">
        <div class="graph-canvas">
          @for (node of nodes; track node.name) {
            <div class="graph-node" [class]="'node-' + node.kind">
              <div class="node-icon">
                <i class="pi" [class.pi-box]="node.kind === 'Pod'"
                   [class.pi-send]="node.kind === 'Deployment'"
                   [class.pi-globe]="node.kind === 'Service'"
                   [class.pi-copy]="node.kind === 'ReplicaSet'"
                   [class.pi-link]="node.kind === 'Ingress'"
                   [class.pi-database]="node.kind === 'ConfigMap' || node.kind === 'Secret'"
                   [class.pi-server]="node.kind === 'Node'"></i>
              </div>
              <div class="node-info">
                <span class="node-name">{{ node.name }}</span>
                <span class="node-kind">{{ node.kind }}</span>
              </div>
            </div>
          }
        </div>

        @if (edges.length > 0) {
          <div class="graph-edges">
            <h4>Connections</h4>
            @for (edge of edges; track $index) {
              <div class="edge-row">
                <code>{{ edge.from }}</code>
                <i class="pi pi-arrow-right"></i>
                <code>{{ edge.to }}</code>
                @if (edge.label) {
                  <p-tag [value]="edge.label" severity="info" [rounded]="true" />
                }
              </div>
            }
          </div>
        }
      </div>
    } @else if (traceData) {
      <div class="empty-state">No dependency data available for this deployment</div>
    }
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .controls { display: flex; gap: 8px; align-items: center; }

    .graph-container {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 24px;
    }
    .graph-canvas {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 24px;
    }
    .graph-node {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--bg-elevated);
      transition: border-color 0.15s;
    }
    .graph-node:hover { border-color: var(--border-hover); }
    .node-Deployment { border-left: 3px solid var(--accent); }
    .node-Service { border-left: 3px solid var(--success); }
    .node-Pod { border-left: 3px solid var(--purple); }
    .node-ReplicaSet { border-left: 3px solid var(--warning); }
    .node-Ingress { border-left: 3px solid #f472b6; }
    .node-ConfigMap, .node-Secret { border-left: 3px solid var(--warning); }
    .node-icon {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg);
    }
    .node-icon i { font-size: 14px; color: var(--text-secondary); }
    .node-info { display: flex; flex-direction: column; }
    .node-name { font-size: 12px; font-weight: 500; font-family: 'JetBrains Mono', monospace; }
    .node-kind { font-size: 10px; color: var(--text-muted); }

    .graph-edges {
      border-top: 1px solid var(--border);
      padding-top: 16px;
    }
    .graph-edges h4 { font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 12px; }
    .edge-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 0;
      font-size: 12px;
    }
    .edge-row code { font-family: 'JetBrains Mono', monospace; }
    .edge-row i { font-size: 10px; color: var(--text-muted); }

    .empty-state { text-align: center; padding: 48px; color: var(--text-muted); font-size: 13px; }
  `],
})
export class GraphComponent implements OnInit {
  private http = inject(HttpClient);
  deployments: string[] = [];
  selectedDep = '';
  nodes: GraphNode[] = [];
  edges: GraphEdge[] = [];
  traceData: any = null;

  ngOnInit() {
    this.http.get<any>('http://localhost:8000/api/deployments').subscribe(res => {
      this.deployments = (res.deployments || []).map((d: any) => d.name);
    });
  }

  trace() {
    if (!this.selectedDep) return;
    this.http.get<any>(`http://localhost:8000/api/trace/${this.selectedDep}`).subscribe(res => {
      this.traceData = res;
      this.buildGraph(res.trace || res);
    });
  }

  private buildGraph(data: any) {
    this.nodes = [];
    this.edges = [];

    const depName = typeof data.deployment === 'string' ? data.deployment : data.deployment?.name;
    const svcName = typeof data.service === 'string' ? data.service : data.service?.name;

    if (depName) {
      this.nodes.push({ name: depName, kind: 'Deployment' });
    }
    if (svcName) {
      this.nodes.push({ name: svcName, kind: 'Service' });
      if (depName) {
        this.edges.push({ from: svcName, to: depName, label: 'routes to' });
      }
    }
    if (data.pods) {
      for (const pod of data.pods) {
        const podName = typeof pod === 'string' ? pod : pod.name;
        this.nodes.push({ name: podName, kind: 'Pod' });
        if (depName) {
          this.edges.push({ from: depName, to: podName });
        }
      }
    }
    if (data.replicasets) {
      // Only show active replicasets (replicas > 0)
      for (const rs of data.replicasets) {
        if (rs.replicas > 0) {
          const rsName = typeof rs === 'string' ? rs : rs.name;
          this.nodes.push({ name: rsName, kind: 'ReplicaSet' });
          if (depName) {
            this.edges.push({ from: depName, to: rsName, label: 'manages' });
          }
        }
      }
    }
    if (data.configmaps) {
      for (const cm of data.configmaps) {
        const cmName = typeof cm === 'string' ? cm : cm.name;
        this.nodes.push({ name: cmName, kind: 'ConfigMap' });
        if (depName) {
          this.edges.push({ from: depName, to: cmName, label: 'mounts' });
        }
      }
    }
    if (data.secrets) {
      for (const s of data.secrets) {
        const sName = typeof s === 'string' ? s : s.name;
        this.nodes.push({ name: sName, kind: 'Secret' });
        if (depName) {
          this.edges.push({ from: depName, to: sName, label: 'uses' });
        }
      }
    }
    if (data.ingress) {
      const ingName = typeof data.ingress === 'string' ? data.ingress : data.ingress.name;
      if (ingName) {
        this.nodes.push({ name: ingName, kind: 'Ingress' });
        if (svcName) {
          this.edges.push({ from: ingName, to: svcName, label: 'exposes' });
        }
      }
    }
  }
}
