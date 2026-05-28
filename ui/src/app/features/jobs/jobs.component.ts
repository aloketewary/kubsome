import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { SpotlightComponent } from '../../shared/components/spotlight.component';

@Component({
  selector: 'app-jobs',
  standalone: true,
  imports: [FormsModule, TagModule, ButtonModule, TooltipModule, SpotlightComponent],
  template: `
    <app-spotlight id="jobs" title="Jobs & CronJobs" icon="pi pi-clock"
      description="View and manage Jobs and CronJobs. Trigger manual runs."
      [capabilities]="['CronJob scheduling', 'Manual trigger', 'Completion status']" [compact]="true" />

        <div class="page-header">
      <div>
        <h1>Jobs</h1>
        <p class="subtitle">Scheduled tasks and batch workloads · {{ lastUpdated }}</p>
      </div>
      <div class="header-actions">
        <div class="search-wrap">
          <i class="pi pi-search"></i>
          <input type="text" [(ngModel)]="searchQuery" placeholder="Filter..." (ngModelChange)="applyFilter()" />
        </div>
        <button class="ar-btn" [class.ar-active]="autoRefresh" (click)="toggleAutoRefresh()" [pTooltip]="autoRefresh ? 'Auto-refresh on (30s)' : 'Auto-refresh off'">
          <i class="pi" [class.pi-sync]="autoRefresh" [class.pi-pause]="!autoRefresh"></i>
        </button>
        <button pButton icon="pi pi-refresh" class="p-button-outlined p-button-sm p-button-rounded" (click)="load()" pTooltip="Refresh" [loading]="loading"></button>
      </div>
    </div>

    <!-- Summary -->
    <div class="summary-strip">
      <div class="summary-pill">
        <i class="pi pi-history"></i>
        <span class="pill-val">{{ cronjobs.length }}</span>
        <span class="pill-label">CronJobs</span>
      </div>
      <div class="summary-pill">
        <i class="pi pi-clock"></i>
        <span class="pill-val">{{ jobs.length }}</span>
        <span class="pill-label">Jobs</span>
      </div>
      @if (completedCount > 0) {
        <div class="summary-pill pill-ok">
          <span class="pill-dot dot-ok"></span>
          <span class="pill-val">{{ completedCount }}</span>
          <span class="pill-label">Complete</span>
        </div>
      }
      @if (failedCount > 0) {
        <div class="summary-pill pill-bad">
          <span class="pill-dot dot-bad"></span>
          <span class="pill-val">{{ failedCount }}</span>
          <span class="pill-label">Failed</span>
        </div>
      }
      @if (runningCount > 0) {
        <div class="summary-pill pill-active">
          <span class="pill-dot dot-active"></span>
          <span class="pill-val">{{ runningCount }}</span>
          <span class="pill-label">Running</span>
        </div>
      }
    </div>

    <!-- CronJobs -->
    <div class="section">
      <div class="section-header">
        <h3><i class="pi pi-history"></i> CronJobs</h3>
        <span class="section-count">{{ cronjobs.length }}</span>
      </div>

      @if (cronjobs.length > 0) {
        <div class="cj-grid">
          @for (cj of cronjobs; track $index) {
            <div class="cj-card">
              <div class="cj-top">
                <code class="cj-name">{{ cj.name }}</code>
                <button pButton icon="pi pi-play" class="p-button-sm p-button-rounded p-button-outlined" pTooltip="Trigger now" (click)="trigger(cj)"></button>
              </div>
              <div class="cj-schedule">
                <i class="pi pi-clock"></i>
                <code>{{ cj.schedule }}</code>
                <span class="cj-human">{{ humanSchedule(cj.schedule) }}</span>
              </div>
              @if (cj.last_schedule) {
                <div class="cj-last">
                  <span class="cj-last-label">Last run:</span>
                  <span class="cj-last-time">{{ cj.last_schedule }}</span>
                </div>
              }
              @if (cj.triggered) {
                <div class="cj-triggered"><i class="pi pi-check"></i> Triggered</div>
              }
            </div>
          }
        </div>
      } @else {
        <div class="empty-state"><i class="pi pi-history"></i> No cronjobs configured</div>
      }
    </div>

    <!-- Jobs -->
    <div class="section">
      <div class="section-header">
        <h3><i class="pi pi-clock"></i> Jobs</h3>
        <span class="section-count">{{ jobs.length }}</span>
      </div>

      @if (sortedJobs.length > 0) {
        <div class="job-list">
          @for (j of sortedJobs; track $index) {
            <div class="job-card" [class]="'job-' + jobStatus(j)">
              <div class="job-status-icon" [class]="'jsi-' + jobStatus(j)">
                <i class="pi" [class]="jobIcon(j)"></i>
              </div>
              <div class="job-body">
                <div class="job-top">
                  <code class="job-name">{{ j.name }}</code>
                  <p-tag [value]="j.state || j.status || 'Unknown'" [severity]="jobSeverity(j)" [rounded]="true" />
                </div>
                @if (j.duration) {
                  <span class="job-duration"><i class="pi pi-stopwatch"></i> {{ j.duration }}</span>
                }
                @if (j.reason || j.message) {
                  <div class="job-failure">
                    @if (j.reason) { <span class="jf-reason">{{ j.reason }}</span> }
                    @if (j.message) { <span class="jf-message">{{ j.message }}</span> }
                  </div>
                }
              </div>
              <!-- Progress indicator -->
              <div class="job-progress">
                <div class="jp-step" [class.jp-done]="true">
                  <span class="jp-dot"></span>
                  <span class="jp-label">Created</span>
                </div>
                <div class="jp-line" [class.jp-line-done]="jobStatus(j) !== 'pending'"></div>
                <div class="jp-step" [class.jp-done]="jobStatus(j) === 'running' || jobStatus(j) === 'complete' || jobStatus(j) === 'failed'">
                  <span class="jp-dot"></span>
                  <span class="jp-label">Running</span>
                </div>
                <div class="jp-line" [class.jp-line-done]="jobStatus(j) === 'complete' || jobStatus(j) === 'failed'"></div>
                <div class="jp-step" [class.jp-done]="jobStatus(j) === 'complete' || jobStatus(j) === 'failed'" [class.jp-failed]="jobStatus(j) === 'failed'">
                  <span class="jp-dot"></span>
                  <span class="jp-label">{{ jobStatus(j) === 'failed' ? 'Failed' : 'Done' }}</span>
                </div>
              </div>
            </div>
          }
        </div>
      } @else {
        <div class="empty-state"><i class="pi pi-clock"></i> No jobs found</div>
      }
    </div>
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .header-actions { display: flex; align-items: center; gap: 8px; }
    .search-wrap { position: relative; display: flex; align-items: center; }
    .search-wrap i { position: absolute; left: 8px; font-size: 12px; color: var(--text-muted); }
    .search-wrap input {
      padding: 6px 10px 6px 28px; width: 150px; border: 1px solid var(--border); border-radius: 6px;
      background: var(--bg-elevated); color: var(--text); font-size: 12px; outline: none;
    }
    .search-wrap input:focus { border-color: var(--accent); }
    .ar-btn {
      width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--border);
      background: var(--bg-card); color: var(--text-muted); cursor: pointer; transition: all 0.15s;
      display: flex; align-items: center; justify-content: center;
    }
    .ar-btn:hover { border-color: var(--accent); color: var(--accent); }
    .ar-btn.ar-active { border-color: var(--success); color: var(--success); background: var(--success-subtle); }
    .ar-btn.ar-active i { animation: spin2 2s linear infinite; }
    @keyframes spin2 { to { transform: rotate(360deg); } }

    /* Summary */
    .summary-strip {
      display: flex; gap: 8px; margin-bottom: 20px;
      padding: 14px 18px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
    }
    .summary-pill { display: flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px; background: var(--bg-elevated); font-size: 12px; }
    .summary-pill i { font-size: 12px; color: var(--text-muted); }
    .pill-ok { background: var(--success-subtle); }
    .pill-bad { background: var(--danger-subtle); }
    .pill-active { background: var(--accent-subtle); }
    .pill-dot { width: 6px; height: 6px; border-radius: 50%; }
    .dot-ok { background: var(--success); }
    .dot-bad { background: var(--danger); }
    .dot-active { background: var(--accent); animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
    .pill-val { font-weight: 700; }
    .pill-label { color: var(--text-muted); }

    /* Sections */
    .section { margin-bottom: 28px; }
    .section-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .section-header h3 { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px; margin: 0; }
    .section-header h3 i { font-size: 13px; color: var(--text-muted); }
    .section-count { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px; background: var(--bg-elevated); color: var(--text-muted); }

    /* CronJob Cards */
    .cj-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; }
    .cj-card {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 16px; transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
    }
    .cj-card:hover { border-color: var(--border-hover); transform: translateY(-2px); box-shadow: 0 8px 24px -8px rgba(0,0,0,0.2); }
    .cj-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .cj-name { font-size: 13px; font-weight: 600; }
    .cj-schedule { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .cj-schedule i { font-size: 12px; color: var(--text-muted); }
    .cj-schedule code { font-size: 12px; color: var(--accent); }
    .cj-human { font-size: 11px; color: var(--text-muted); }
    .cj-last { font-size: 11px; color: var(--text-muted); }
    .cj-last-label { margin-right: 4px; }
    .cj-last-time { font-family: 'JetBrains Mono', monospace; }
    .cj-triggered {
      margin-top: 8px; font-size: 11px; color: var(--success);
      display: flex; align-items: center; gap: 4px;
      animation: fadeIn 0.3s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    /* Job Cards */
    .job-list { display: flex; flex-direction: column; gap: 6px; }
    .job-card {
      display: flex; align-items: center; gap: 12px;
      padding: 14px 18px; background: var(--bg-card);
      border: 1px solid var(--border); border-radius: var(--radius);
      transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
    }
    .job-card:hover { border-color: var(--border-hover); transform: translateY(-2px); box-shadow: 0 8px 24px -8px rgba(0,0,0,0.2); }
    .job-failed { border-left: 3px solid var(--danger); }
    .job-status-icon {
      width: 32px; height: 32px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0;
    }
    .jsi-complete { background: var(--success-subtle); color: var(--success); }
    .jsi-failed { background: var(--danger-subtle); color: var(--danger); }
    .jsi-running { background: var(--accent-subtle); color: var(--accent); }
    .jsi-pending { background: var(--bg-elevated); color: var(--text-muted); }
    .job-body { flex: 1; min-width: 0; }
    .job-top { display: flex; align-items: center; gap: 8px; margin-bottom: 2px; }
    .job-name { font-size: 12px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .job-duration { font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 4px; }
    .job-duration i { font-size: 10px; }

    /* Failure Info */
    .job-failure {
      margin-top: 4px; padding: 6px 10px;
      background: var(--danger-subtle); border-radius: 6px;
      font-size: 11px; line-height: 1.4;
    }
    .jf-reason { font-weight: 600; color: var(--danger); display: block; }
    .jf-message { color: var(--text-secondary); display: block; margin-top: 2px; }

    /* Progress Steps */
    .job-progress { display: flex; align-items: center; gap: 0; flex-shrink: 0; }
    .jp-step { display: flex; flex-direction: column; align-items: center; gap: 2px; }
    .jp-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--border); transition: all 0.2s; }
    .jp-done .jp-dot { background: var(--success); }
    .jp-failed .jp-dot { background: var(--danger); }
    .jp-label { font-size: 9px; color: var(--text-muted); }
    .jp-line { width: 20px; height: 2px; background: var(--border); margin-bottom: 12px; }
    .jp-line-done { background: var(--success); }

    .empty-state {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      padding: 40px; color: var(--text-muted); font-size: 13px;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
    }
    .empty-state i { font-size: 16px; opacity: 0.5; }
    @media (max-width: 768px) {
      .page-header { flex-direction: column; gap: 12px; }
      .header-actions { flex-wrap: wrap; }
      .summary-cards { grid-template-columns: repeat(2, 1fr); }
    }
  `],
})
export class JobsComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  cronjobs: any[] = [];
  jobs: any[] = [];
  sortedJobs: any[] = [];
  searchQuery = '';
  loading = false;
  autoRefresh = true;
  lastUpdated = '';
  private refreshTimer: any;

  get completedCount() { return this.jobs.filter(j => this.jobStatus(j) === 'complete').length; }
  get failedCount() { return this.jobs.filter(j => this.jobStatus(j) === 'failed').length; }
  get runningCount() { return this.jobs.filter(j => this.jobStatus(j) === 'running').length; }

  ngOnInit() {
    this.load();
    this.startAutoRefresh();
  }

  ngOnDestroy() { clearInterval(this.refreshTimer); }

  toggleAutoRefresh() {
    this.autoRefresh = !this.autoRefresh;
    if (this.autoRefresh) this.startAutoRefresh();
    else clearInterval(this.refreshTimer);
  }

  private startAutoRefresh() {
    clearInterval(this.refreshTimer);
    this.refreshTimer = setInterval(() => this.load(), 30000);
  }

  applyFilter() {
    const q = this.searchQuery.toLowerCase();
    if (!q) {
      this.sortedJobs = this.sortJobs(this.jobs);
      return;
    }
    this.sortedJobs = this.sortJobs(this.jobs.filter(j => j.name.toLowerCase().includes(q)));
  }

  private sortJobs(jobs: any[]): any[] {
    return [...jobs].sort((a, b) => {
      const order: Record<string, number> = { failed: 0, running: 1, pending: 2, complete: 3 };
      return (order[this.jobStatus(a)] ?? 4) - (order[this.jobStatus(b)] ?? 4);
    });
  }

  load() {
    this.loading = true;
    this.http.get<any>('/api/cronjobs').subscribe(r => {
      this.cronjobs = (r.cronjobs || []).map((c: any) => ({ ...c, triggered: false }));
    });
    this.http.get<any>('/api/jobs').subscribe(r => {
      this.jobs = r.jobs || [];
      this.applyFilter();
      this.loading = false;
      this.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    });
  }

  trigger(cj: any) {
    this.http.post<any>(`/api/trigger/${cj.name}`, {}).subscribe(() => {
      cj.triggered = true;
      setTimeout(() => cj.triggered = false, 3000);
    });
  }

  jobStatus(j: any): string {
    const s = (j.state || j.status || '').toLowerCase();
    if (s.includes('complete') || s.includes('succeeded')) return 'complete';
    if (s.includes('fail')) return 'failed';
    if (s.includes('running') || s.includes('active')) return 'running';
    return 'pending';
  }

  jobIcon(j: any): string {
    const s = this.jobStatus(j);
    if (s === 'complete') return 'pi-check';
    if (s === 'failed') return 'pi-times';
    if (s === 'running') return 'pi-spin pi-spinner';
    return 'pi-clock';
  }

  jobSeverity(j: any): 'success' | 'danger' | 'info' | 'warn' {
    const s = this.jobStatus(j);
    if (s === 'complete') return 'success';
    if (s === 'failed') return 'danger';
    if (s === 'running') return 'info';
    return 'warn';
  }

  humanSchedule(cron: string): string {
    if (!cron) return '';
    const parts = cron.split(' ');
    if (parts.length < 5) return '';
    if (cron === '*/5 * * * *') return 'Every 5 min';
    if (cron === '*/10 * * * *') return 'Every 10 min';
    if (cron === '*/15 * * * *') return 'Every 15 min';
    if (cron === '*/30 * * * *') return 'Every 30 min';
    if (cron === '0 * * * *') return 'Every hour';
    if (parts[1] !== '*' && parts[0] === '0') return `Daily at ${parts[1]}:00`;
    if (parts[0] === '0' && parts[1] === '0') return 'Daily at midnight';
    return '';
  }
}
