import { Component, inject, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { Select } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { WsService } from '../../core/services/ws.service';
import { HoloCardComponent } from '../../shared/components/futuristic/holo-card.component';
import { MetricTileComponent } from '../../shared/components/futuristic/metric-tile.component';
import { StatusBeaconComponent } from '../../shared/components/futuristic/status-beacon.component';
import { CommandBarComponent } from '../../shared/components/futuristic/command-bar.component';
import type { CommandPill } from '../../shared/components/futuristic/command-bar.component';
import { LiveIndicatorComponent } from '../../shared/components/futuristic/live-indicator.component';

@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [Select, ButtonModule, TooltipModule, FormsModule, HoloCardComponent, MetricTileComponent, StatusBeaconComponent, CommandBarComponent, LiveIndicatorComponent],
  host: { '[class.logs-nowrap]': '!wordWrap' },
  templateUrl: './logs.html',
  styleUrl: './logs.scss',
})
export class LogsComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private ws = inject(WsService);
  @ViewChild('logEl') logEl!: ElementRef;

  podOptions: { label: string; value: string }[] = [];
  containerOptions: { label: string; value: string }[] = [];
  selectedPod = '';
  selectedContainer: string | null = null;
  tailSize = 200;
  tailOptions = [50, 100, 200, 500];
  lines: string[] = [];
  filteredLines: string[] = [];
  fetched = false;
  streaming = false;
  watching = false;
  watchInterval = 5;
  searchQuery = '';
  levelFilter: 'all' | 'error' | 'warn' = 'all';
  fullscreen = false;
  wordWrap = true;
  private streamSub: Subscription | null = null;
  private streamClose: (() => void) | null = null;
  private watchTimer: any = null;

  get errorCount() { return this.lines.filter(l => this.isError(l)).length; }
  get filterPills(): CommandPill[] {
    return [
      { label: 'All', value: 'all', count: this.lines.length },
      { label: 'Errors', value: 'error', count: this.lines.filter(l => this.isError(l)).length, color: 'red' },
      { label: 'Warn', value: 'warn', count: this.lines.filter(l => this.isWarn(l)).length, color: 'amber' },
    ];
  }

  onLevelChange(v: string) { this.levelFilter = v as any; this.filterLines(); }

  ngOnInit() { this.api.getPods().subscribe(res => { this.podOptions = res.pods.map(p => ({ label: `${p.status === 'Running' ? '●' : '○'} ${p.name}`, value: p.name })); }); }
  ngOnDestroy() { this.stopStream(); this.stopWatch(); }

  onPodChange() { this.selectedContainer = null; this.containerOptions = []; if (!this.selectedPod) return; this.api.getContainers(this.selectedPod).subscribe(res => { this.containerOptions = res.containers.map(c => ({ label: c, value: c })); }); }

  fetchLogs() {
    if (!this.selectedPod) return;
    this.stopStream();
    this.api.getLogs(this.selectedPod, this.tailSize, this.levelFilter === 'error', this.selectedContainer || undefined).subscribe(res => { this.lines = res.lines; this.fetched = true; this.filterLines(); });
  }

  toggleLive() {
    if (this.streaming) { this.stopStream(); return; }
    if (!this.selectedPod) return;
    this.stopWatch(); this.streaming = true; this.lines = []; this.filteredLines = [];
    const cp = this.selectedContainer ? `?container=${this.selectedContainer}` : '';
    const conn = this.ws.connect(`/ws/logs/${this.selectedPod}${cp}`);
    this.streamClose = conn.close;
    this.streamSub = conn.messages$.subscribe(line => { this.lines.push(line); if (this.matchesFilter(line)) this.filteredLines = [...this.filteredLines, line]; setTimeout(() => this.scrollBottom(), 30); });
  }

  toggleWatch() { if (this.watching) { this.stopWatch(); return; } if (!this.selectedPod) return; this.stopStream(); this.watching = true; this.fetchLogs(); this.watchTimer = setInterval(() => this.fetchLogs(), this.watchInterval * 1000); }
  private stopWatch() { this.watching = false; if (this.watchTimer) { clearInterval(this.watchTimer); this.watchTimer = null; } }

  filterLines() {
    let result = this.lines;
    if (this.levelFilter === 'error') result = result.filter(l => this.isError(l));
    if (this.levelFilter === 'warn') result = result.filter(l => this.isWarn(l));
    if (this.searchQuery) { const q = this.searchQuery.toLowerCase(); result = result.filter(l => l.toLowerCase().includes(q)); }
    this.filteredLines = result;
  }

  private matchesFilter(line: string): boolean { if (this.levelFilter === 'error' && !this.isError(line)) return false; if (this.levelFilter === 'warn' && !this.isWarn(line)) return false; if (this.searchQuery && !line.toLowerCase().includes(this.searchQuery.toLowerCase())) return false; return true; }
  scrollBottom() { const v = this.logEl?.nativeElement?.querySelector('.log-viewer'); if (v) v.scrollTop = v.scrollHeight; }
  copyLogs() { navigator.clipboard.writeText(this.filteredLines.join('\n')); }
  downloadLogs() { const blob = new Blob([this.filteredLines.join('\n')], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${this.selectedPod || 'logs'}-${new Date().toISOString().slice(0, 19)}.log`; a.click(); URL.revokeObjectURL(url); }
  lineClass(line: string): string { if (this.isError(line)) return 'level-error'; if (this.isWarn(line)) return 'level-warn'; if (line.toLowerCase().includes('debug')) return 'level-debug'; return 'level-default'; }
  lineLevel(line: string): string { const l = line.toLowerCase(); if (l.includes('error') || l.includes('fatal') || l.includes('panic')) return 'ERR'; if (l.includes('warn')) return 'WRN'; if (l.includes('debug')) return 'DBG'; if (l.includes('info')) return 'INF'; return ''; }
  private isError(line: string): boolean { const l = line.toLowerCase(); return l.includes('error') || l.includes('fatal') || l.includes('panic'); }
  private isWarn(line: string): boolean { return line.toLowerCase().includes('warn'); }
  private stopStream() { this.streaming = false; this.streamSub?.unsubscribe(); this.streamClose?.(); this.streamSub = null; this.streamClose = null; }
}
