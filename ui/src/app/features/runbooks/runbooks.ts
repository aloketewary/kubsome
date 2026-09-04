import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { HoloCardComponent } from '../../shared/components/futuristic/holo-card.component';
import { MetricTileComponent } from '../../shared/components/futuristic/metric-tile.component';
import { StatusBeaconComponent } from '../../shared/components/futuristic/status-beacon.component';
import { CommandBarComponent } from '../../shared/components/futuristic/command-bar.component';
import type { CommandPill } from '../../shared/components/futuristic/command-bar.component';
import { ActionIconComponent } from '../../shared/components/futuristic/action-icon.component';
import { IntelHeaderComponent } from '../../shared/components/futuristic/intel-header.component';

interface RunbookStep {
  title: string;
  description: string;
  command?: string;
  commandTemplate?: string;
  paramName?: string;
  paramValue?: string;
  done: boolean;
  output?: string;
  outputExpanded?: boolean;
  loading?: boolean;
  error?: string;
  exitCode?: number;
  note?: string;
  noteDraft?: string;
  isInfo?: boolean;
  copied?: boolean;
  outputCopied?: boolean;
}
interface Runbook { id: string; name: string; description: string; icon: string; color: string; severity: string; estimatedTime: string; source?: string; steps: RunbookStep[]; }

