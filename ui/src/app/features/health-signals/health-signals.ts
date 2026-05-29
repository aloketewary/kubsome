import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { PageInfoComponent } from '../../shared/components/page-info.component';
import { SpotlightComponent } from '../../shared/components/spotlight.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { RelatedPagesComponent } from '../../shared/components/related-pages.component';

@Component({
  selector: 'app-health-signals',
  standalone: true,
  imports: [ButtonModule, TagModule, PageInfoComponent, SpotlightComponent, RelatedPagesComponent, PageHeaderComponent],
  templateUrl: './health-signals.html',
  styleUrl: './health-signals.scss',
})
export class HealthSignalsComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private router = inject(Router);

  signals: any = null;
  oomkills: any[] = [];
  hpa: any[] = [];
  quotas: any[] = [];
  rollouts: any[] = [];
  loading = false;
  lastUpdated = '';
  private timer: any;

  relatedPages = [
    { path: '/monitor', icon: 'pi pi-desktop', label: 'Monitor', description: 'Multi-cluster card view' },
    { path: '/pods', icon: 'pi pi-box', label: 'Pods', description: 'Pod list and status' },
    { path: '/deployments', icon: 'pi pi-send', label: 'Deployments', description: 'Rollout management' },
    { path: '/rightsizing', icon: 'pi pi-sliders-h', label: 'Right-Sizing', description: 'Resource recommendations' },
  ];

  ngOnInit() { this.refresh(); this.timer = setInterval(() => this.refresh(), 60000); }
  ngOnDestroy() { clearInterval(this.timer); }

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

  scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
