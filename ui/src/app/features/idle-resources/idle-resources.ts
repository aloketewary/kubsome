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
import { ConfirmService } from '../../shared/services/confirm.service';

@Component({
  selector: 'app-idle-resources',
  standalone: true,
  imports: [IntelHeaderComponent, FormsModule, TagModule, TooltipModule, HoloCardComponent, MetricTileComponent, StatusBeaconComponent, CommandBarComponent, LiveIndicatorComponent, ActionIconComponent],
  templateUrl: './idle-resources.html',
  styleUrl: './idle-resources.scss',
})
export class IdleResourcesComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private confirmService = inject(ConfirmService);
  items: any[] = []; summary: any = null; loading = false; filter = ''; searchQuery = '';
  categoryList: { name: string; count: number }[] = [];
  dryRunResults: any[] = []; dryRunning = false;
  autoRefresh = true; lastUpdated = ''; private timer: any;

  get filteredItems() { let r = this.items; if (this.filter) r = r.filter(i => i.category === this.filter); if (this.searchQuery) { const q = this.searchQuery.toLowerCase(); r = r.filter(i => i.name.toLowerCase().includes(q)); } return r; }
  get filterPills(): CommandPill[] { return [{ label: 'All', value: '', count: this.items.length }, ...this.categoryList.map(c => ({ label: c.name, value: c.name, count: c.count }))]; }

  onFilterChange(v: string) { this.filter = v; }
  onSearchChange(v: string) { this.searchQuery = v; }

  ngOnInit() { this.refresh(); this.startAutoRefresh(); }
  ngOnDestroy() { clearInterval(this.timer); }
  toggleAutoRefresh() { this.autoRefresh = !this.autoRefresh; if (this.autoRefresh) this.startAutoRefresh(); else clearInterval(this.timer); }
  private startAutoRefresh() { clearInterval(this.timer); this.timer = setInterval(() => this.refresh(), 60000); }

  refresh() { this.loading = true; this.http.get<any>('/api/idle-resources').subscribe({ next: (res) => { this.items = res.items || []; this.summary = res.summary || {}; this.categoryList = Object.entries(this.summary.categories || {}).map(([name, stats]: [string, any]) => ({ name, count: stats.count })); this.loading = false; this.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }, error: () => { this.loading = false; } }); }
  dryRun() { this.dryRunning = true; this.http.post<any>('/api/idle-resources/dry-run', {}).subscribe({ next: (res) => { this.dryRunResults = res.commands || []; this.dryRunning = false; }, error: () => { this.dryRunning = false; } }); }
  copyAllCommands() { navigator.clipboard.writeText(this.dryRunResults.map(c => c.command).join('\n')); }
}
