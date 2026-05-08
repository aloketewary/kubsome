import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  selector: 'app-incident',
  standalone: true,
  imports: [FormsModule, TagModule, ButtonModule, TooltipModule, InputTextModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Incident</h1>
        <p class="subtitle">Track and document production issues</p>
      </div>
    </div>

    <!-- No Active Incident -->
    @if (!active) {
      <div class="start-container">
        <div class="start-hero">
          <div class="start-icon"><i class="pi pi-exclamation-circle"></i></div>
          <h2>Start Incident Tracking</h2>
          <p>Begin recording a timeline of observations, snapshots, and actions during an incident.</p>
        </div>

        <div class="start-form">
          <div class="form-field">
            <label>Incident Title</label>
            <input pInputText [(ngModel)]="title" placeholder="e.g. Payment API 5xx spike" />
          </div>
          <div class="form-field">
            <label>Severity</label>
            <div class="severity-options">
              @for (sev of severities; track sev.value) {
                <button class="sev-btn" [class.active]="severity === sev.value" [class]="'sev-' + sev.value" (click)="severity = sev.value">
                  {{ sev.label }}
                </button>
              }
            </div>
          </div>
          <button pButton label="Start Incident" icon="pi pi-play" class="p-button-danger start-btn" (click)="start()" [disabled]="!title.trim()"></button>
        </div>
      </div>
    }

    <!-- Active Incident -->
    @if (active) {
      <!-- Urgency Banner -->
      <div class="incident-banner">
        <div class="banner-pulse"></div>
        <div class="banner-content">
          <div class="banner-left">
            <p-tag value="ACTIVE INCIDENT" severity="danger" />
            <span class="banner-title">{{ active.title }}</span>
          </div>
          <div class="banner-right">
            <div class="elapsed">
              <i class="pi pi-clock"></i>
              <span>{{ elapsedTime }}</span>
            </div>
            <button pButton label="Resolve" icon="pi pi-check" class="p-button-sm p-button-outlined" (click)="stop()"></button>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="quick-actions">
        <button pButton icon="pi pi-camera" label="Snapshot" class="p-button-sm p-button-outlined" (click)="snapshot()" pTooltip="Capture cluster state"></button>
        <button pButton icon="pi pi-box" label="Check Pods" class="p-button-sm p-button-outlined" (click)="router.navigate(['/pods'])"></button>
        <button pButton icon="pi pi-bolt" label="Events" class="p-button-sm p-button-outlined" (click)="router.navigate(['/events'])"></button>
        <button pButton icon="pi pi-sparkles" label="AI Diagnose" class="p-button-sm p-button-outlined" (click)="router.navigate(['/ai'])"></button>
        @if (snapshotTaken) {
          <span class="snapshot-feedback"><i class="pi pi-check"></i> Snapshot captured</span>
        }
      </div>

      <!-- Notes Timeline -->
      <div class="notes-section">
        <div class="notes-header">
          <h3>Timeline</h3>
          <span class="notes-count">{{ (active.notes || []).length }} entries</span>
        </div>

        <!-- Add Note -->
        <div class="note-input">
          <div class="note-input-dot"></div>
          <input pInputText [(ngModel)]="noteText" placeholder="What's happening now..." (keyup.enter)="addNote()" />
          <button pButton icon="pi pi-plus" class="p-button-sm" (click)="addNote()" [disabled]="!noteText.trim()"></button>
        </div>

        <!-- Notes List -->
        <div class="notes-timeline">
          @for (note of (active.notes || []).slice().reverse(); track $index) {
            <div class="tl-entry">
              <div class="tl-marker">
                <div class="tl-dot"></div>
                @if ($index < (active.notes || []).length - 1) {
                  <div class="tl-line"></div>
                }
              </div>
              <div class="tl-content">
                <span class="tl-time">{{ note.time }}</span>
                <span class="tl-text">{{ note.text }}</span>
              </div>
            </div>
          }
          @if ((active.notes || []).length === 0) {
            <div class="notes-empty">
              <i class="pi pi-pencil"></i>
              <span>No notes yet — add observations as you investigate</span>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

    /* Start State */
    .start-container {
      max-width: 480px; margin: 0 auto;
    }
    .start-hero {
      text-align: center; margin-bottom: 28px;
    }
    .start-icon {
      width: 56px; height: 56px; border-radius: 50%; margin: 0 auto 16px;
      background: var(--danger-subtle); color: var(--danger);
      display: flex; align-items: center; justify-content: center; font-size: 24px;
    }
    .start-hero h2 { font-size: 20px; font-weight: 700; margin: 0 0 8px; }
    .start-hero p { font-size: 13px; color: var(--text-secondary); margin: 0; line-height: 1.5; }

    .start-form {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 24px;
    }
    .form-field { margin-bottom: 16px; }
    .form-field label { display: block; font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px; }
    .form-field input { width: 100%; }
    .severity-options { display: flex; gap: 6px; }
    .sev-btn {
      padding: 6px 14px; border-radius: 6px; border: 1px solid var(--border);
      background: var(--bg-elevated); color: var(--text-muted); font-size: 12px;
      cursor: pointer; transition: all 0.12s;
    }
    .sev-btn:hover { border-color: var(--border-hover); color: var(--text); }
    .sev-btn.active.sev-critical { border-color: var(--danger); background: var(--danger-subtle); color: var(--danger); }
    .sev-btn.active.sev-high { border-color: var(--warning); background: var(--warning-subtle); color: var(--warning); }
    .sev-btn.active.sev-medium { border-color: var(--accent); background: var(--accent-subtle); color: var(--accent); }
    .sev-btn.active.sev-low { border-color: var(--success); background: var(--success-subtle); color: var(--success); }
    .start-btn { width: 100%; margin-top: 8px; }

    /* Active Banner */
    .incident-banner {
      position: relative; overflow: hidden;
      padding: 16px 20px; margin-bottom: 16px;
      background: linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.03));
      border: 1px solid var(--danger); border-radius: var(--radius);
    }
    .banner-pulse {
      position: absolute; top: 0; left: 0; right: 0; height: 2px;
      background: var(--danger); animation: pulseBanner 2s ease-in-out infinite;
    }
    @keyframes pulseBanner { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
    .banner-content { display: flex; align-items: center; justify-content: space-between; }
    .banner-left { display: flex; align-items: center; gap: 12px; }
    .banner-title { font-size: 16px; font-weight: 600; }
    .banner-right { display: flex; align-items: center; gap: 12px; }
    .elapsed { display: flex; align-items: center; gap: 6px; font-size: 13px; font-family: 'JetBrains Mono', monospace; color: var(--text-secondary); }
    .elapsed i { font-size: 12px; }

    /* Quick Actions */
    .quick-actions {
      display: flex; gap: 8px; align-items: center; margin-bottom: 20px; flex-wrap: wrap;
    }
    .snapshot-feedback {
      font-size: 12px; color: var(--success); display: flex; align-items: center; gap: 4px;
      animation: fadeIn 0.3s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    /* Notes */
    .notes-section {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px;
    }
    .notes-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .notes-header h3 { font-size: 15px; font-weight: 600; margin: 0; }
    .notes-count { font-size: 11px; color: var(--text-muted); background: var(--bg-elevated); padding: 2px 8px; border-radius: 10px; }

    .note-input {
      display: flex; align-items: center; gap: 10px; margin-bottom: 20px;
      padding-bottom: 16px; border-bottom: 1px solid var(--border);
    }
    .note-input-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--accent); flex-shrink: 0; }
    .note-input input { flex: 1; }

    .notes-timeline { padding-left: 4px; }
    .tl-entry { display: flex; gap: 12px; }
    .tl-marker { display: flex; flex-direction: column; align-items: center; }
    .tl-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--text-muted); margin-top: 5px; flex-shrink: 0; }
    .tl-line { width: 2px; flex: 1; background: var(--border); min-height: 16px; }
    .tl-content { flex: 1; padding-bottom: 14px; }
    .tl-time { display: block; font-size: 10px; color: var(--text-muted); font-family: 'JetBrains Mono', monospace; margin-bottom: 2px; }
    .tl-text { font-size: 13px; }

    .notes-empty {
      display: flex; align-items: center; gap: 8px; padding: 24px;
      color: var(--text-muted); font-size: 13px; justify-content: center;
    }
    .notes-empty i { font-size: 14px; opacity: 0.5; }
  `],
})
export class IncidentComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  router = inject(Router);
  private base = 'http://localhost:8000/api';
  active: any = null;
  title = '';
  noteText = '';
  severity = 'high';
  elapsedTime = '00:00';
  snapshotTaken = false;
  private timerInterval: any;

  severities = [
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ];

  ngOnInit() { this.loadStatus(); }
  ngOnDestroy() { clearInterval(this.timerInterval); }

  loadStatus() {
    this.http.get<any>(`${this.base}/incident/status`).subscribe(res => {
      this.active = res.status === 'no active incident' ? null : res;
      if (this.active) this.startTimer();
    });
  }

  start() {
    this.http.post<any>(`${this.base}/incident/start`, { title: this.title }).subscribe(() => {
      this.title = '';
      this.loadStatus();
    });
  }

  stop() {
    if (confirm('Resolve this incident? Timeline will be exported.')) {
      this.http.post<any>(`${this.base}/incident/stop`, {}).subscribe(() => {
        this.active = null;
        clearInterval(this.timerInterval);
      });
    }
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
      setTimeout(() => this.snapshotTaken = false, 3000);
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
