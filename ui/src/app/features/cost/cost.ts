import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { HoloCardComponent } from '../../shared/components/futuristic/holo-card.component';
import { MetricTileComponent } from '../../shared/components/futuristic/metric-tile.component';
import { StatusBeaconComponent } from '../../shared/components/futuristic/status-beacon.component';
import { CommandBarComponent } from '../../shared/components/futuristic/command-bar.component';
import type { CommandPill } from '../../shared/components/futuristic/command-bar.component';
import { ActionIconComponent } from '../../shared/components/futuristic/action-icon.component';

@Component({
  selector: 'app-cost',
  standalone: true,
  imports: [FormsModule, TagModule, ButtonModule, TooltipModule, HoloCardComponent, MetricTileComponent, StatusBeaconComponent, CommandBarComponent, ActionIconComponent],
  templateUrl: './cost.html',
  styleUrl: './cost.scss',
})
export class CostComponent implements OnInit {
  private http = inject(HttpClient);
  recommendations: any[] = [];
  unused: any[] = [];
  filteredRecs: any[] = [];
  filteredUnused: any[] = [];
  loaded = false;
  loading = false;
  lastScanned = '';
  searchQuery = '';
  viewFilter = 'all';

  get totalIssues() { return this.recommendations.length + this.unused.length; }
  get score() { if (this.totalIssues === 0) return 95; if (this.totalIssues <= 2) return 80; if (this.totalIssues <= 5) return 60; return 40; }
  get grade() { if (this.score >= 90) return 'A'; if (this.score >= 75) return 'B'; if (this.score >= 55) return 'C'; return 'D'; }
  get scoreGlow(): 'green' | 'cyan' | 'amber' | 'red' { if (this.score >= 90) return 'green'; if (this.score >= 75) return 'cyan'; if (this.score >= 55) return 'amber'; return 'red'; }
  get scoreStroke(): string { if (this.score >= 90) return '#10b981'; if (this.score >= 75) return '#00d4ff'; if (this.score >= 55) return '#f59e0b'; return '#f43f5e'; }
  get scoreTitle() { if (this.score >= 90) return 'Excellent Efficiency'; if (this.score >= 75) return 'Good Efficiency'; if (this.score >= 55) return 'Room for Improvement'; return 'Needs Attention'; }

  get filterPills(): CommandPill[] {
    return [
      { label: 'All', value: 'all', count: this.totalIssues },
      { label: 'Right-size', value: 'recs', count: this.recommendations.length, color: 'cyan' },
      { label: 'Unused', value: 'unused', count: this.unused.length, color: 'amber' },
    ];
  }

  onFilterChange(v: string) { this.viewFilter = v; this.applyFilter(); }
  onSearchChange(v: string) { this.searchQuery = v; this.applyFilter(); }

  impactClass(i: number): string { return i < 2 ? 'impact-high' : i < 5 ? 'impact-med' : 'impact-low'; }
  impactLabel(i: number): string { return i < 2 ? 'High' : i < 5 ? 'Medium' : 'Low'; }
  impactSeverity(i: number): 'danger' | 'warn' | 'info' { return i < 2 ? 'danger' : i < 5 ? 'warn' : 'info'; }
  impactPct(i: number): number { return i < 2 ? 100 : i < 5 ? 60 : 30; }

  unusedIcon(res: any): string {
    const kind = (res.kind || '').toLowerCase();
    if (kind.includes('secret')) return 'pi-lock';
    if (kind.includes('config')) return 'pi-file';
    if (kind.includes('service')) return 'pi-globe';
    if (kind.includes('pvc') || kind.includes('volume')) return 'pi-database';
    return 'pi-box';
  }

  applyFilter() {
    const q = this.searchQuery.toLowerCase();
    let recs = this.recommendations;
    let un = this.unused;
    if (q) { recs = recs.filter(r => (r.name || r.pod || '').toLowerCase().includes(q)); un = un.filter(r => (r.name || r || '').toString().toLowerCase().includes(q)); }
    this.filteredRecs = this.viewFilter === 'unused' ? [] : recs;
    this.filteredUnused = this.viewFilter === 'recs' ? [] : un;
  }

  ngOnInit() { this.load(); }

  load() {
    this.loading = true; this.loaded = false;
    this.http.get<any>('/api/optimize').subscribe(res => { this.recommendations = res.recommendations || []; this.applyFilter(); this.loaded = true; this.loading = false; this.lastScanned = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); });
    this.http.get<any>('/api/unused').subscribe(res => { this.unused = res.resources || []; this.applyFilter(); });
  }
}
