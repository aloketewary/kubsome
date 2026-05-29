import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { RelatedPagesComponent } from '../../shared/components/related-pages.component';
import { IntelHeaderComponent, MetricTileComponent, StatusBeaconComponent, HoloCardComponent, LiveIndicatorComponent } from '../../shared/components/futuristic';

@Component({
  selector: 'app-health-signals',
  standalone: true,
  imports: [TagModule, TooltipModule, RelatedPagesComponent, IntelHeaderComponent, MetricTileComponent, StatusBeaconComponent, HoloCardComponent, LiveIndicatorComponent],
  templateUrl: './health-signals.html',
  styleUrl: './health-signals.scss',
})
export class HealthSignalsComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);

  signals: any = null;
  oomkills: any[] = [];
  hpa: any[] = [];
  quotas: any[] = [];
  rollouts: any[] = [];
  loading = false;
  autoRefresh = true;
  lastUpdated = '';
  private timer: any;

  relatedPages = [
    { path: '/monitor', icon: 'pi pi-desktop', label: 'Monitor', description: 'Multi-cluster card view' },
    { path: '/pods', icon: 'pi pi-box', label: 'Pods', description: 'Pod list and status' },
    { path: '/deployments', icon: 'pi pi-send', label: 'Deployments', description: 'Rollout management' },
    { path: '/rightsizing', icon: 'pi pi-sliders-h', label: 'Right-Sizing', description: 'Resource recommendations' },
  ];

  get totalIssues(): number {
    if (!this.signals) return 0;
    return this.signals.oomkills_24h + this.signals.hpa_at_max + this.signals.quota_pressure + this.signals.stalled_rollouts;
  }

  get overallStatus(): 'ok' | 'warning' | 'critical' {
    if (!this.signals) return 'ok';
    if (this.signals.oomkills_24h > 0 || this.signals.stalled_rollouts > 0) return 'critical';
    if (this.signals.hpa_at_max > 0 || this.signals.quota_pressure > 0) return 'warning';
    return 'ok';
  }

  ngOnInit() { this.refresh(); this.timer = setInterval(() => { if (this.autoRefresh) this.refresh(); }, 60000); }
  ngOnDestroy() { clearInterval(this.timer); }

  toggleAutoRefresh() { this.autoRefresh = !this.autoRefresh; }

  isRecent(ts: string): boolean {
    if (!ts) return false;
    return (Date.now() - new Date(ts).getTime()) < 3600000;
  }

  refresh() {
    this.loading = true;
    this.http.get<any>('/api/monitor/health-signals').subscribe({
      next: (res) => { this.signals = res; },
      error: () => { this.signals = { oomkills_24h: 0, hpa_at_max: 0, quota_pressure: 0, stalled_rollouts: 0 }; },
    });
    this.http.get<any>('/api/monitor/oomkills?hours=48').subscribe({
      next: (res) => { this.oomkills = res.oomkills || []; },
      error: () => { this.oomkills = []; },
    });
    this.http.get<any>('/api/monitor/hpa').subscribe({
      next: (res) => { this.hpa = (res.hpa || []).slice(0, 20); },
      error: () => { this.hpa = []; },
    });
    this.http.get<any>('/api/monitor/quotas').subscribe({
      next: (res) => { this.quotas = res.quotas || []; },
      error: () => { this.quotas = []; },
    });
    this.http.get<any>('/api/monitor/rollouts').subscribe({
      next: (res) => { this.rollouts = (res.rollouts || []).filter((r: any) => r.state !== 'complete'); this.loading = false; this.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); },
      error: () => { this.rollouts = []; this.loading = false; },
    });
  }

  formatTime(ts: string): string {
    if (!ts) return '—';
    try { return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return ts.substring(0, 16); }
  }

  stateSeverity(state: string): "success" | "warn" | "danger" | "info" | "secondary" | "contrast" | undefined {
    if (state === 'complete') return 'success';
    if (state === 'progressing') return 'info';
    if (state === 'degraded' || state === 'stalled') return 'danger';
    return 'warn';
  }
}
