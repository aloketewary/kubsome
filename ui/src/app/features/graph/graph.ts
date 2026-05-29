import { Component, ElementRef, inject, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { Select } from 'primeng/select';
import cytoscape from 'cytoscape';
import { IntelHeaderComponent } from '../../shared/components/futuristic/intel-header.component';


@Component({
  selector: 'app-graph',
  standalone: true,
  imports: [FormsModule, ButtonModule, TagModule, TooltipModule, Select, IntelHeaderComponent],
  templateUrl: './graph.html',
  styleUrl: './graph.scss',
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
