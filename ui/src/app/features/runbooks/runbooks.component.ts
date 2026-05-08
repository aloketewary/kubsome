import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';

interface RunbookStep {
  title: string;
  command?: string;
  done: boolean;
  output?: string;
}

@Component({
  selector: 'app-runbooks',
  standalone: true,
  imports: [FormsModule, TagModule, ButtonModule],
  template: `
    <div class="page-header">
      <h1>Runbooks</h1>
      <p class="subtitle">Guided incident response workflows</p>
    </div>

    <!-- Playbook selector -->
    <div class="playbook-grid">
      @for (pb of playbooks; track pb.id) {
        <div class="playbook-card" [class.active]="activePlaybook === pb.id" (click)="selectPlaybook(pb)">
          <div class="pb-icon"><i [class]="pb.icon"></i></div>
          <div class="pb-info">
            <span class="pb-name">{{ pb.name }}</span>
            <span class="pb-desc">{{ pb.description }}</span>
          </div>
        </div>
      }
    </div>

    <!-- Active runbook steps -->
    @if (steps.length > 0) {
      <div class="steps-container">
        <div class="steps-header">
          <h3>{{ activePlaybookName }}</h3>
          <p-tag [value]="completedSteps + '/' + steps.length + ' complete'" [severity]="completedSteps === steps.length ? 'success' : 'info'" />
        </div>

        @for (step of steps; track $index) {
          <div class="step" [class.step-done]="step.done">
            <div class="step-marker">
              @if (step.done) {
                <i class="pi pi-check-circle"></i>
              } @else {
                <span class="step-num">{{ $index + 1 }}</span>
              }
            </div>
            <div class="step-body">
              <span class="step-title">{{ step.title }}</span>
              @if (step.command) {
                <code class="step-cmd">{{ step.command }}</code>
              }
              @if (step.output) {
                <pre class="step-output">{{ step.output }}</pre>
              }
            </div>
            @if (!step.done) {
              <button pButton icon="pi pi-play" class="p-button-sm p-button-text" (click)="runStep($index)"></button>
            }
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .page-header { margin-bottom: 24px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

    .playbook-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 10px;
      margin-bottom: 28px;
    }
    .playbook-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all 0.15s;
    }
    .playbook-card:hover { border-color: var(--border-hover); }
    .playbook-card.active { border-color: var(--accent); background: var(--accent-subtle); }
    .pb-icon {
      width: 32px; height: 32px; border-radius: 8px;
      background: var(--bg-elevated); display: flex; align-items: center; justify-content: center;
      font-size: 14px; color: var(--text-secondary);
    }
    .playbook-card.active .pb-icon { background: var(--accent); color: #fff; }
    .pb-info { display: flex; flex-direction: column; }
    .pb-name { font-size: 13px; font-weight: 600; }
    .pb-desc { font-size: 11px; color: var(--text-muted); }

    .steps-container {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 20px;
    }
    .steps-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 20px;
    }
    .steps-header h3 { font-size: 16px; font-weight: 600; }

    .step {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid var(--border);
    }
    .step:last-child { border-bottom: none; }
    .step-done { opacity: 0.6; }
    .step-marker {
      width: 24px; height: 24px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; font-size: 11px; font-weight: 600;
      background: var(--bg-elevated); color: var(--text-muted);
    }
    .step-done .step-marker { background: var(--success-subtle); color: var(--success); }
    .step-done .step-marker i { font-size: 14px; }
    .step-body { flex: 1; display: flex; flex-direction: column; gap: 4px; }
    .step-title { font-size: 13px; font-weight: 500; }
    .step-cmd {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      padding: 4px 8px;
      background: var(--bg-elevated);
      border-radius: 4px;
      color: var(--accent);
      display: inline-block;
    }
    .step-output {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      background: var(--bg-elevated);
      padding: 8px 12px;
      border-radius: 6px;
      max-height: 120px;
      overflow-y: auto;
      white-space: pre-wrap;
      margin-top: 4px;
    }
    .step-num { font-size: 11px; }
  `],
})
export class RunbooksComponent {
  private http = inject(HttpClient);

  playbooks = [
    { id: 'pod-crash', name: 'Pod CrashLoop', description: 'Debug a crashing pod', icon: 'pi pi-exclamation-triangle' },
    { id: 'high-cpu', name: 'High CPU', description: 'Investigate CPU spike', icon: 'pi pi-chart-bar' },
    { id: 'deploy-fail', name: 'Failed Deploy', description: 'Rollback and diagnose', icon: 'pi pi-send' },
    { id: 'node-pressure', name: 'Node Pressure', description: 'Node resource exhaustion', icon: 'pi pi-server' },
    { id: 'network-issue', name: 'Network Issue', description: 'DNS and connectivity', icon: 'pi pi-globe' },
  ];

  activePlaybook = '';
  activePlaybookName = '';
  steps: RunbookStep[] = [];

  get completedSteps() { return this.steps.filter(s => s.done).length; }

  selectPlaybook(pb: any) {
    this.activePlaybook = pb.id;
    this.activePlaybookName = pb.name;
    this.steps = this.getSteps(pb.id);
  }

  runStep(index: number) {
    const step = this.steps[index];
    if (!step.command) {
      step.done = true;
      return;
    }
    this.http.post<any>('http://localhost:8000/api/exec', { command: step.command }).subscribe(res => {
      step.output = res.output || '(no output)';
      step.done = true;
    });
  }

  private getSteps(id: string): RunbookStep[] {
    switch (id) {
      case 'pod-crash': return [
        { title: 'List unhealthy pods', command: 'pods', done: false },
        { title: 'Check events for errors', command: 'events', done: false },
        { title: 'Inspect the crashing pod', command: 'kubectl get pods --field-selector=status.phase!=Running', done: false },
        { title: 'Check pod logs for errors', done: false },
        { title: 'Run AI diagnosis', done: false },
      ];
      case 'high-cpu': return [
        { title: 'Check top pods by CPU', command: 'top pods', done: false },
        { title: 'Check top nodes', command: 'top nodes', done: false },
        { title: 'Check HPA status', command: 'kubectl get hpa', done: false },
        { title: 'Scale if needed', done: false },
      ];
      case 'deploy-fail': return [
        { title: 'Check rollout status', command: 'kubectl rollout status deployment --timeout=5s', done: false },
        { title: 'View recent events', command: 'events', done: false },
        { title: 'Check pod status', command: 'pods', done: false },
        { title: 'Rollback if needed', done: false },
      ];
      case 'node-pressure': return [
        { title: 'Check node status', command: 'kubectl get nodes', done: false },
        { title: 'Check node resource usage', command: 'top nodes', done: false },
        { title: 'Find pods on pressured node', done: false },
        { title: 'Drain check', done: false },
      ];
      case 'network-issue': return [
        { title: 'Check services', command: 'kubectl get svc', done: false },
        { title: 'Check endpoints', command: 'kubectl get endpoints', done: false },
        { title: 'Check ingress', command: 'kubectl get ingress', done: false },
        { title: 'DNS lookup', done: false },
      ];
      default: return [];
    }
  }
}
