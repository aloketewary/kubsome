import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { Deployment } from '../../core/models';

@Component({
  selector: 'app-deployments',
  standalone: true,
  imports: [TagModule, ButtonModule, TooltipModule, DialogModule, FormsModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Deployments</h1>
        <p class="subtitle">{{ deployments.length }} deployments</p>
      </div>
      <button pButton icon="pi pi-refresh" label="Refresh" class="p-button-outlined p-button-sm" (click)="refresh()"></button>
    </div>

    <div class="dep-list">
      @for (dep of deployments; track dep.name) {
        <div class="dep-card" [class.dep-degraded]="dep.available < dep.desired">
          <div class="dep-main">
            <div class="dep-info">
              <code class="dep-name mono">{{ dep.name }}</code>
              <p-tag [value]="dep.available === dep.desired ? 'Healthy' : 'Degraded'"
                     [severity]="dep.available === dep.desired ? 'success' : 'danger'" />
            </div>

            <div class="dep-progress">
              <div class="progress-track">
                <div class="progress-fill" [style.width.%]="(dep.available / dep.desired) * 100"
                     [class.fill-healthy]="dep.available === dep.desired"
                     [class.fill-degraded]="dep.available < dep.desired"></div>
              </div>
              <span class="progress-label">{{ dep.available }}/{{ dep.desired }} replicas</span>
            </div>

            <div class="dep-actions">
              <button pButton icon="pi pi-replay" class="p-button-text p-button-sm" pTooltip="Restart" (click)="onRestart(dep)"></button>
              <button pButton icon="pi pi-undo" class="p-button-text p-button-sm" pTooltip="Rollback" (click)="onRollback(dep)"></button>
              <button pButton icon="pi pi-arrows-v" class="p-button-text p-button-sm" pTooltip="Scale" (click)="onScale(dep)"></button>
              <button pButton icon="pi pi-history" class="p-button-text p-button-sm" pTooltip="Rollout History" (click)="viewRollout(dep)"></button>
              <button pButton icon="pi pi-box" class="p-button-text p-button-sm" pTooltip="View Pods" (click)="viewPods(dep)"></button>
            </div>
          </div>
        </div>
      }
    </div>

    <!-- Rollout History Dialog -->
    <p-dialog [(visible)]="rolloutVisible" [header]="'Rollout — ' + rolloutName" [modal]="true" [style]="{ width: '600px' }">
      @if (rolloutData) {
        <div class="rollout-section">
          <h4>Status</h4>
          <pre class="rollout-pre">{{ rolloutData.status }}</pre>
        </div>
        <div class="rollout-section">
          <h4>History</h4>
          <pre class="rollout-pre">{{ rolloutData.history }}</pre>
        </div>
      }
    </p-dialog>

    <!-- Scale Dialog -->
    <p-dialog [(visible)]="scaleVisible" header="Scale Deployment" [modal]="true" [style]="{ width: '400px' }">
      <div class="scale-form">
        <p>Scale <strong>{{ scaleName }}</strong> to:</p>
        <input type="number" [(ngModel)]="scaleReplicas" min="0" max="100" class="scale-input" />
        <div class="scale-actions">
          <button pButton label="Cancel" class="p-button-text" (click)="scaleVisible = false"></button>
          <button pButton label="Scale" icon="pi pi-check" (click)="confirmScale()"></button>
        </div>
      </div>
    </p-dialog>
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

    .dep-list { display: flex; flex-direction: column; gap: 8px; }
    .dep-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px 20px;
      transition: border-color 0.15s;
    }
    .dep-card:hover { border-color: var(--border-hover); }
    .dep-degraded { border-left: 3px solid var(--danger); }

    .dep-main {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .dep-info {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 240px;
    }
    .dep-name { font-size: 13px; }

    .dep-progress {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .progress-track {
      flex: 1;
      height: 6px;
      background: var(--bg-elevated);
      border-radius: 3px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.5s ease;
    }
    .fill-healthy { background: var(--success); }
    .fill-degraded { background: var(--danger); }
    .progress-label { font-size: 11px; color: var(--text-muted); white-space: nowrap; }

    .dep-actions { display: flex; gap: 2px; }

    .rollout-section { margin-bottom: 16px; }
    .rollout-section h4 { font-size: 13px; font-weight: 600; margin-bottom: 8px; color: var(--text-secondary); }
    .rollout-pre {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      background: var(--bg-elevated);
      padding: 12px;
      border-radius: 8px;
      white-space: pre-wrap;
      max-height: 200px;
      overflow-y: auto;
    }

    .scale-form { display: flex; flex-direction: column; gap: 12px; }
    .scale-form p { font-size: 14px; }
    .scale-input {
      width: 100%;
      padding: 10px 12px;
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      font-size: 16px;
      outline: none;
    }
    .scale-input:focus { border-color: var(--accent); }
    .scale-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
  `],
})
export class DeploymentsComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);
  deployments: Deployment[] = [];

  // Rollout dialog
  rolloutVisible = false;
  rolloutName = '';
  rolloutData: any = null;

  // Scale dialog
  scaleVisible = false;
  scaleName = '';
  scaleReplicas = 1;

  refresh() {
    this.api.getDeployments().subscribe(res => (this.deployments = res.deployments));
  }

  onRestart(dep: Deployment) {
    if (confirm(`Restart ${dep.name}?`)) {
      this.api.restart(dep.name).subscribe(() => this.refresh());
    }
  }

  onRollback(dep: Deployment) {
    if (confirm(`Rollback ${dep.name} to previous revision?`)) {
      this.api.rollback(dep.name).subscribe(() => this.refresh());
    }
  }

  onScale(dep: Deployment) {
    this.scaleName = dep.name;
    this.scaleReplicas = dep.desired;
    this.scaleVisible = true;
  }

  confirmScale() {
    this.api.scale(this.scaleName, this.scaleReplicas).subscribe(() => {
      this.scaleVisible = false;
      this.refresh();
    });
  }

  viewRollout(dep: Deployment) {
    this.rolloutName = dep.name;
    this.rolloutVisible = true;
    this.rolloutData = null;
    this.api.getRollout(dep.name).subscribe(res => (this.rolloutData = res));
  }

  viewPods(dep: Deployment) {
    this.router.navigate(['/pods'], { queryParams: { filter: dep.name } });
  }

  ngOnInit() {
    this.refresh();
  }
}
