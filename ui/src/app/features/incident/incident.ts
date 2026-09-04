import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { SlicePipe } from '@angular/common';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { ConfirmService } from '../../shared/services/confirm.service';
import { IntelHeaderComponent } from '../../shared/components/futuristic/intel-header.component';
import { StatusBeaconComponent } from '../../shared/components/futuristic/status-beacon.component';

@Component({
  selector: 'app-incident',
  standalone: true,
  imports: [FormsModule, SlicePipe, TagModule, ButtonModule, TooltipModule, InputTextModule, IntelHeaderComponent, StatusBeaconComponent],
  templateUrl: './incident.html',
  styleUrl: './incident.scss',
})
export class IncidentComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private confirmService = inject(ConfirmService);
  router = inject(Router);
  private base = '/api';

  active: any = null;
  resolved: any = null;
  statusLoading = true;
  statusLoaded = false;
  statusError = '';
  historyLoading = true;
  historyError = '';
  reportLoading = false;
  reportError = '';
  mutationError = '';
  startPending = false;
  notePending = false;
  snapshotPending = false;
  actionPending = false;
  affectedPending = false;
  severityPending = false;
  resolvePending = false;
  resolvedDuration = '';
  resolvedExportPath = '';
  reportData: any = null;
  history: any[] = [];
  relatedAlerts: any[] = [];

  // Start form
  title = '';
  commander = '';
  severity = 'high';

  // Active state
  noteText = '';
  elapsedTime = '00:00';
  lastUpdateTime = '';
  snapshotTaken = false;
  analyzing = false;
  sharing = false;
  shareMsg = '';
  probableCause = '';
  blastRadius = '';
  healthScore = 100;
  showActionInput = false;
  showResolveForm = false;
  actionType = 'restart';
  actionTarget = '';
  actionResult = '';

  // Resolve form
  rootCauseCategory = '';
  rootCauseDetail = '';
  resolutionText = '';

  // Affected
  affectedInput = '';
  affectedResources: string[] = [];

  // Severity history
  severityHistory: { time: string; from: string; to: string }[] = [];

  // Snapshot
  snapshotDiff: { type: string; message: string }[] = [];

  private timerInterval: any;

  severities = [
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ];

  get resolveDisabled(): boolean {
    return !this.rootCauseCategory || !this.resolutionText.trim();
  }

  get mttr(): string {
    if (!this.resolved?.started || !this.resolved?.ended) return 'Not available';
    const ms = new Date(this.resolved.ended).getTime() - new Date(this.resolved.started).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    return `${h}h ${mins % 60}m`;
  }

  ngOnInit() { this.loadStatus(); this.loadHistory(); }
  ngOnDestroy() { clearInterval(this.timerInterval); }

  loadHistory() {
    this.historyLoading = true;
    this.historyError = '';
    this.http.get<any>(`${this.base}/incident/history`).subscribe({
      next: (res) => {
        this.history = res.incidents || [];
        this.historyLoading = false;
      },
      error: () => {
        this.historyLoading = false;
        this.historyError = 'Past incidents are unavailable right now.';
      },
    });
  }

  viewHistoryReport(item: any) {
    this.reportLoading = true;
    this.reportError = '';
    this.http.get<any>(`${this.base}/incident/report`, { params: { path: item.path } }).subscribe({
      next: (res) => {
        this.reportLoading = false;
        if (res.error) {
          this.reportError = res.error;
          return;
        }
        this.resolved = res;
        this.resolvedExportPath = item.path;
        this.resolvedDuration = this.calcDuration(res);
      },
      error: () => {
        this.reportLoading = false;
        this.reportError = 'Unable to open this incident report.';
      },
    });
  }

  loadStatus() {
    const initialLoad = !this.statusLoaded;
    this.statusLoading = initialLoad;
    this.statusError = '';
    this.http.get<any>(`${this.base}/incident/status`).subscribe({
      next: (res) => {
        this.statusLoaded = true;
        this.statusLoading = false;
        this.active = res.status === 'no active incident' ? null : res;
        if (this.active) {
          this.severity = this.active.severity || this.severity;
          this.startTimer();
          this.affectedResources = this.active.affected || this.affectedResources;
          this.commander = this.active.commander || this.commander;
          if (this.active.severity_history?.length) {
            this.severityHistory = this.active.severity_history;
          }
          this.computeSnapshotDiff();
          this.loadRelatedAlerts();
        } else {
          clearInterval(this.timerInterval);
        }
      },
      error: () => {
        this.statusLoaded = true;
        this.statusLoading = false;
        if (!this.active) this.statusError = 'Unable to determine incident status. Retry to continue.';
      },
    });
  }

  start() {
    if (!this.title.trim() || this.startPending) return;
    this.startPending = true;
    this.mutationError = '';
    this.http.post<any>(`${this.base}/incident/start`, {
      title: this.title,
      commander: this.commander,
      severity: this.severity,
    }).subscribe({
      next: () => {
        this.startPending = false;
        this.title = '';
        this.loadStatus();
      },
      error: () => {
        this.startPending = false;
        this.mutationError = 'Unable to start incident tracking. Try again.';
      },
    });
  }

  stop() {
    if (this.resolvePending || this.resolveDisabled) return;
    const rootCause = this.rootCauseCategory
      ? `[${this.rootCauseCategory}] ${this.rootCauseDetail}`.trim()
      : this.rootCauseDetail;
    this.confirmService.confirm({
      title: 'Resolve Incident',
      message: 'Resolve this incident and export its final report?',
      confirmLabel: 'Resolve & Export',
      severity: 'warning',
      productionGuard: true,
    }).then(ok => {
      if (!ok) return;
      this.resolvePending = true;
      this.mutationError = '';
      this.http.post<any>(`${this.base}/incident/stop`, {
        root_cause: rootCause,
        resolution: this.resolutionText,
      }).subscribe({
        next: (res) => {
          this.resolvePending = false;
          this.active = null;
          this.showResolveForm = false;
          clearInterval(this.timerInterval);
          if (res?.incident) {
            this.resolved = res.incident;
            this.resolvedExportPath = res.export_path || '';
            this.resolvedDuration = this.calcDuration(res.incident);
          }
          this.loadHistory();
        },
        error: () => {
          this.resolvePending = false;
          this.mutationError = 'Unable to resolve incident. Current tracking remains active.';
        },
      });
    });
  }

  changeSeverity(newSev: string) {
    if (newSev === (this.active?.severity || this.severity) || this.severityPending) return;
    const oldSev = this.active?.severity || this.severity;
    this.severityPending = true;
    this.mutationError = '';
    this.severity = newSev;
    if (this.active) this.active.severity = newSev;
    this.severityHistory.push({ time: new Date().toISOString(), from: oldSev, to: newSev });
    this.http.post<any>(`${this.base}/incident/note`, {
      text: `[severity] Changed from ${oldSev} to ${newSev}`,
    }).subscribe({
      next: () => {
        this.severityPending = false;
        this.loadStatus();
      },
      error: () => {
        this.severityPending = false;
        this.mutationError = 'Severity change was not recorded.';
      },
    });
  }

  dismissResolved() {
    this.resolved = null;
    this.resolvedExportPath = '';
    this.resolvedDuration = '';
    this.reportData = null;
  }

  loadReport() {
    if (!this.resolvedExportPath || this.reportLoading) return;
    this.reportLoading = true;
    this.reportError = '';
    this.http.get<any>(`${this.base}/incident/report`, { params: { path: this.resolvedExportPath } }).subscribe({
      next: (res) => {
        this.reportLoading = false;
        if (res.error) {
          this.reportError = res.error;
          return;
        }
        this.reportData = res;
      },
      error: () => {
        this.reportLoading = false;
        this.reportError = 'Unable to load the full report.';
      },
    });
  }

  calcDuration(incident: any): string {
    if (!incident.started || !incident.ended) return 'Not available';
    const ms = new Date(incident.ended).getTime() - new Date(incident.started).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    return `${h}h ${mins % 60}m`;
  }

  addNote() {
    if (!this.noteText.trim() || this.notePending) return;
    this.notePending = true;
    this.mutationError = '';
    this.http.post<any>(`${this.base}/incident/note`, { text: this.noteText }).subscribe({
      next: () => {
        this.notePending = false;
        this.noteText = '';
        this.lastUpdateTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        this.loadStatus();
      },
      error: () => {
        this.notePending = false;
        this.mutationError = 'Note was not added. Try again.';
      },
    });
  }

  snapshot() {
    if (this.snapshotPending) return;
    this.snapshotPending = true;
    this.mutationError = '';
    this.http.post<any>(`${this.base}/incident/snapshot`, {}).subscribe({
      next: (res) => {
        this.snapshotPending = false;
        if (res?.captured === false) {
          this.mutationError = res.reason || 'Snapshot was not captured.';
          return;
        }
        this.snapshotTaken = true;
        this.lastUpdateTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        this.loadStatus();
        setTimeout(() => this.snapshotTaken = false, 3000);
      },
      error: () => {
        this.snapshotPending = false;
        this.mutationError = 'Snapshot failed. Current incident data is unchanged.';
      },
    });
  }

  logAction() {
    if (!this.actionTarget.trim() || this.actionPending) return;
    this.actionPending = true;
    this.mutationError = '';
    this.http.post<any>(`${this.base}/incident/action`, {
      action: this.actionType,
      target: this.actionTarget,
      result: this.actionResult,
    }).subscribe({
      next: () => {
        this.actionPending = false;
        this.actionTarget = '';
        this.actionResult = '';
        this.showActionInput = false;
        this.lastUpdateTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        this.loadStatus();
      },
      error: () => {
        this.actionPending = false;
        this.mutationError = 'Action was not logged. Try again.';
      },
    });
  }

  addAffected() {
    const resource = this.affectedInput.trim();
    if (!resource || this.affectedPending) return;
    this.affectedPending = true;
    this.mutationError = '';
    this.affectedResources.push(resource);
    this.affectedInput = '';
    this.http.post<any>(`${this.base}/incident/note`, {
      text: `[affected] ${resource}`
    }).subscribe({
      next: () => {
        this.affectedPending = false;
        this.loadStatus();
      },
      error: () => {
        this.affectedPending = false;
        this.affectedResources = this.affectedResources.filter(r => r !== resource);
        this.mutationError = 'Resource was not added to the incident.';
      },
    });
  }

  removeAffected(res: string) {
    this.affectedResources = this.affectedResources.filter(r => r !== res);
  }

  loadRelatedAlerts() {
    this.http.get<any>(`${this.base}/anomalies`).subscribe(res => {
      this.relatedAlerts = (res.alerts || []).slice(0, 5);
    });
  }

  alertStatus(severity: string): 'critical' | 'warning' | 'info' {
    if (severity === 'critical') return 'critical';
    if (severity === 'warning' || severity === 'high') return 'warning';
    return 'info';
  }

  runAiAnalysis() {
    if (this.analyzing) return;
    this.analyzing = true;
    this.mutationError = '';
    this.http.get<any>(`${this.base}/anomalies`).subscribe({
      next: (res) => {
        const alerts = res.alerts || [];
        if (alerts.length > 0) {
          this.probableCause = alerts[0].message;
          this.blastRadius = `${alerts.length} resources affected across the namespace.`;
          this.healthScore = Math.max(20, 100 - (alerts.length * 15));
        } else {
          this.probableCause = 'No clear infrastructure anomalies detected. Investigating application logic.';
          this.blastRadius = 'Limited to selected deployment.';
          this.healthScore = 95;
        }
        this.analyzing = false;
      },
      error: () => {
        this.analyzing = false;
        this.mutationError = 'AI analysis is unavailable. Incident tracking continues normally.';
      },
    });
  }

  shareIncident() {
    if (this.sharing) return;
    this.sharing = true;
    this.mutationError = '';
    this.http.post<any>(`${this.base}/incident/share`, {}).subscribe({
      next: (res) => {
        this.sharing = false;
        this.shareMsg = res.success ? 'Shared' : res.message;
        setTimeout(() => this.shareMsg = '', 4000);
      },
      error: () => {
        this.sharing = false;
        this.mutationError = 'Incident could not be shared.';
      },
    });
  }

  private computeSnapshotDiff() {
    const snaps = this.active?.snapshots || [];
    if (snaps.length < 2) { this.snapshotDiff = []; return; }
    const first = snaps[0];
    const last = snaps[snaps.length - 1];
    const diff: { type: string; message: string }[] = [];
    const firstPods = new Set((first.pods || []).map((p: any) => p.name));
    const lastPods = new Set((last.pods || []).map((p: any) => p.name));
    for (const p of last.pods || []) {
      if (!firstPods.has(p.name)) diff.push({ type: 'added', message: `Pod ${p.name} appeared` });
    }
    for (const p of first.pods || []) {
      if (!lastPods.has(p.name)) diff.push({ type: 'removed', message: `Pod ${p.name} disappeared` });
    }
    for (const p of last.pods || []) {
      const prev = (first.pods || []).find((fp: any) => fp.name === p.name);
      if (prev && prev.status !== p.status) {
        diff.push({ type: 'changed', message: `${p.name}: ${prev.status} → ${p.status}` });
      }
    }
    this.snapshotDiff = diff;
  }

  private startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    const startValue = this.active?.started || this.active?.started_at;
    const startTime = startValue ? new Date(startValue).getTime() : Date.now();
    const updateElapsed = () => {
      const elapsed = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
      const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
      const s = (elapsed % 60).toString().padStart(2, '0');
      const h = Math.floor(elapsed / 3600);
      this.elapsedTime = h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
    };
    updateElapsed();
    this.timerInterval = setInterval(updateElapsed, 1000);
  }
}
