import { Component, ElementRef, inject, OnInit, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { Select } from 'primeng/select';
import cytoscape from 'cytoscape';

@Component({
  selector: 'app-graph',
  standalone: true,
  imports: [FormsModule, ButtonModule, TagModule, TooltipModule, Select],
  template: `
    <div class="page-header">
      <div>
        <h1>Service Map</h1>
        <p class="subtitle">Interactive resource topology visualization</p>
      </div>
      <div class="controls">
        <p-select [options]="deployments" [(ngModel)]="selectedDep" placeholder="Select deployment..." [style]="{ width: '240px' }" [filter]="true" />
        <button pButton label="Trace" icon="pi pi-sitemap" class="p-button-sm" (click)="trace()" [disabled]="!selectedDep"></button>
        <button pButton icon="pi pi-expand" class="p-button-outlined p-button-sm" (click)="fit()" pTooltip="Fit to Screen"></button>
      </div>
    </div>

    <div class="graph-viewport glass">
      <div #cyContainer class="cy-container"></div>

      @if (!traceData && !selectedDep) {
        <div class="viewport-overlay">
          <div class="start-state">
            <div class="start-icon"><i class="pi pi-sitemap"></i></div>
            <h3>Interactive Topology</h3>
            <p>Trace resource relationships with a fully interactive map. Drag to reorder, zoom to inspect, and click to explore.</p>
          </div>
        </div>
      }

      <!-- Graph Summary (Float) -->
      @if (traceData) {
        <div class="graph-summary-overlay">
          <div class="gs-item"><span class="gs-val">{{ nodeCount }}</span><span class="gs-label">Nodes</span></div>
          <div class="gs-item"><span class="gs-val">{{ edgeCount }}</span><span class="gs-label">Edges</span></div>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .controls { display: flex; gap: 8px; align-items: center; }

    .graph-viewport {
      position: relative;
      height: calc(100vh - 200px);
      background: #000;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
    }
    .cy-container {
      width: 100%;
      height: 100%;
    }
    .viewport-overlay {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.4); pointer-events: none;
    }

    .start-state {
      text-align: center; padding: 32px; pointer-events: auto;
    }
    .start-icon {
      width: 56px; height: 56px; border-radius: 50%; margin: 0 auto 16px;
      background: var(--accent-subtle); color: var(--accent);
      display: flex; align-items: center; justify-content: center; font-size: 24px;
    }
    .start-state h3 { font-size: 18px; font-weight: 600; margin: 0 0 8px; }
    .start-state p { font-size: 13px; color: var(--text-secondary); margin: 0; max-width: 360px; line-height: 1.5; }

    .graph-summary-overlay {
      position: absolute; bottom: 20px; left: 20px;
      display: flex; gap: 20px; padding: 12px 20px;
      background: rgba(15,15,17,0.8); backdrop-filter: blur(8px);
      border: 1px solid var(--border); border-radius: var(--radius);
      pointer-events: none;
    }
    .gs-item { text-align: center; }
    .gs-val { display: block; font-size: 16px; font-weight: 700; color: var(--text); }
    .gs-label { display: block; font-size: 9px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
  `]
})
export class GraphComponent implements OnInit, OnDestroy {
  @ViewChild('cyContainer', { static: true }) cyContainer!: ElementRef;
  private http = inject(HttpClient);
  private cy: cytoscape.Core | null = null;

  deployments: string[] = [];
  selectedDep = '';
  traceData: any = null;
  nodeCount = 0;
  edgeCount = 0;

  ngOnInit() {
    this.http.get<any>('http://localhost:8000/api/deployments').subscribe(res => {
      this.deployments = (res.deployments || []).map((d: any) => d.name);
    });
  }

  ngOnDestroy() {
    this.cy?.destroy();
  }

  trace() {
    if (!this.selectedDep) return;
    this.http.get<any>(`http://localhost:8000/api/trace/${this.selectedDep}`).subscribe(res => {
      this.traceData = res.trace || res;
      this.renderGraph(this.traceData);
    });
  }

  fit() {
    this.cy?.fit();
  }

  private renderGraph(data: any) {
    const elements: cytoscape.ElementDefinition[] = [];

    // Add nodes
    if (data.ingress) elements.push({ data: { id: 'ingress', label: data.ingress.name || data.ingress, kind: 'Ingress' } });
    if (data.service) elements.push({ data: { id: 'service', label: data.service.name || data.service, kind: 'Service' } });
    if (data.deployment) elements.push({ data: { id: 'deployment', label: data.deployment.name || data.deployment, kind: 'Deployment' } });

    if (data.replicasets) {
      data.replicasets.forEach((rs: any) => {
        elements.push({ data: { id: rs.uid || rs.name, label: rs.name, kind: 'ReplicaSet' } });
      });
    }

    if (data.pods) {
      data.pods.forEach((p: any) => {
        elements.push({ data: { id: p.name, label: p.name, kind: 'Pod' } });
      });
    }

    // Add edges
    if (data.ingress && data.service) elements.push({ data: { source: 'ingress', target: 'service' } });
    if (data.service && data.deployment) elements.push({ data: { source: 'service', target: 'deployment' } });

    if (data.deployment && data.replicasets) {
      data.replicasets.forEach((rs: any) => {
        elements.push({ data: { source: 'deployment', target: rs.uid || rs.name } });
      });
    }

    if (data.pods) {
      data.pods.forEach((p: any) => {
        if (p.owner_uid) {
          elements.push({ data: { source: p.owner_uid, target: p.name } });
        } else {
          // Fallback if no owner (unlikely for deployment pods)
          if (data.replicasets && data.replicasets.length > 0) {
            elements.push({ data: { source: data.replicasets[0].uid || data.replicasets[0].name, target: p.name } });
          }
        }
      });
    }

    this.nodeCount = elements.filter(e => !e.data.source).length;
    this.edgeCount = elements.filter(e => e.data.source).length;

    this.cy = cytoscape({
      container: this.cyContainer.nativeElement,
      elements: elements,
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'color': '#a1a1aa',
            'font-size': '10px',
            'font-family': "'JetBrains Mono', monospace",
            'text-valign': 'bottom',
            'text-margin-y': 5,
            'background-color': '#1c1c21',
            'border-width': 1,
            'border-color': '#32323a',
            'width': 30,
            'height': 30
          }
        },
        {
          selector: 'node[kind="Deployment"]',
          style: {
            'background-color': '#3b82f6',
            'border-color': '#60a5fa',
            'width': 40,
            'height': 40
          }
        },
        {
          selector: 'node[kind="Service"]',
          style: { 'border-color': '#10b981', 'background-color': 'rgba(16, 185, 129, 0.2)' }
        },
        {
          selector: 'node[kind="Pod"]',
          style: { 'border-color': '#8b5cf6', 'background-color': 'rgba(139, 92, 246, 0.2)' }
        },
        {
          selector: 'edge',
          style: {
            'width': 1,
            'line-color': '#32323a',
            'target-arrow-color': '#32323a',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier'
          }
        }
      ],
      layout: {
        name: 'breadthfirst',
        directed: true,
        padding: 50
      }
    });
  }
}
