import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { HoloCardComponent } from '../../shared/components/futuristic/holo-card.component';
import { MetricTileComponent } from '../../shared/components/futuristic/metric-tile.component';
import { StatusBeaconComponent } from '../../shared/components/futuristic/status-beacon.component';
import { ActionIconComponent } from '../../shared/components/futuristic/action-icon.component';

@Component({
  selector: 'app-integrations',
  standalone: true,
  imports: [ButtonModule, TagModule, HoloCardComponent, MetricTileComponent, StatusBeaconComponent, ActionIconComponent],
  templateUrl: './integrations.html',
  styleUrl: './integrations.scss',
})
export class IntegrationsComponent implements OnInit {
  private http = inject(HttpClient);
  integrations: any[] = [];
  discovered: any[] = [];
  loading = false;
  discovering = false;

  ngOnInit() { this.refresh(); }
  refresh() { this.loading = true; this.http.get<any>('/api/integrations').subscribe({ next: (res) => { this.integrations = res.integrations || []; this.loading = false; }, error: () => { this.loading = false; } }); }
  discover() { this.discovering = true; this.http.get<any>('/api/integrations/discover').subscribe({ next: (res) => { this.discovered = (res.discovered || []).filter((d: any) => !this.integrations.find(i => i.name === d.name)); this.discovering = false; }, error: () => { this.discovering = false; } }); }
  connect(name: string, url?: string) { this.http.post<any>('/api/integrations/connect', { name, url }).subscribe({ next: () => { this.refresh(); this.discovered = this.discovered.filter(d => d.name !== name); } }); }
  disconnect(name: string) { this.http.post<any>('/api/integrations/disconnect', { name }).subscribe({ next: () => this.refresh() }); }

  intBeacon(status: string): 'ok' | 'warning' | 'critical' | 'idle' { if (status === 'connected') return 'ok'; if (status === 'degraded') return 'warning'; return 'idle'; }
  statusSev(status: string): 'success' | 'warn' | 'danger' | 'info' { if (status === 'connected') return 'success'; if (status === 'degraded') return 'warn'; if (status === 'disconnected') return 'danger'; return 'info'; }
  iconFor(name: string): string { const m: Record<string, string> = { prometheus: 'pi pi-chart-line', grafana: 'pi pi-chart-bar', alertmanager: 'pi pi-bell', jaeger: 'pi pi-share-alt', loki: 'pi pi-file', argocd: 'pi pi-sync', flux: 'pi pi-sync' }; return m[name.toLowerCase()] || 'pi pi-box'; }
}
