import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { JsonPipe } from '@angular/common';
import { TagModule } from 'primeng/tag';
import { HoloCardComponent } from '../../shared/components/futuristic/holo-card.component';
import { MetricTileComponent } from '../../shared/components/futuristic/metric-tile.component';
import { StatusBeaconComponent } from '../../shared/components/futuristic/status-beacon.component';
import { LiveIndicatorComponent } from '../../shared/components/futuristic/live-indicator.component';

@Component({
  selector: 'app-gitops',
  standalone: true,
  imports: [JsonPipe, TagModule, HoloCardComponent, MetricTileComponent, StatusBeaconComponent, LiveIndicatorComponent],
  templateUrl: './gitops.html',
  styleUrl: './gitops.scss',
})
export class GitopsComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  data: any = null; detail: any = null; loading = false; lastUpdated = ''; private timer: any;

  ngOnInit() { this.refresh(); this.timer = setInterval(() => this.refresh(), 30000); }
  ngOnDestroy() { clearInterval(this.timer); }
  refresh() { this.loading = true; this.http.get<any>('/api/gitops').subscribe({ next: (res) => { this.data = res; this.loading = false; this.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }, error: () => { this.data = { provider: null, apps: [] }; this.loading = false; } }); }
  selectApp(name: string) { this.http.get<any>(`/api/gitops/${name}`).subscribe({ next: (res) => { this.detail = res; } }); }
  syncBeacon(status: string): 'ok' | 'warning' | 'critical' { if (status === 'Synced' || status === 'Ready') return 'ok'; if (status === 'OutOfSync') return 'warning'; return 'critical'; }
  syncSev(status: string): 'success' | 'warn' | 'danger' | 'info' { if (status === 'Synced' || status === 'Ready') return 'success'; if (status === 'OutOfSync') return 'warn'; if (status === 'Degraded') return 'danger'; return 'info'; }
  formatTime(ts: string): string { if (!ts) return '—'; try { return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return ts; } }
}
