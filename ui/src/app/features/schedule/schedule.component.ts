import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-schedule',
  standalone: true,
  imports: [FormsModule, ButtonModule, TagModule, TooltipModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Schedules</h1>
        <p class="subtitle">Recurring command sequences (cron-like)</p>
      </div>
      <button pButton icon="pi pi-plus" label="New Schedule" class="p-button-sm" (click)="showForm = !showForm"></button>
    </div>

    <!-- Add Form -->
    @if (showForm) {
      <div class="add-form">
        <div class="form-row">
          <div class="form-field">
            <label>Name</label>
            <input [(ngModel)]="newName" placeholder="daily-health" />
          </div>
          <div class="form-field">
            <label>Cron Expression</label>
            <input [(ngModel)]="newCron" placeholder="0 8 * * *" />
            <span class="field-hint">min hour dom month dow</span>
          </div>
          <div class="form-field flex-2">
            <label>Commands (comma-separated)</label>
            <input [(ngModel)]="newCommands" placeholder="scorecard, export, alerts" />
          </div>
          <button pButton icon="pi pi-check" label="Add" class="p-button-sm add-btn" (click)="addSchedule()" [disabled]="!newName.trim() || !newCron.trim() || !newCommands.trim()"></button>
        </div>
        <div class="cron-presets">
          <span class="preset-label">Presets:</span>
          @for (preset of presets; track preset.label) {
            <button class="preset-btn" (click)="newCron = preset.cron" [pTooltip]="preset.cron">{{ preset.label }}</button>
          }
        </div>
      </div>
    }

    <!-- Schedule List -->
    @if (schedules.length > 0) {
      <div class="schedule-list">
        @for (s of schedules; track s.name) {
          <div class="schedule-card">
            <div class="sc-left">
              <div class="sc-icon"><i class="pi pi-clock"></i></div>
            </div>
            <div class="sc-body">
              <div class="sc-top">
                <span class="sc-name">{{ s.name }}</span>
                <code class="sc-cron">{{ s.cron }}</code>
                <p-tag [value]="s.next_run" severity="info" [rounded]="true" />
              </div>
              <div class="sc-commands">
                @for (cmd of s.commands; track cmd) {
                  <span class="sc-cmd">{{ cmd }}</span>
                }
              </div>
              <div class="sc-meta">
                <span>Last run: {{ s.last_run ? s.last_run.slice(0, 16) : 'never' }}</span>
                @if (s.notify) { <span class="sc-notify"><i class="pi pi-bell"></i> Notify</span> }
              </div>
            </div>
            <button pButton icon="pi pi-trash" class="p-button-sm p-button-text p-button-danger" (click)="removeSchedule(s.name)" pTooltip="Remove"></button>
          </div>
        }
      </div>
    }

    @if (schedules.length === 0 && !showForm) {
      <div class="empty-state">
        <div class="empty-icon"><i class="pi pi-clock"></i></div>
        <h3>No schedules</h3>
        <p>Create recurring command sequences to automate health checks, reports, and alerts.</p>
        <button pButton icon="pi pi-plus" label="Create Schedule" class="p-button-sm p-button-outlined" (click)="showForm = true"></button>
      </div>
    }
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

    .add-form {
      padding: 20px; margin-bottom: 20px;
      background: var(--bg-card); border: 1px solid var(--accent); border-radius: var(--radius);
      animation: fadeIn 0.2s ease;
    }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
    .form-row { display: flex; gap: 12px; align-items: flex-end; }
    .form-field { display: flex; flex-direction: column; gap: 4px; }
    .form-field.flex-2 { flex: 2; }
    .form-field label { font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .form-field input {
      padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px;
      background: var(--bg-elevated); color: var(--text); font-size: 12px; outline: none;
      font-family: 'JetBrains Mono', monospace;
    }
    .form-field input:focus { border-color: var(--accent); }
    .field-hint { font-size: 9px; color: var(--text-muted); }
    .add-btn { align-self: flex-end; }

    .cron-presets { display: flex; align-items: center; gap: 6px; margin-top: 12px; }
    .preset-label { font-size: 10px; color: var(--text-muted); font-weight: 600; }
    .preset-btn {
      padding: 4px 10px; border-radius: 4px; border: 1px solid var(--border);
      background: var(--bg-elevated); color: var(--text-secondary); font-size: 10px;
      cursor: pointer; transition: all 0.15s;
    }
    .preset-btn:hover { border-color: var(--accent); color: var(--accent); }

    .schedule-list { display: flex; flex-direction: column; gap: 8px; }
    .schedule-card {
      display: flex; align-items: flex-start; gap: 14px;
      padding: 16px 20px; background: var(--bg-card);
      border: 1px solid var(--border); border-radius: var(--radius);
      transition: all 0.2s;
    }
    .schedule-card:hover { border-color: var(--border-hover); }
    .sc-left { flex-shrink: 0; }
    .sc-icon {
      width: 36px; height: 36px; border-radius: 10px;
      background: var(--accent-subtle); color: var(--accent);
      display: flex; align-items: center; justify-content: center; font-size: 16px;
    }
    .sc-body { flex: 1; }
    .sc-top { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
    .sc-name { font-size: 14px; font-weight: 600; }
    .sc-cron { font-size: 11px; font-family: 'JetBrains Mono', monospace; color: var(--text-muted); background: var(--bg-elevated); padding: 2px 8px; border-radius: 4px; }
    .sc-commands { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 6px; }
    .sc-cmd {
      font-size: 11px; padding: 3px 8px; border-radius: 4px;
      background: var(--bg-elevated); color: var(--accent);
      font-family: 'JetBrains Mono', monospace;
    }
    .sc-meta { display: flex; gap: 12px; font-size: 10px; color: var(--text-muted); }
    .sc-notify { display: flex; align-items: center; gap: 3px; color: var(--warning); }
    .sc-notify i { font-size: 10px; }

    .empty-state {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      padding: 60px; color: var(--text-muted);
    }
    .empty-icon {
      width: 56px; height: 56px; border-radius: 50%;
      background: var(--bg-elevated); display: flex; align-items: center; justify-content: center; font-size: 24px;
    }
    .empty-state h3 { font-size: 16px; font-weight: 600; color: var(--text); margin: 0; }
    .empty-state p { font-size: 13px; margin: 0; max-width: 400px; text-align: center; }
  `],
})
export class ScheduleComponent implements OnInit {
  private http = inject(HttpClient);
  schedules: any[] = [];
  showForm = false;
  newName = '';
  newCron = '';
  newCommands = '';

  presets = [
    { label: 'Every 30min', cron: '*/30 * * * *' },
    { label: 'Hourly', cron: '0 * * * *' },
    { label: 'Daily 8am', cron: '0 8 * * *' },
    { label: 'Every 6h', cron: '0 */6 * * *' },
    { label: 'Weekdays 9am', cron: '0 9 * * 1-5' },
  ];

  ngOnInit() { this.load(); }

  load() {
    this.http.get<any>('/api/schedules').subscribe({
      next: (res) => { this.schedules = res.schedules || []; },
      error: () => {},
    });
  }

  addSchedule() {
    const commands = this.newCommands.split(',').map(c => c.trim()).filter(Boolean);
    this.http.post<any>('/api/schedules', {
      name: this.newName.trim(),
      cron: this.newCron.trim(),
      commands,
      notify: true,
    }).subscribe({
      next: () => {
        this.newName = '';
        this.newCron = '';
        this.newCommands = '';
        this.showForm = false;
        this.load();
      },
    });
  }

  removeSchedule(name: string) {
    this.http.delete<any>(`/api/schedules/${name}`).subscribe({
      next: () => this.load(),
    });
  }
}
