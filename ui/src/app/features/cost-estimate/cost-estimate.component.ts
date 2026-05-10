import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-cost-estimate',
  standalone: true,
  imports: [ButtonModule, TooltipModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Cost Estimation</h1>
        <p class="subtitle">Estimated monthly spend based on resource requests</p>
      </div>
      <button pButton icon="pi pi-refresh" class="p-button-outlined p-button-sm p-button-rounded" (click)="refresh()"></button>
    </div>

    @if (data) {
      <!-- Total Banner -->
      <div class="total-banner">
        <div class="total-amount">\${{ data.total.toFixed(2) }}</div>
        <div class="total-label">estimated / month</div>
        <div class="total-note">{{ data.deployments.length }} deployments · {{ data.pricing.note }}</div>
      </div>

      <!-- Table -->
      <div class="cost-table">
        <div class="table-header">
          <span class="col-name">Deployment</span>
          <span class="col-rep">Replicas</span>
          <span class="col-cpu">CPU</span>
          <span class="col-mem">Memory</span>
          <span class="col-cost">$/pod</span>
          <span class="col-total">$/month</span>
        </div>
        @for (dep of data.deployments; track dep.name) {
          <div class="table-row">
            <span class="col-name mono">{{ dep.name }}</span>
            <span class="col-rep">{{ dep.replicas }}</span>
            <span class="col-cpu">{{ dep.cpu_request }}</span>
            <span class="col-mem">{{ dep.memory_request }}</span>
            <span class="col-cost">\${{ dep.cost_per_pod.toFixed(2) }}</span>
            <span class="col-total bold">\${{ dep.cost_total.toFixed(2) }}</span>
          </div>
        }
        @if (data.deployments.length === 0) {
          <div class="empty">No deployments with resource requests</div>
        }
      </div>
    } @else {
      <div class="loading"><div class="spin"></div> Calculating costs...</div>
    }
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

    .total-banner {
      text-align: center; padding: 28px; margin-bottom: 20px;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
    }
    .total-amount { font-size: 42px; font-weight: 800; letter-spacing: -0.04em; color: var(--accent); }
    .total-label { font-size: 14px; color: var(--text-secondary); margin-top: 4px; }
    .total-note { font-size: 11px; color: var(--text-muted); margin-top: 8px; }

    .cost-table { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
    .table-header {
      display: grid; grid-template-columns: 2fr 0.5fr 0.7fr 0.7fr 0.7fr 0.8fr;
      padding: 10px 16px; background: var(--bg-elevated); border-bottom: 1px solid var(--border);
      font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em;
    }
    .table-row {
      display: grid; grid-template-columns: 2fr 0.5fr 0.7fr 0.7fr 0.7fr 0.8fr;
      padding: 10px 16px; border-bottom: 1px solid var(--border); font-size: 12px; align-items: center;
      transition: background 0.1s;
    }
    .table-row:last-child { border-bottom: none; }
    .table-row:hover { background: var(--bg-hover); }
    .mono { font-family: 'JetBrains Mono', monospace; font-size: 11px; }
    .bold { font-weight: 600; }
    .col-cost, .col-total { text-align: right; }
    .col-rep, .col-cpu, .col-mem { text-align: center; }
    .empty { padding: 40px; text-align: center; color: var(--text-muted); font-size: 13px; }
    .loading { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 60px; color: var(--text-muted); }
    .spin { width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class CostEstimateComponent implements OnInit {
  private http = inject(HttpClient);
  data: any = null;

  ngOnInit() { this.refresh(); }

  refresh() {
    this.http.get<any>('http://localhost:8000/api/cost-estimate').subscribe({
      next: (res) => (this.data = res),
      error: () => (this.data = { deployments: [], total: 0, pricing: { note: 'Error' } }),
    });
  }
}
