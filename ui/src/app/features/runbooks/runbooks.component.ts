import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

interface RunbookStep {
  title: string;
  description: string;
  command?: string;
  done: boolean;
  output?: string;
  loading?: boolean;
}

interface Runbook {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  severity: string;
  estimatedTime: string;
  steps: RunbookStep[];
}

@Component({
  selector: 'app-runbooks',
  standalone: true,
  imports: [FormsModule, TagModule, ButtonModule, TooltipModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Runbooks</h1>
        <p class="subtitle">Guided incident response workflows</p>
      </div>
    </div>

    <!-- Playbook Selection -->
    @if (!activeRunbook) {
      <div class="intro-card">
        <div class="intro-icon"><i class="pi pi-book"></i></div>
        <div class="intro-text">
          <h3>Choose a Runbook</h3>
          <p>Follow step-by-step procedures to diagnose and resolve common issues.</p>
        </div>
      </div>

      <div class="runbook-grid">
        @for (rb of runbooks; track rb.id) {
          <div class="runbook-card" (click)="selectRunbook(rb)">
            <div class="rb-header">
              <div class="rb-icon" [style.background]="rb.color + '15'" [style.color]="rb.color">
                <i [class]="rb.icon"></i>
              </div>
              <p-tag [value]="rb.severity" [severity]="rb.severity === 'Critical' ? 'danger' : rb.severity === 'High' ? 'warn' : 'info'" [rounded]="true" />
            </div>
            <h4 class="rb-name">{{ rb.name }}</h4>
            <p class="rb-desc">{{ rb.description }}</p>
            <div class="rb-footer">
              <span class="rb-steps"><i class="pi pi-list"></i> {{ rb.steps.length }} steps</span>
              <span class="rb-time"><i class="pi pi-clock"></i> {{ rb.estimatedTime }}</span>
            </div>
          </div>
        }
      </div>
    }

    <!-- Active Runbook -->
    @if (activeRunbook) {
      <!-- Runbook Header -->
      <div class="active-header">
        <button pButton icon="pi pi-arrow-left" class="p-button-text p-button-sm p-button-rounded" (click)="activeRunbook = null" pTooltip="Back to list"></button>
        <div class="active-info">
          <div class="active-icon" [style.background]="activeRunbook.color + '15'" [style.color]="activeRunbook.color">
            <i [class]="activeRunbook.icon"></i>
          </div>
          <div>
            <h2>{{ activeRunbook.name }}</h2>
            <p>{{ activeRunbook.description }}</p>
          </div>
        </div>
        <div class="active-progress">
          <div class="progress-ring">
            <svg viewBox="0 0 36 36">
              <path class="ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path class="ring-fill" [attr.stroke-dasharray]="progressPct + ', 100'" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            </svg>
            <span class="ring-val">{{ completedSteps }}/{{ activeRunbook.steps.length }}</span>
          </div>
        </div>
      </div>

      <!-- Steps -->
      <div class="steps-list">
        @for (step of activeRunbook.steps; track $index; let i = $index) {
          <div class="step-card" [class.step-done]="step.done" [class.step-active]="i === currentStepIndex">
            <div class="step-left">
              <div class="step-number" [class.num-done]="step.done" [class.num-active]="i === currentStepIndex">
                @if (step.done) {
                  <i class="pi pi-check"></i>
                } @else {
                  {{ i + 1 }}
                }
              </div>
              @if (i < activeRunbook.steps.length - 1) {
                <div class="step-connector" [class.conn-done]="step.done"></div>
              }
            </div>

            <div class="step-body">
              <div class="step-top">
                <span class="step-title">{{ step.title }}</span>
                @if (step.done) {
                  <p-tag value="Done" severity="success" [rounded]="true" />
                } @else if (i === currentStepIndex) {
                  <p-tag value="Current" severity="info" [rounded]="true" />
                }
              </div>
              <p class="step-desc">{{ step.description }}</p>

              @if (step.command) {
                <div class="step-command">
                  <code>{{ step.command }}</code>
                  <button pButton icon="pi pi-copy" class="p-button-sm p-button-text p-button-rounded" pTooltip="Copy" (click)="copyCmd(step.command!)"></button>
                </div>
              }

              @if (!step.done && i === currentStepIndex) {
                <div class="step-actions">
                  @if (step.command) {
                    <button pButton label="Run" icon="pi pi-play" class="p-button-sm" (click)="runStep(i)" [disabled]="step.loading"></button>
                  }
                  <button pButton label="Mark Done" icon="pi pi-check" class="p-button-sm p-button-outlined" (click)="markDone(i)"></button>
                  <button pButton label="Skip" class="p-button-sm p-button-text" (click)="markDone(i)"></button>
                </div>
              }

              @if (step.loading) {
                <div class="step-loading"><i class="pi pi-spin pi-spinner"></i> Running...</div>
              }

              @if (step.output) {
                <div class="step-output">
                  <div class="output-header">
                    <span>Output</span>
                    <button pButton icon="pi pi-copy" class="p-button-sm p-button-text p-button-rounded" (click)="copyCmd(step.output!)"></button>
                  </div>
                  <pre>{{ step.output }}</pre>
                </div>
              }
            </div>
          </div>
        }
      </div>

      <!-- Completion -->
      @if (completedSteps === activeRunbook.steps.length) {
        <div class="completion-card">
          <div class="completion-icon"><i class="pi pi-check-circle"></i></div>
          <h3>Runbook Complete</h3>
          <p>All steps have been executed. Review the outputs above for any follow-up actions.</p>
          <button pButton label="Back to Runbooks" icon="pi pi-arrow-left" class="p-button-outlined p-button-sm" (click)="activeRunbook = null"></button>
        </div>
      }
    }
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

    /* Intro */
    .intro-card {
      display: flex; align-items: center; gap: 16px;
      padding: 20px 24px; margin-bottom: 20px;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
    }
    .intro-icon {
      width: 48px; height: 48px; border-radius: 12px;
      background: var(--accent-subtle); color: var(--accent);
      display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0;
    }
    .intro-text h3 { font-size: 16px; font-weight: 600; margin: 0 0 4px; }
    .intro-text p { font-size: 13px; color: var(--text-secondary); margin: 0; }

    /* Runbook Grid */
    .runbook-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
    .runbook-card {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 20px; cursor: pointer; transition: all 0.15s;
    }
    .runbook-card:hover { border-color: var(--accent); transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.2); }
    .rb-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .rb-icon {
      width: 36px; height: 36px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center; font-size: 16px;
    }
    .rb-name { font-size: 15px; font-weight: 600; margin: 0 0 6px; }
    .rb-desc { font-size: 12px; color: var(--text-secondary); margin: 0 0 14px; line-height: 1.4; }
    .rb-footer { display: flex; gap: 14px; font-size: 11px; color: var(--text-muted); }
    .rb-footer span { display: flex; align-items: center; gap: 4px; }
    .rb-footer i { font-size: 11px; }

    /* Active Header */
    .active-header {
      display: flex; align-items: center; gap: 14px;
      padding: 16px 20px; margin-bottom: 20px;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
    }
    .active-info { display: flex; align-items: center; gap: 12px; flex: 1; }
    .active-icon {
      width: 40px; height: 40px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;
    }
    .active-info h2 { font-size: 16px; font-weight: 700; margin: 0; }
    .active-info p { font-size: 12px; color: var(--text-muted); margin: 2px 0 0; }
    .active-progress { flex-shrink: 0; }
    .progress-ring { position: relative; width: 48px; height: 48px; }
    .progress-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    .ring-bg { fill: none; stroke: var(--bg-elevated); stroke-width: 3; }
    .ring-fill { fill: none; stroke: var(--success); stroke-width: 3; stroke-linecap: round; transition: stroke-dasharray 0.4s; }
    .ring-val {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700;
    }

    /* Steps */
    .steps-list { display: flex; flex-direction: column; gap: 0; }
    .step-card { display: flex; gap: 0; }
    .step-left { display: flex; flex-direction: column; align-items: center; width: 40px; flex-shrink: 0; }
    .step-number {
      width: 28px; height: 28px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700;
      background: var(--bg-elevated); color: var(--text-muted); border: 2px solid var(--border);
      transition: all 0.2s;
    }
    .num-done { background: var(--success); color: #fff; border-color: var(--success); }
    .num-done i { font-size: 12px; }
    .num-active { background: var(--accent); color: #fff; border-color: var(--accent); }
    .step-connector { width: 2px; flex: 1; background: var(--border); min-height: 16px; }
    .conn-done { background: var(--success); }

    .step-body {
      flex: 1; padding: 4px 0 20px 14px;
    }
    .step-top { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .step-title { font-size: 14px; font-weight: 600; }
    .step-desc { font-size: 12px; color: var(--text-secondary); margin: 0 0 10px; line-height: 1.4; }
    .step-done .step-title { color: var(--text-muted); }
    .step-done .step-desc { color: var(--text-muted); }

    .step-command {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 12px; margin-bottom: 10px;
      background: var(--bg-elevated); border-radius: 6px; border: 1px solid var(--border);
    }
    .step-command code { font-family: 'JetBrains Mono', monospace; font-size: 11px; flex: 1; color: var(--accent); }

    .step-actions { display: flex; gap: 6px; margin-bottom: 8px; }
    .step-loading { font-size: 12px; color: var(--text-muted); display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }

    .step-output {
      background: var(--bg-elevated); border-radius: 8px; border: 1px solid var(--border);
      overflow: hidden; margin-top: 8px;
    }
    .output-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 6px 12px; background: var(--bg); border-bottom: 1px solid var(--border);
      font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em;
    }
    .step-output pre {
      font-family: 'JetBrains Mono', monospace; font-size: 11px;
      padding: 10px 12px; margin: 0; white-space: pre-wrap;
      max-height: 150px; overflow-y: auto; color: var(--text-secondary);
    }

    /* Completion */
    .completion-card {
      text-align: center; padding: 40px;
      background: var(--bg-card); border: 1px solid var(--success); border-radius: var(--radius);
      margin-top: 20px;
    }
    .completion-icon { font-size: 36px; color: var(--success); margin-bottom: 12px; }
    .completion-card h3 { font-size: 18px; font-weight: 700; margin: 0 0 8px; }
    .completion-card p { font-size: 13px; color: var(--text-secondary); margin: 0 0 16px; }
  `],
})
export class RunbooksComponent {
  private http = inject(HttpClient);
  activeRunbook: Runbook | null = null;

  get completedSteps() { return this.activeRunbook?.steps.filter(s => s.done).length || 0; }
  get progressPct() { return this.activeRunbook ? Math.round((this.completedSteps / this.activeRunbook.steps.length) * 100) : 0; }
  get currentStepIndex() { return this.activeRunbook?.steps.findIndex(s => !s.done) ?? -1; }

  runbooks: Runbook[] = [
    {
      id: 'pod-crash', name: 'Pod CrashLoopBackOff', description: 'Diagnose and fix a pod stuck in crash loop. Covers log analysis, resource checks, and image verification.',
      icon: 'pi pi-exclamation-triangle', color: '#ef4444', severity: 'Critical', estimatedTime: '5-10 min',
      steps: [
        { title: 'Identify crashing pods', description: 'List all pods not in Running state to find the affected workload.', command: 'kubectl get pods --field-selector=status.phase!=Running', done: false },
        { title: 'Check pod events', description: 'Look for scheduling failures, image pull errors, or OOM kills.', command: 'events', done: false },
        { title: 'View pod logs', description: 'Check the last container output for stack traces or error messages.', command: 'kubectl logs --previous --tail=50', done: false },
        { title: 'Inspect pod details', description: 'Check resource limits, node assignment, and container state.', command: 'pods', done: false },
        { title: 'Check image pull secrets', description: 'Verify registry credentials are present and valid.', done: false },
        { title: 'Run AI diagnosis', description: 'Let the AI engine analyze the pod and suggest root cause.', done: false },
      ],
    },
    {
      id: 'high-cpu', name: 'High CPU Usage', description: 'Investigate CPU spikes across pods and nodes. Identify resource hogs and scaling opportunities.',
      icon: 'pi pi-chart-bar', color: '#eab308', severity: 'High', estimatedTime: '3-5 min',
      steps: [
        { title: 'Check top pods by CPU', description: 'Identify which pods are consuming the most CPU.', command: 'top pods', done: false },
        { title: 'Check node pressure', description: 'See if any nodes are under resource pressure.', command: 'top nodes', done: false },
        { title: 'Review HPA status', description: 'Check if autoscalers are active and at max replicas.', command: 'kubectl get hpa', done: false },
        { title: 'Check resource limits', description: 'Verify CPU requests and limits are properly set.', command: 'kubectl describe nodes | grep -A5 "Allocated"', done: false },
        { title: 'Scale if needed', description: 'Increase replicas or adjust resource limits.', done: false },
      ],
    },
    {
      id: 'deploy-fail', name: 'Failed Deployment', description: 'Rollback a broken deployment and diagnose what went wrong. Covers rollout status and revision history.',
      icon: 'pi pi-send', color: '#3b82f6', severity: 'High', estimatedTime: '3-7 min',
      steps: [
        { title: 'Check rollout status', description: 'See if the deployment is stuck or progressing.', command: 'kubectl rollout status deployment --timeout=10s', done: false },
        { title: 'View recent events', description: 'Look for image pull failures or scheduling issues.', command: 'events', done: false },
        { title: 'Check new pod status', description: 'See if new pods are starting or crashing.', command: 'pods', done: false },
        { title: 'Compare revisions', description: 'Check what changed between the current and previous revision.', command: 'kubectl rollout history deployment', done: false },
        { title: 'Rollback if needed', description: 'Undo the deployment to the last known good revision.', command: 'kubectl rollout undo deployment', done: false },
      ],
    },
    {
      id: 'node-pressure', name: 'Node Pressure', description: 'Diagnose node resource exhaustion — memory pressure, disk pressure, or PID pressure.',
      icon: 'pi pi-server', color: '#a855f7', severity: 'Critical', estimatedTime: '5-10 min',
      steps: [
        { title: 'Check node conditions', description: 'Identify which nodes have pressure conditions.', command: 'kubectl get nodes', done: false },
        { title: 'Check resource usage', description: 'See CPU and memory consumption per node.', command: 'top nodes', done: false },
        { title: 'Find heavy pods', description: 'Identify pods consuming the most resources on affected nodes.', command: 'kubectl top pods --sort-by=memory', done: false },
        { title: 'Check for evictions', description: 'Look for pods that were evicted due to pressure.', command: 'kubectl get events --field-selector reason=Evicted', done: false },
        { title: 'Drain check', description: 'Evaluate if the node can be safely drained for maintenance.', done: false },
      ],
    },
    {
      id: 'network-issue', name: 'Network Connectivity', description: 'Debug DNS resolution, service discovery, and pod-to-pod communication issues.',
      icon: 'pi pi-globe', color: '#22c55e', severity: 'Medium', estimatedTime: '5-8 min',
      steps: [
        { title: 'Check services', description: 'Verify service endpoints are populated.', command: 'kubectl get svc', done: false },
        { title: 'Check endpoints', description: 'Ensure services have backing pod endpoints.', command: 'kubectl get endpoints', done: false },
        { title: 'Test DNS resolution', description: 'Verify internal DNS is resolving service names.', command: 'kubectl get pods -n kube-system -l k8s-app=kube-dns', done: false },
        { title: 'Check network policies', description: 'Look for policies that might be blocking traffic.', command: 'kubectl get networkpolicies', done: false },
        { title: 'Check ingress', description: 'Verify external access routes are configured.', command: 'kubectl get ingress', done: false },
      ],
    },
    {
      id: 'secret-issue', name: 'Secret/Config Issues', description: 'Diagnose missing secrets, expired certificates, or misconfigured ConfigMaps.',
      icon: 'pi pi-lock', color: '#f97316', severity: 'High', estimatedTime: '3-5 min',
      steps: [
        { title: 'Check pull secrets', description: 'Verify image pull secrets exist for all pods.', done: false },
        { title: 'List secrets', description: 'Check what secrets are available in the namespace.', command: 'kubectl get secrets', done: false },
        { title: 'Check mounted secrets', description: 'Verify pods can access their required secrets.', command: 'kubectl get pods -o jsonpath="{.items[*].spec.volumes[*].secret.secretName}"', done: false },
        { title: 'Check ConfigMaps', description: 'Verify ConfigMaps referenced by pods exist.', command: 'kubectl get configmaps', done: false },
      ],
    },
  ];

  selectRunbook(rb: Runbook) {
    this.activeRunbook = { ...rb, steps: rb.steps.map(s => ({ ...s, done: false, output: undefined, loading: false })) };
  }

  runStep(index: number) {
    const step = this.activeRunbook!.steps[index];
    if (!step.command) { this.markDone(index); return; }
    step.loading = true;
    this.http.post<any>('http://localhost:8000/api/exec', { command: step.command }).subscribe({
      next: (res) => { step.output = res.output || '(no output)'; step.done = true; step.loading = false; },
      error: () => { step.output = 'Error executing command'; step.loading = false; },
    });
  }

  markDone(index: number) {
    this.activeRunbook!.steps[index].done = true;
  }

  copyCmd(text: string) {
    navigator.clipboard.writeText(text);
  }
}
