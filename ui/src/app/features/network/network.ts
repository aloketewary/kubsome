import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { JsonPipe } from '@angular/common';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { HoloCardComponent } from '../../shared/components/futuristic/holo-card.component';
import { MetricTileComponent } from '../../shared/components/futuristic/metric-tile.component';
import { StatusBeaconComponent } from '../../shared/components/futuristic/status-beacon.component';
import { CommandBarComponent } from '../../shared/components/futuristic/command-bar.component';
import type { CommandPill } from '../../shared/components/futuristic/command-bar.component';
import { LiveIndicatorComponent } from '../../shared/components/futuristic/live-indicator.component';
import { IntelHeaderComponent } from '../../shared/components/futuristic/intel-header.component';

@Component({
  selector: 'app-network',
  standalone: true,
  imports: [FormsModule, JsonPipe, TagModule, TooltipModule, HoloCardComponent, MetricTileComponent, StatusBeaconComponent, CommandBarComponent, LiveIndicatorComponent, IntelHeaderComponent],
  templateUrl: './network.html',
  styleUrl: './network.scss',
})
export class NetworkComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  ingresses: any[] = [];
  endpoints: any[] = [];
  filteredEndpoints: any[] = [];
  netPolicies = 0;
  dnsQuery = '';
  dnsResult: any = null;
  meshDetected = false;
  meshType = '';
  epSearch = '';
  loading = false;
  autoRefresh = true;
  lastUpdated = '';
  private refreshTimer: any;

  get unhealthyEndpoints() { return this.endpoints.filter(e => !e.healthy).length; }
  get filterPills(): CommandPill[] { return [{ label: 'All', value: 'all', count: this.endpoints.length }, { label: 'Unhealthy', value: 'unhealthy', count: this.unhealthyEndpoints, color: 'red' }]; }
  epFilter = 'all';
  onEpFilter(v: string) { this.epFilter = v; this.filterEndpoints(); }
  onEpSearch(v: string) { this.epSearch = v; this.filterEndpoints(); }

  ngOnInit() { this.load(); this.startAutoRefresh(); }
  ngOnDestroy() { clearInterval(this.refreshTimer); }
  toggleAutoRefresh() { this.autoRefresh = !this.autoRefresh; if (this.autoRefresh) this.startAutoRefresh(); else clearInterval(this.refreshTimer); }
  private startAutoRefresh() { clearInterval(this.refreshTimer); this.refreshTimer = setInterval(() => this.load(), 30000); }

  filterEndpoints() {
    let result = this.endpoints;
    if (this.epFilter === 'unhealthy') result = result.filter(e => !e.healthy);
    const q = this.epSearch.toLowerCase();
    if (q) result = result.filter(e => e.name.toLowerCase().includes(q));
    this.filteredEndpoints = result;
  }

  load() {
    this.loading = true;
    this.http.get<any>('/api/ingress').subscribe(r => this.ingresses = r.ingresses || []);
    this.http.get<any>('/api/mesh').subscribe(r => { this.meshDetected = r.detected || false; this.meshType = r.type || ''; });
    this.http.get<any>('/api/endpoints').subscribe(r => { this.endpoints = r.services || []; this.filterEndpoints(); this.loading = false; this.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); });
    this.http.get<any>('/api/network-policies').subscribe(r => this.netPolicies = r.count || 0);
  }

  lookupDns() { if (!this.dnsQuery.trim()) return; this.dnsResult = null; this.http.get<any>(`/api/dns/${this.dnsQuery}`).subscribe(r => this.dnsResult = r); }
}
