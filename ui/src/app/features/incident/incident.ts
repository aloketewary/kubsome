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
import { SpotlightComponent } from '../../shared/components/spotlight.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { IntelHeaderComponent } from '../../shared/components/futuristic/intel-header.component';


@Component({
  selector: 'app-incident',
  standalone: true,
  imports: [FormsModule, SlicePipe, TagModule, ButtonModule, TooltipModule, InputTextModule, IntelHeaderComponent],
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
  resolvedDuration = '';
  resolvedExportPath = '';
  reportData: any = null;
  history: any[] = [];
  title = '';
  noteText = '';
  severity = 'high';
  elapsedTime = '00:00';
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
  rootCauseCategory = '';
  rootCauseDetail = '';
  resolutionText = '';
  affectedInput = '';
  affectedResources: string[] = [];
  snapshotDiff: { type: string; message: string }[] = [];
  private timerInterval: any;

  severities = [
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ];

  ngOnInit() { this.loadStatus(); this.loadHistory(); }
  ngOnDestroy() { clearInterval(this.timerInterval); }

  loadHistory() {
    this.http.get<any>(`${this.base}/incident/history`).subscribe(res => {
      this.history = res.incidents || [];
    });
  }

  viewHistoryReport(item: any) {
    this.http.get<any>(`${this.base}/incident/report`, { params: { path: item.path } }).subscribe(res => {
      if (!res.error) {
        this.resolved = res;
        this.resolvedExportPath = item.path;
        this.resolvedDuration = this.calcDuration(res);
      }
    });
  }

  loadStatus() {
    this.http.get<any>(`${this.base}/incident/status`).subscribe(res => {
      this.active = res.status === 'no active incident' ? null : res;
      if (this.active) {
        this.startTimer();
        this.affectedResources = this.active.affected || [];
        this.computeSnapshotDiff();
        // Auto-run AI on first load if no cause yet
        if (!this.probableCause) this.runAiAnalysis();
      }
    });
  }

  start() {
    this.http.post<any>(`${this.base}/incident/start`, { title: this.title }).subscribe(() => {
      this.title = '';
      this.loadStatus();
    });
  }

  stop() {
    const rootCause = this.rootCauseCategory
      ? `[${this.rootCauseCategory}] ${this.rootCauseDetail}`.trim()
      : this.rootCauseDetail;
    this.http.post<any>(`${this.base}/incident/stop`, {
      root_cause: rootCause,
      resolution: this.resolutionText,
    }).subscribe(res => {
      this.active = null;
      this.showResolveForm = false;
      clearInterval(this.timerInterval);
      if (res?.incident) {
        this.resolved = res.incident;
        this.resolvedExportPath = res.export_path || '';
        this.resolvedDuration = this.calcDuration(res.incident);
      }
    });
  }

  dismissResolved() {
    this.resolved = null;
    this.resolvedExportPath = '';
    this.resolvedDuration = '';
    this.reportData = null;
  }

  loadReport() {
    if (!this.resolvedExportPath) return;
    this.http.get<any>(`${this.base}/incident/report`, { params: { path: this.resolvedExportPath } }).subscribe(res => {
      if (!res.error) this.reportData = res;
    });
  }

  calcDuration(incident: any): string {
    if (!incident.started || !incident.ended) return '—';
    const ms = new Date(incident.ended).getTime() - new Date(incident.started).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    return `${h}h ${mins % 60}m`;
  }

  addNote() {
    if (!this.noteText.trim()) return;
    this.http.post<any>(`${this.base}/incident/note`, { text: this.noteText }).subscribe(() => {
      this.noteText = '';
      this.loadStatus();
    });
  }

  snapshot() {
    this.http.post<any>(`${this.base}/incident/snapshot`, {}).subscribe(() => {
      this.snapshotTaken = true;
      this.loadStatus();
      setTimeout(() => this.snapshotTaken = false, 3000);
    });
  }

  logAction() {
    if (!this.actionTarget.trim()) return;
    this.http.post<any>(`${this.base}/incident/action`, {
      action: this.actionType,
      target: this.actionTarget,
      result: this.actionResult,
    }).subscribe(() => {
      this.actionTarget = '';
      this.actionResult = '';
      this.showActionInput = false;
      this.loadStatus();
    });
  }

  addAffected() {
    if (!this.affectedInput.trim()) return;
    this.affectedResources.push(this.affectedInput.trim());
    this.http.post<any>(`${this.base}/incident/note`, {
      text: `[affected] ${this.affectedInput.trim()}`
    }).subscribe(() => this.loadStatus());
    this.affectedInput = '';
  }

  removeAffected(res: string) {
    this.affectedResources = this.affectedResources.filter(r => r !== res);
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
    // Status changes
    for (const p of last.pods || []) {
      const prev = (first.pods || []).find((fp: any) => fp.name === p.name);
      if (prev && prev.status !== p.status) {
        diff.push({ type: 'changed', message: `${p.name}: ${prev.status} → ${p.status}` });
      }
    }
    this.snapshotDiff = diff;
  }

  runAiAnalysis() {
    this.analyzing = true;
    this.http.get<any>(`${this.base}/anomalies`).subscribe(res => {
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
    });
  }

  shareIncident() {
    this.sharing = true;
    this.http.post<any>(`${this.base}/incident/share`, {}).subscribe({
      next: (res) => {
        this.sharing = false;
        this.shareMsg = res.success ? '✓ Shared to webhooks' : res.message;
        setTimeout(() => this.shareMsg = '', 4000);
      },
      error: () => { this.sharing = false; },
    });
  }

  private startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    const startTime = this.active?.started_at ? new Date(this.active.started_at).getTime() : Date.now();
    this.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
      const s = (elapsed % 60).toString().padStart(2, '0');
      const h = Math.floor(elapsed / 3600);
      this.elapsedTime = h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
    }, 1000);
  }
}
