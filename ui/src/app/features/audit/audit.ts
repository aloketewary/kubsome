import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { HoloCardComponent } from '../../shared/components/futuristic/holo-card.component';
import { MetricTileComponent } from '../../shared/components/futuristic/metric-tile.component';
import { StatusBeaconComponent } from '../../shared/components/futuristic/status-beacon.component';
import { CommandBarComponent } from '../../shared/components/futuristic/command-bar.component';
import type { CommandPill } from '../../shared/components/futuristic/command-bar.component';

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [FormsModule, HoloCardComponent, MetricTileComponent, StatusBeaconComponent, CommandBarComponent],
  templateUrl: './audit.html',
  styleUrl: './audit.scss',
})
export class AuditComponent implements OnInit {
  private http = inject(HttpClient);
  entries: any[] = [];
  summary: Record<string, number> = {};
  summaryEntries: { action: string; count: number }[] = [];
  actionTypes: string[] = [];
  filterAction = '';
  loading = false;

  get filterPills(): CommandPill[] {
    return [{ label: 'All', value: '', count: this.entries.length }, ...this.summaryEntries.map(e => ({ label: e.action, value: e.action, count: e.count }))];
  }

  onFilterChange(v: string) { this.filterAction = v; this.load(); }

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    const params: any = { limit: '100' };
    if (this.filterAction) params.action = this.filterAction;
    this.http.get<any>('/api/audit', { params }).subscribe({
      next: (res) => { this.entries = (res.log || []).reverse(); this.summary = res.summary || {}; this.summaryEntries = Object.entries(this.summary).map(([action, count]) => ({ action, count: count as number })).sort((a, b) => b.count - a.count); this.actionTypes = this.summaryEntries.map(e => e.action); this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  actionBeacon(action: string): 'warning' | 'critical' | 'info' { if (action === 'delete' || action === 'rollback') return 'critical'; if (action === 'restart' || action === 'scale') return 'warning'; return 'info'; }
  formatTime(ts: string): string { if (!ts) return ''; const diff = Date.now() - new Date(ts).getTime(); if (diff < 60000) return 'just now'; if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`; if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`; return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' }); }
}
