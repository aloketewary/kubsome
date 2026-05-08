import { Component, inject, OnInit } from '@angular/core';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../core/services/api.service';
import { PodMetrics, NodeMetrics } from '../../core/models';

@Component({
  selector: 'app-metrics',
  standalone: true,
  imports: [CardModule, TableModule, ProgressBarModule, TagModule],
  template: `
    <h2 class="page-title">Resource Usage</h2>

    <div class="grid">
      <p-card header="Top Pods by CPU" subheader="{{ topPods.length }} pods">
        <p-table [value]="topPods" [rowHover]="true">
          <ng-template pTemplate="header">
            <tr>
              <th>Pod</th>
              <th style="text-align: right;">CPU</th>
              <th style="text-align: right;">Memory</th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-pod>
            <tr>
              <td><code class="mono">{{ pod.name }}</code></td>
              <td style="text-align: right;"><p-tag [value]="pod.cpu" severity="info" /></td>
              <td style="text-align: right;"><p-tag [value]="pod.memory" severity="warn" /></td>
            </tr>
          </ng-template>
          <ng-template pTemplate="emptymessage">
            <tr>
              <td colspan="3" style="text-align: center; padding: 24px; opacity: 0.5;">
                No metrics (requires metrics-server)
              </td>
            </tr>
          </ng-template>
        </p-table>
      </p-card>

      <p-card header="Node Pressure" subheader="{{ topNodes.length }} nodes">
        @for (node of topNodes; track node.name) {
          <div class="node-item">
            <code class="mono node-name">{{ node.name }}</code>
            <div class="node-bars">
              <div class="bar-row">
                <span class="bar-label">CPU {{ node.cpu_percent }}</span>
                <p-progressBar [value]="node.cpu_pct_val" [showValue]="false" [style]="{ height: '8px' }" />
              </div>
              <div class="bar-row">
                <span class="bar-label">MEM {{ node.memory_percent }}</span>
                <p-progressBar [value]="node.mem_pct_val" [showValue]="false" [style]="{ height: '8px' }" />
              </div>
            </div>
          </div>
        }
        @if (topNodes.length === 0) {
          <div style="text-align: center; padding: 24px; opacity: 0.5;">
            No metrics (requires metrics-server)
          </div>
        }
      </p-card>
    </div>
  `,
  styles: [`
    .page-title { margin: 0 0 24px; font-size: 22px; font-weight: 600; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 16px;
    }
    .node-item {
      padding: 14px 0;
      border-bottom: 1px solid var(--border);
    }
    .node-item:last-child { border-bottom: none; }
    .node-name { display: block; margin-bottom: 10px; }
    .node-bars { display: flex; flex-direction: column; gap: 8px; }
    .bar-row { display: flex; flex-direction: column; gap: 4px; }
    .bar-label { font-size: 11px; opacity: 0.6; }
  `],
})
export class MetricsComponent implements OnInit {
  private api = inject(ApiService);
  topPods: PodMetrics[] = [];
  topNodes: NodeMetrics[] = [];

  ngOnInit() {
    this.api.getTopPods().subscribe(res => (this.topPods = res.pods));
    this.api.getTopNodes().subscribe(res => (this.topNodes = res.nodes));
  }
}
