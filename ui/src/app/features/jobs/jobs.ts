import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { HoloCardComponent } from '../../shared/components/futuristic/holo-card.component';
import { MetricTileComponent } from '../../shared/components/futuristic/metric-tile.component';
import { StatusBeaconComponent } from '../../shared/components/futuristic/status-beacon.component';
import { CommandBarComponent } from '../../shared/components/futuristic/command-bar.component';
import type { CommandPill } from '../../shared/components/futuristic/command-bar.component';
import { LiveIndicatorComponent } from '../../shared/components/futuristic/live-indicator.component';
import { ActionIconComponent } from '../../shared/components/futuristic/action-icon.component';
import { IntelHeaderComponent } from '../../shared/components/futuristic/intel-header.component';

@Component({
  selector: 'app-jobs',
  standalone: true,
  imports: [IntelHeaderComponent, FormsModule, TagModule, TooltipModule, HoloCardComponent, MetricTileComponent, StatusBeaconComponent, CommandBarComponent, LiveIndicatorComponent, ActionIconComponent],
  templateUrl: './jobs.html',
  styleUrl: './jobs.scss',
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
  statusFilter = 'all';
  private refreshTimer: any;

  get completedCount() { return this.jobs.filter(j => this.jobStatus(j) === 'complete').length; }
  get failedCount() { return this.jobs.filter(j => this.jobStatus(j) === 'failed').length; }
  get runningCount() { return this.jobs.filter(j => this.jobStatus(j) === 'running').length; }

  get filterPills(): CommandPill[] {
    const pills: CommandPill[] = [{ label: 'All', value: 'all', count: this.jobs.length }];
    if (this.runningCount > 0) pills.push({ label: 'Running', value: 'running', count: this.runningCount, color: 'cyan' });
    if (this.completedCount > 0) pills.push({ label: 'Complete', value: 'complete', count: this.completedCount, color: 'green' });
    if (this.failedCount > 0) pills.push({ label: 'Failed', value: 'failed', count: this.failedCount, color: 'red' });
    return pills;
  }

  onFilterChange(value: string) { this.statusFilter = value; this.applyFilter(); }
  onSearchChange(value: string) { this.searchQuery = value; this.applyFilter(); }

  applyFilter() {
    let result = this.jobs;
    if (this.statusFilter !== 'all') result = result.filter(j => this.jobStatus(j) === this.statusFilter);
    const q = this.searchQuery.toLowerCase();
    if (q) result = result.filter(j => j.name.toLowerCase().includes(q));
    this.sortedJobs = this.sortJobs(result);
  }

  private sortJobs(jobs: any[]): any[] {
    const order: Record<string, number> = { failed: 0, running: 1, pending: 2, complete: 3 };
    return [...jobs].sort((a, b) => (order[this.jobStatus(a)] ?? 4) - (order[this.jobStatus(b)] ?? 4));
  }

  load() {
    this.loading = true;
    this.http.get<any>('/api/cronjobs').subscribe(r => { this.cronjobs = (r.cronjobs || []).map((c: any) => ({ ...c, triggered: false })); });
    this.http.get<any>('/api/jobs').subscribe(r => {
      this.jobs = r.jobs || [];
      this.applyFilter();
      this.loading = false;
      this.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    });
  }

  trigger(cj: any) {
    this.http.post<any>(`/api/trigger/${cj.name}`, {}).subscribe(() => { cj.triggered = true; setTimeout(() => cj.triggered = false, 3000); });
  }

  jobStatus(j: any): string {
    const s = (j.state || j.status || '').toLowerCase();
    if (s.includes('complete') || s.includes('succeeded')) return 'complete';
    if (s.includes('fail')) return 'failed';
    if (s.includes('running') || s.includes('active')) return 'running';
    return 'pending';
  }

  jobBeacon(j: any): 'ok' | 'critical' | 'info' | 'warning' {
    const s = this.jobStatus(j);
    if (s === 'complete') return 'ok';
    if (s === 'failed') return 'critical';
    if (s === 'running') return 'info';
    return 'warning';
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
    if (cron === '*/5 * * * *') return 'Every 5 min';
    if (cron === '*/10 * * * *') return 'Every 10 min';
    if (cron === '*/15 * * * *') return 'Every 15 min';
    if (cron === '*/30 * * * *') return 'Every 30 min';
    if (cron === '0 * * * *') return 'Every hour';
    const parts = cron.split(' ');
    if (parts.length >= 5 && parts[1] !== '*' && parts[0] === '0') return `Daily at ${parts[1]}:00`;
    return '';
  }

  toggleAutoRefresh() { this.autoRefresh = !this.autoRefresh; if (this.autoRefresh) this.startAutoRefresh(); else clearInterval(this.refreshTimer); }
  private startAutoRefresh() { clearInterval(this.refreshTimer); this.refreshTimer = setInterval(() => this.load(), 30000); }

  ngOnInit() { this.load(); this.startAutoRefresh(); }
  ngOnDestroy() { clearInterval(this.refreshTimer); }
}
