import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-jobs',
  standalone: true,
  imports: [TagModule, ButtonModule, TooltipModule],
  template: `
    <div class="page-header">
      <h1>CronJobs & Jobs</h1>
      <p class="subtitle">Scheduled and running jobs</p>
    </div>

    <h3 class="section-title">CronJobs</h3>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Schedule</th><th>Last Run</th><th>Actions</th></tr></thead>
        <tbody>
          @for (cj of cronjobs; track $index) {
            <tr>
              <td><code class="mono">{{ cj.name }}</code></td>
              <td><code class="mono">{{ cj.schedule }}</code></td>
              <td>{{ cj.last_schedule || '—' }}</td>
              <td><button pButton icon="pi pi-play" class="p-button-text p-button-sm" pTooltip="Trigger now" (click)="trigger(cj.name)"></button></td>
            </tr>
          }
          @if (cronjobs.length === 0) { <tr><td colspan="4" class="empty">No cronjobs</td></tr> }
        </tbody>
      </table>
    </div>

    <h3 class="section-title" style="margin-top: 24px;">Jobs</h3>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Status</th><th>Duration</th></tr></thead>
        <tbody>
          @for (j of jobs; track $index) {
            <tr>
              <td><code class="mono">{{ j.name }}</code></td>
              <td><p-tag [value]="j.status" [severity]="j.status === 'Complete' ? 'success' : j.status === 'Failed' ? 'danger' : 'info'" /></td>
              <td>{{ j.duration || '—' }}</td>
            </tr>
          }
          @if (jobs.length === 0) { <tr><td colspan="3" class="empty">No jobs</td></tr> }
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .page-header { margin-bottom: 24px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .section-title { font-size: 14px; font-weight: 600; color: var(--text-secondary); margin-bottom: 12px; }
    .table-wrap { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 12px 16px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); border-bottom: 1px solid var(--border); background: var(--bg-elevated); }
    td { padding: 10px 16px; border-bottom: 1px solid var(--border); }
    tr:hover td { background: var(--bg-hover); }
    .empty { text-align: center; padding: 24px; color: var(--text-muted); }
  `],
})
export class JobsComponent implements OnInit {
  private http = inject(HttpClient);
  cronjobs: any[] = [];
  jobs: any[] = [];

  ngOnInit() {
    this.http.get<any>('http://localhost:8000/api/cronjobs').subscribe(r => this.cronjobs = r.cronjobs || []);
    this.http.get<any>('http://localhost:8000/api/jobs').subscribe(r => this.jobs = r.jobs || []);
  }

  trigger(name: string) {
    this.http.post<any>(`http://localhost:8000/api/trigger/${name}`, {}).subscribe();
  }
}
