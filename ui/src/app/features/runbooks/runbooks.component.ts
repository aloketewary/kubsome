import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

interface RunbookStep {
  title: string;
  description: string;
  command?: string;
  commandTemplate?: string;
  paramName?: string;
  paramValue?: string;
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

              @if (step.command || step.commandTemplate) {
                <div class="step-command">
                  <code>{{ step.commandTemplate || step.command }}</code>
                  <button pButton icon="pi pi-copy" class="p-button-sm p-button-text p-button-rounded" pTooltip="Copy" (click)="copyCmd(step.command || step.commandTemplate!)"></button>
                </div>
              }

              @if (step.paramName && !step.done && i === currentStepIndex) {
                <div class="step-param">
                  <label>{{ step.paramName }}:</label>
                  <input [(ngModel)]="step.paramValue" [placeholder]="'Enter ' + step.paramName + '...'" (keyup.enter)="runStep(i)" />
                </div>
              }

              @if (!step.done && i === currentStepIndex) {
                <div class="step-actions">
                  @if (step.command || step.commandTemplate) {
                    <button pButton label="Run" icon="pi pi-play" class="p-button-sm" (click)="runStep(i)" [disabled]="step.loading || (!!step.paramName && !step.paramValue)"></button>
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
    .step-param {
      display: flex; align-items: center; gap: 8px;
      margin-bottom: 10px;
    }
    .step-param label {
      font-size: 11px; font-weight: 600; color: var(--text-muted);
      text-transform: uppercase; letter-spacing: 0.03em; white-space: nowrap;
    }
    .step-param input {
      flex: 1; padding: 8px 12px;
      background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 6px;
      color: var(--text); font-size: 12px; font-family: 'JetBrains Mono', monospace;
      outline: none; transition: border-color 0.2s;
    }
    .step-param input:focus { border-color: var(--accent); }
    .step-param input::placeholder { color: var(--text-muted); }
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
export class RunbooksComponent implements OnInit {
  private http = inject(HttpClient);
  activeRunbook: Runbook | null = null;
  apiPlaybooks: any[] = [];

  get completedSteps() { return this.activeRunbook?.steps.filter(s => s.done).length || 0; }
  get progressPct() { return this.activeRunbook ? Math.round((this.completedSteps / this.activeRunbook.steps.length) * 100) : 0; }
  get currentStepIndex() { return this.activeRunbook?.steps.findIndex(s => !s.done) ?? -1; }

  ngOnInit() {
    this.http.get<any>('http://localhost:8000/api/playbooks').subscribe({
      next: (res) => {
        const icons: Record<string, string> = {
          CrashLoopBackOff: 'pi pi-exclamation-triangle',
          ImagePullBackOff: 'pi pi-image',
          OOMKilled: 'pi pi-database',
          Pending: 'pi pi-clock',
          FailedScheduling: 'pi pi-calendar-times',
          Unhealthy: 'pi pi-heart',
          restart_spike: 'pi pi-refresh',
          event_storm: 'pi pi-bolt',
          DNS: 'pi pi-globe',
          NetworkPolicy: 'pi pi-shield',
          HPA: 'pi pi-chart-line',
          Security: 'pi pi-lock',
          ResourceExhaustion: 'pi pi-server',
          RolloutStuck: 'pi pi-send',
          HighLatency: 'pi pi-stopwatch',
          CertificateExpiry: 'pi pi-key',
          PVCPending: 'pi pi-save',
          NodeNotReady: 'pi pi-desktop',
          ServiceUnavailable: 'pi pi-times-circle',
          ConfigMapChange: 'pi pi-file-edit',
          HighRestarts: 'pi pi-replay',
          IngressNotWorking: 'pi pi-directions',
          JobFailing: 'pi pi-briefcase',
          EtcdSlow: 'pi pi-database',
          GracefulShutdown: 'pi pi-power-off',
          RBAC: 'pi pi-users',
          FailedToRetrieveImagePullSecret: 'pi pi-key',
          FailedGetScale: 'pi pi-chart-line',
        };
        const colors: Record<string, string> = {
          CrashLoopBackOff: '#ef4444', ImagePullBackOff: '#f97316', OOMKilled: '#ef4444',
          Pending: '#eab308', FailedScheduling: '#eab308', Unhealthy: '#ef4444',
          restart_spike: '#f97316', event_storm: '#a855f7', DNS: '#22c55e',
          NetworkPolicy: '#22c55e', HPA: '#3b82f6', Security: '#ef4444',
          ResourceExhaustion: '#a855f7', RolloutStuck: '#3b82f6', HighLatency: '#eab308',
          CertificateExpiry: '#f97316', PVCPending: '#eab308', NodeNotReady: '#ef4444',
          ServiceUnavailable: '#ef4444', ConfigMapChange: '#3b82f6', HighRestarts: '#f97316',
          IngressNotWorking: '#eab308', JobFailing: '#a855f7', EtcdSlow: '#ef4444',
          GracefulShutdown: '#eab308', RBAC: '#3b82f6',
          FailedToRetrieveImagePullSecret: '#f97316', FailedGetScale: '#a855f7',
        };
        const severities: Record<string, string> = {
          CrashLoopBackOff: 'Critical', ImagePullBackOff: 'High', OOMKilled: 'Critical',
          Pending: 'Medium', FailedScheduling: 'High', Unhealthy: 'High',
          restart_spike: 'High', event_storm: 'Medium', DNS: 'High',
          NetworkPolicy: 'Medium', HPA: 'Medium', Security: 'High',
          ResourceExhaustion: 'Critical', RolloutStuck: 'High', HighLatency: 'Medium',
          CertificateExpiry: 'Critical', PVCPending: 'Medium', NodeNotReady: 'Critical',
          ServiceUnavailable: 'Critical', ConfigMapChange: 'Medium', HighRestarts: 'High',
          IngressNotWorking: 'High', JobFailing: 'Medium', EtcdSlow: 'Critical',
          GracefulShutdown: 'Medium', RBAC: 'Medium',
          FailedToRetrieveImagePullSecret: 'High', FailedGetScale: 'High',
        };
        this.runbooks = (res.playbooks || []).map((pb: any) => ({
          id: pb.id,
          name: pb.title,
          description: `Step-by-step guide for ${pb.title.toLowerCase()}`,
          icon: icons[pb.id] || 'pi pi-book',
          color: colors[pb.id] || '#3b82f6',
          severity: severities[pb.id] || 'Medium',
          estimatedTime: `${pb.steps.length * 2} min`,
          steps: pb.steps.map((s: string) => {
            const extracted = this.extractCommand(s);
            return {
              title: s.replace(/\[\/?[^\]]+\]/g, '').trim(),
              description: '',
              command: extracted.command,
              commandTemplate: extracted.commandTemplate,
              paramName: extracted.paramName,
              paramValue: '',
              done: false,
            };
          }),
        }));
      },
      error: () => {},
    });
  }

  private extractCommand(step: string): { command?: string; commandTemplate?: string; paramName?: string } {
    const match = step.match(/\[cyan\](.+?)\[\/cyan\]/);
    if (!match) return {};
    const raw = match[1];
    // Detect placeholders like <pod>, <deployment>, <dep>, <name>, <node>
    const paramMatch = raw.match(/<(pod|deployment|dep|name|node|service|cj|namespace)>/);
    if (paramMatch) {
      return { commandTemplate: raw, paramName: paramMatch[1] };
    }
    return { command: raw };
  }

  runbooks: Runbook[] = [];

  selectRunbook(rb: Runbook) {
    this.activeRunbook = { ...rb, steps: rb.steps.map(s => ({ ...s, done: false, output: undefined, loading: false })) };
  }

  runStep(index: number) {
    const step = this.activeRunbook!.steps[index];
    let cmd = step.command;

    // Resolve parameterized command
    if (!cmd && step.commandTemplate && step.paramValue) {
      cmd = step.commandTemplate.replace(/<(pod|deployment|dep|name|node|service|cj|namespace)>/g, step.paramValue);
    }

    if (!cmd) { this.markDone(index); return; }
    step.loading = true;
    this.http.post<any>('http://localhost:8000/api/exec', { command: cmd }).subscribe({
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