@Component({
  selector: 'app-runbooks',
  standalone: true,
  imports: [IntelHeaderComponent, FormsModule, TagModule, ButtonModule, TooltipModule, HoloCardComponent, MetricTileComponent, StatusBeaconComponent, CommandBarComponent, ActionIconComponent],
  templateUrl: './runbooks.html',
  styleUrl: './runbooks.scss',
})
export class RunbooksComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  activeRunbook: Runbook | null = null;
  runbooks: Runbook[] = [];
  searchQuery = '';
  filterSeverity = 'all';
  filteredRunbooks: Runbook[] = [];
  recommended: Runbook[] = [];
  runbookElapsed = '00:00';
  statusMessage = 'Choose a playbook to begin guided response.';
  isLoading = true;
  loadError = '';
  private startTime = 0;
  private timerInterval: ReturnType<typeof setInterval> | undefined;

  get completedSteps() { return this.activeRunbook?.steps.filter(s => s.done).length || 0; }
  get progressPct() { return this.activeRunbook ? Math.round((this.completedSteps / this.activeRunbook.steps.length) * 100) : 0; }
  get currentStepIndex() { return this.activeRunbook?.steps.findIndex(s => !s.done) ?? -1; }
  get criticalCount() { return this.runbooks.filter(r => r.severity === 'Critical').length; }
  get highCount() { return this.runbooks.filter(r => r.severity === 'High').length; }
  get currentStepTitle() {
    const step = this.activeRunbook?.steps[this.currentStepIndex];
    return step ? step.title : 'All steps complete';
  }

  get filterPills(): CommandPill[] {
    return [
      { label: 'All', value: 'all', count: this.runbooks.length },
      { label: 'Critical', value: 'Critical', count: this.criticalCount, color: 'red' },
      { label: 'High', value: 'High', count: this.highCount, color: 'amber' },
      { label: 'Medium', value: 'Medium', count: this.runbooks.length - this.criticalCount - this.highCount, color: 'cyan' },
    ];
  }

  onFilterChange(v: string) { this.filterSeverity = v; this.filterRunbooks(); }
  onSearchChange(v: string) { this.searchQuery = v; this.filterRunbooks(); }

  filterRunbooks() {
    let result = this.runbooks;
    if (this.filterSeverity !== 'all') result = result.filter(r => r.severity === this.filterSeverity);
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(r => [r.name, r.id, r.description, r.source].some(value => value?.toLowerCase().includes(q)));
    }
    this.filteredRunbooks = result;
  }

  selectRunbook(rb: Runbook) {
    this.clearTimer();
    this.activeRunbook = { ...rb, steps: rb.steps.map(s => ({ ...s, done: false, output: undefined, loading: false, error: undefined, exitCode: undefined, note: undefined, noteDraft: undefined })) };
    this.startTime = Date.now();
    this.runbookElapsed = '00:00';
    this.statusMessage = `Ready to run ${rb.name}.`;
    this.timerInterval = setInterval(() => {
      const secs = Math.floor((Date.now() - this.startTime) / 1000);
      this.runbookElapsed = `${Math.floor(secs / 60).toString().padStart(2, '0')}:${(secs % 60).toString().padStart(2, '0')}`;
    }, 1000);
    this.autoCompleteInfoSteps();
  }

  leaveRunbook() {
    this.clearTimer();
    this.activeRunbook = null;
    this.statusMessage = 'Choose a playbook to begin guided response.';
  }

  private clearTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = undefined;
    }
  }

  private autoCompleteInfoSteps() {
    if (!this.activeRunbook) return;
    for (const step of this.activeRunbook.steps) {
      if (step.isInfo) step.done = true;
      else break;
    }
  }

  runStep(index: number) {
    if (!this.activeRunbook) return;
    const step = this.activeRunbook.steps[index];
    let cmd = step.command;
    if (!cmd && step.commandTemplate && step.paramValue) cmd = step.commandTemplate.replace(/<(pod|deployment|dep|name|node|service|cj|namespace)>/g, step.paramValue);
    if (!cmd) { this.markDone(index); return; }
    step.loading = true;
    step.error = undefined;
    this.statusMessage = `Running step ${index + 1}: ${step.title}`;
    this.http.post<any>('/api/exec', { command: cmd }).subscribe({
      next: (res) => {
        step.output = res.output || '(no output)';
        step.exitCode = Number(res.exit_code ?? 0);
        step.done = step.exitCode === 0;
        step.loading = false;
        if (step.done) {
          this.statusMessage = `Step ${index + 1} completed successfully.`;
        } else {
          step.error = `Command exited with code ${step.exitCode}. Review output and retry.`;
          this.statusMessage = `Step ${index + 1} failed. Retry or mark it done manually.`;
        }
      },
      error: () => {
        step.output = 'Error executing command';
        step.error = 'Unable to execute command. Check the cluster connection and retry.';
        step.loading = false;
        this.statusMessage = `Step ${index + 1} could not run.`;
      },
    });
  }

  markDone(index: number) {
    if (!this.activeRunbook) return;
    this.activeRunbook.steps[index].done = true;
    this.activeRunbook.steps[index].error = undefined;
    for (let i = index + 1; i < this.activeRunbook.steps.length; i++) {
      if (this.activeRunbook.steps[i].isInfo) this.activeRunbook.steps[i].done = true;
      else break;
    }
    this.statusMessage = `Step ${index + 1} marked complete.`;
  }

  saveStepNote(index: number) {
    if (!this.activeRunbook) return;
    const step = this.activeRunbook.steps[index];
    if (!step.noteDraft?.trim()) return;
    step.note = step.noteDraft.trim();
    step.noteDraft = '';
  }

  linkToIncident() {
    if (!this.activeRunbook) return;
    this.http.post<any>('/api/incident/note', { text: `Runbook: ${this.activeRunbook.name} (${this.completedSteps}/${this.activeRunbook.steps.length} steps, ${this.runbookElapsed})` }).subscribe({
      next: (res) => {
        this.statusMessage = res.added === false ? 'No active incident found.' : 'Runbook linked to active incident.';
        if (res.added !== false) this.leaveRunbook();
      },
      error: () => { this.statusMessage = 'Could not link runbook to incident.'; },
    });
  }

  copyCmd(step: RunbookStep, text: string, isOutput = false) {
    navigator.clipboard.writeText(text);
    if (isOutput) { step.outputCopied = true; setTimeout(() => step.outputCopied = false, 1500); }
    else { step.copied = true; setTimeout(() => step.copied = false, 1500); }
  }

  private extractCommand(step: string): { command?: string; commandTemplate?: string; paramName?: string } {
    const match = step.match(/\[cyan\](.+?)\[\/cyan\]/);
    if (!match) return {};
    const raw = match[1];
    const paramMatch = raw.match(/<(pod|deployment|dep|name|node|service|cj|namespace)>/);
    if (paramMatch) return { commandTemplate: raw, paramName: paramMatch[1] };
    return { command: raw };
  }

  private loadRecommendations() {
    this.http.get<any>('/api/anomalies').subscribe({ next: (res) => {
      const alerts = res.alerts || []; const matched = new Set<string>();
      for (const alert of alerts) { const msg = (alert.message || alert.title || '').toLowerCase(); for (const rb of this.runbooks) { if (matched.has(rb.id)) continue; if (msg.includes(rb.id.toLowerCase()) || rb.name.toLowerCase().split(' ').some((w: string) => w.length > 4 && msg.includes(w))) matched.add(rb.id); } }
      this.recommended = this.runbooks.filter(r => matched.has(r.id)).slice(0, 3);
    } });
  }

  ngOnInit() {
    this.http.get<any>('/api/playbooks').subscribe({
      next: (res) => {
        const icons: Record<string, string> = { CrashLoopBackOff: 'pi pi-exclamation-triangle', ImagePullBackOff: 'pi pi-image', OOMKilled: 'pi pi-database', Pending: 'pi pi-clock', FailedScheduling: 'pi pi-calendar-times', Unhealthy: 'pi pi-heart', restart_spike: 'pi pi-refresh', event_storm: 'pi pi-bolt', DNS: 'pi pi-globe', NetworkPolicy: 'pi pi-shield', HPA: 'pi pi-chart-line', Security: 'pi pi-lock', ResourceExhaustion: 'pi pi-server', RolloutStuck: 'pi pi-send', HighLatency: 'pi pi-stopwatch', CertificateExpiry: 'pi pi-key', PVCPending: 'pi pi-save', NodeNotReady: 'pi pi-desktop', ServiceUnavailable: 'pi pi-times-circle', ConfigMapChange: 'pi pi-file-edit', HighRestarts: 'pi pi-replay', IngressNotWorking: 'pi pi-directions', JobFailing: 'pi pi-briefcase', EtcdSlow: 'pi pi-database', GracefulShutdown: 'pi pi-power-off', RBAC: 'pi pi-users' };
        const colors: Record<string, string> = { CrashLoopBackOff: '#f43f5e', ImagePullBackOff: '#f97316', OOMKilled: '#f43f5e', Pending: '#f59e0b', FailedScheduling: '#f59e0b', Unhealthy: '#f43f5e', restart_spike: '#f97316', event_storm: '#a78bfa', DNS: '#4ade80', NetworkPolicy: '#4ade80', HPA: '#d09c60', Security: '#f43f5e', ResourceExhaustion: '#a78bfa', RolloutStuck: '#d09c60', HighLatency: '#f59e0b', CertificateExpiry: '#f97316', PVCPending: '#f59e0b', NodeNotReady: '#f43f5e', ServiceUnavailable: '#f43f5e', ConfigMapChange: '#d09c60', HighRestarts: '#f97316', IngressNotWorking: '#f59e0b', JobFailing: '#a78bfa', EtcdSlow: '#f43f5e', GracefulShutdown: '#f59e0b', RBAC: '#d09c60' };
        const severities: Record<string, string> = { CrashLoopBackOff: 'Critical', ImagePullBackOff: 'High', OOMKilled: 'Critical', Pending: 'Medium', FailedScheduling: 'High', Unhealthy: 'High', restart_spike: 'High', event_storm: 'Medium', DNS: 'High', NetworkPolicy: 'Medium', HPA: 'Medium', Security: 'High', ResourceExhaustion: 'Critical', RolloutStuck: 'High', HighLatency: 'Medium', CertificateExpiry: 'Critical', PVCPending: 'Medium', NodeNotReady: 'Critical', ServiceUnavailable: 'Critical', ConfigMapChange: 'Medium', HighRestarts: 'High', IngressNotWorking: 'High', JobFailing: 'Medium', EtcdSlow: 'Critical', GracefulShutdown: 'Medium', RBAC: 'Medium' };
        this.runbooks = (res.playbooks || []).map((pb: any) => ({ id: pb.id, name: pb.title, description: `Step-by-step guide for ${pb.title.toLowerCase()}`, icon: icons[pb.id] || 'pi pi-book', color: colors[pb.id] || '#d09c60', severity: severities[pb.id] || 'Medium', estimatedTime: `${pb.steps.length * 2} min`, source: pb.source || 'built-in', steps: pb.steps.map((s: string) => { const extracted = this.extractCommand(s); const cleaned = s.replace(/\[\/?[^\]]+\]/g, '').trim(); const isInfo = !extracted.command && !extracted.commandTemplate && (cleaned.startsWith('•') || cleaned.startsWith('Common') || cleaned.startsWith('If ') || cleaned.startsWith('Note:') || cleaned.length < 20); return { title: cleaned, description: '', command: extracted.command, commandTemplate: extracted.commandTemplate, paramName: extracted.paramName, paramValue: '', done: false, isInfo }; }) }));
        this.filterRunbooks();
        this.isLoading = false;
        this.statusMessage = this.runbooks.length ? 'Choose a playbook to begin guided response.' : 'No runbooks available.';
        this.loadRecommendations();
      },
      error: () => {
        this.isLoading = false;
        this.loadError = 'Runbooks could not be loaded. Check the API connection and retry.';
        this.statusMessage = this.loadError;
      },
    });
  }

  ngOnDestroy() { this.clearTimer(); }
}
