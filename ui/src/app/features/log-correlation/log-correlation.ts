import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MultiSelect } from 'primeng/multiselect';
import { TooltipModule } from 'primeng/tooltip';
import { IntelHeaderComponent } from '../../shared/components/futuristic/intel-header.component';
import { MetricTileComponent } from '../../shared/components/futuristic/metric-tile.component';
import { LiveIndicatorComponent } from '../../shared/components/futuristic/live-indicator.component';
import { CommandBarComponent } from '../../shared/components/futuristic/command-bar.component';
import type { CommandPill } from '../../shared/components/futuristic/command-bar.component';
import { ActionIconComponent } from '../../shared/components/futuristic/action-icon.component';

@Component({
  selector: 'app-log-correlation',
  standalone: true,
  imports: [FormsModule, MultiSelect, TooltipModule, IntelHeaderComponent, MetricTileComponent, LiveIndicatorComponent, CommandBarComponent, ActionIconComponent],
  templateUrl: './log-correlation.html',
  styleUrl: './log-correlation.scss',
})
export class LogCorrelationComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  podOptions: { label: string; value: string }[] = [];
  selectedPods: string[] = [];
  data: any = null;
  loading = false;
  streaming = false;
  levelFilter = 'all';
  searchQuery = '';
  private streamInterval: any;

  private colors = ['#d09c60', '#4ade80', '#f59e0b', '#a78bfa', '#f43f5e', '#06b6d4', '#f97316', '#ec4899'];

  get errorCount(): number {
    return (this.data?.entries || []).filter((e: any) => e.level === 'error').length;
  }

  get warnCount(): number {
    return (this.data?.entries || []).filter((e: any) => e.level === 'warn').length;
  }

  get filterPills(): CommandPill[] {
    const pills: CommandPill[] = [
      { label: 'All', value: 'all', count: this.data?.entries?.length || 0 },
      { label: 'Error', value: 'error', count: this.errorCount, color: 'red' },
      { label: 'Warn', value: 'warn', count: this.warnCount, color: 'amber' },
      { label: 'Info', value: 'info', color: 'cyan' },
    ];
    return pills;
  }

  get filteredEntries(): any[] {
    if (!this.data?.entries) return [];
    let entries = this.data.entries;
    if (this.levelFilter !== 'all') {
      entries = entries.filter((e: any) => e.level === this.levelFilter);
    }
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      entries = entries.filter((e: any) => e.message?.toLowerCase().includes(q) || e.pod?.toLowerCase().includes(q));
    }
    return entries;
  }

  ngOnInit() {
    this.http.get<any>('/api/pods').subscribe(res => {
      this.podOptions = (res.pods || []).map((p: any) => ({ label: p.name, value: p.name }));
    });
  }

  ngOnDestroy() { this.stopStream(); }

  correlate() {
    if (this.selectedPods.length < 2) return;
    this.loading = true;
    this.data = null;
    this.http.post<any>('/api/correlate-logs', {
      pods: this.selectedPods, tail: 100,
    }).subscribe({
      next: (res) => { this.data = res; this.loading = false; },
      error: () => { this.data = { entries: [], pods: [], total: 0 }; this.loading = false; },
    });
  }

  toggleStream() {
    this.streaming ? this.stopStream() : this.startStream();
  }

  private startStream() {
    if (this.selectedPods.length < 2) return;
    this.streaming = true;
    this.streamInterval = setInterval(() => this.correlate(), 5000);
  }

  private stopStream() {
    this.streaming = false;
    if (this.streamInterval) { clearInterval(this.streamInterval); this.streamInterval = null; }
  }

  onLevelChange(value: string) { this.levelFilter = value; }
  onSearchChange(value: string) { this.searchQuery = value; }

  podColor(pod: string): string {
    const idx = this.data?.pods?.indexOf(pod) ?? this.data?.pods?.findIndex((p: string) => p.includes(pod)) ?? 0;
    return this.colors[Math.abs(idx) % this.colors.length];
  }

  shortName(pod: string): string {
    const parts = pod.split('-');
    return parts.length > 2 ? parts.slice(0, -2).join('-') : pod;
  }

  copyLine(entry: any) {
    navigator.clipboard.writeText(`${entry.timestamp || ''} [${entry.pod}] ${entry.message}`);
  }

  copyAll() {
    if (!this.data?.entries) return;
    const text = this.data.entries.map((e: any) => `${e.timestamp || ''} [${e.pod}] ${e.message}`).join('\n');
    navigator.clipboard.writeText(text);
  }
}
