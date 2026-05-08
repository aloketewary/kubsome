import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  selector: 'app-incident',
  standalone: true,
  imports: [FormsModule, TagModule, ButtonModule, InputTextModule],
  template: `
    <div class="page-header">
      <h1>Incident Mode</h1>
      <p class="subtitle">Track, annotate, and export incident timelines</p>
    </div>

    @if (!active) {
      <div class="start-section">
        <input pInputText [(ngModel)]="title" placeholder="Incident title (e.g. API outage)" style="width: 300px;" />
        <button pButton label="Start Incident" icon="pi pi-play" class="p-button-danger" (click)="start()"></button>
      </div>
    } @else {
      <div class="active-card">
        <div class="active-header">
          <p-tag value="ACTIVE" severity="danger" />
          <span class="active-title">{{ active.title }}</span>
          <button pButton label="Stop & Export" icon="pi pi-stop" class="p-button-outlined p-button-sm p-button-danger" (click)="stop()"></button>
        </div>

        <div class="notes-section">
          <h3>Notes ({{ active.notes?.length || 0 }})</h3>
          @for (note of active.notes || []; track $index) {
            <div class="note-item">
              <span class="note-time">{{ note.time }}</span>
              <span class="note-text">{{ note.text }}</span>
            </div>
          }
          <div class="note-input">
            <input pInputText [(ngModel)]="noteText" placeholder="Add observation..." style="flex: 1;" (keyup.enter)="addNote()" />
            <button pButton icon="pi pi-plus" class="p-button-sm" (click)="addNote()" [disabled]="!noteText.trim()"></button>
          </div>
        </div>

        <div class="snapshot-section">
          <button pButton label="Capture Snapshot" icon="pi pi-camera" class="p-button-outlined p-button-sm" (click)="snapshot()"></button>
          <span class="snapshot-hint">Saves current cluster state to incident timeline</span>
        </div>
      </div>
    }
  `,
  styles: [`
    .page-header { margin-bottom: 24px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .start-section { display: flex; gap: 12px; align-items: center; }
    .active-card {
      background: var(--bg-card);
      border: 1px solid var(--danger);
      border-left: 4px solid var(--danger);
      border-radius: var(--radius);
      padding: 24px;
    }
    .active-header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
    .active-title { font-size: 18px; font-weight: 600; flex: 1; }
    .notes-section { margin-bottom: 24px; }
    .notes-section h3 { font-size: 14px; font-weight: 600; margin-bottom: 12px; color: var(--text-secondary); }
    .note-item {
      display: flex;
      gap: 12px;
      padding: 8px 12px;
      border-radius: 6px;
      margin-bottom: 4px;
      background: var(--bg-elevated);
    }
    .note-time { font-size: 11px; color: var(--text-muted); font-family: 'JetBrains Mono', monospace; min-width: 60px; }
    .note-text { font-size: 13px; }
    .note-input { display: flex; gap: 8px; margin-top: 12px; }
    .snapshot-section { display: flex; align-items: center; gap: 12px; }
    .snapshot-hint { font-size: 12px; color: var(--text-muted); }
  `],
})
export class IncidentComponent implements OnInit {
  private http = inject(HttpClient);
  private base = 'http://localhost:8000/api';
  active: any = null;
  title = '';
  noteText = '';

  ngOnInit() { this.loadStatus(); }

  loadStatus() {
    this.http.get<any>(`${this.base}/incident/status`).subscribe(res => {
      this.active = res.status === 'no active incident' ? null : res;
    });
  }

  start() {
    this.http.post<any>(`${this.base}/incident/start`, { title: this.title }).subscribe(() => {
      this.title = '';
      this.loadStatus();
    });
  }

  stop() {
    this.http.post<any>(`${this.base}/incident/stop`, {}).subscribe(() => { this.active = null; });
  }

  addNote() {
    if (!this.noteText.trim()) return;
    this.http.post<any>(`${this.base}/incident/note`, { text: this.noteText }).subscribe(() => {
      this.noteText = '';
      this.loadStatus();
    });
  }

  snapshot() {
    this.http.post<any>(`${this.base}/incident/snapshot`, {}).subscribe();
  }
}
