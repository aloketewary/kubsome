import { Component, inject, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
import { IntelHeaderComponent } from '../../shared/components/futuristic/intel-header.component';

interface ErrorSummaryItem {
  pattern: string;
  count: number;
  firstIndex: number;
}

@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [Select, ButtonModule, TooltipModule, FormsModule, HoloCardComponent, MetricTileComponent, StatusBeaconComponent, CommandBarComponent, LiveIndicatorComponent, IntelHeaderComponent],
  host: { '[class.logs-nowrap]': '!wordWrap' },
  templateUrl: './logs.html',
  styleUrl: './logs.scss',
})
export class LogsComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private ws = inject(WsService);
  private route = inject(ActivatedRoute);
  router = inject(Router);
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
  levelFilter: 'all' | 'error' | 'warn' | 'context' = 'all';
  fullscreen = false;
  wordWrap = true;
  contextLines = 10;
  private streamSub: Subscription | null = null;
  private streamClose: (() => void) | null = null;
  private watchTimer: any = null;

  // Error navigation
  private currentErrorNavIndex = -1;

  get errorCount() { return this.lines.filter(l => this.isError(l)).length; }
  get warnCount() { return this.lines.filter(l => this.isWarn(l)).length; }

  /** Error summary — group error lines by pattern */
  get errorSummary(): ErrorSummaryItem[] {
    const map = new Map<string, { count: number; firstIndex: number }>();
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      if (!this.isError(line)) continue;
      const pattern = this.extractErrorPattern(line);
      const existing = map.get(pattern);
      if (existing) {
        existing.count++;
      } else {
        map.set(pattern, { count: 1, firstIndex: i });
      }
    }
    return [...map.entries()]
      .map(([pattern, data]) => ({ pattern, count: data.count, firstIndex: data.firstIndex }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  /** Error line indices for navigation */
  get errorIndices(): number[] {
    const indices: number[] = [];
    for (let i = 0; i < this.filteredLines.length; i++) {
      if (this.isError(this.filteredLines[i])) indices.push(i);
    }
    return indices;
  }

  get filterPills(): CommandPill[] {
    return [
      { label: 'All', value: 'all', count: this.lines.length },
      { label: 'Errors', value: 'error', count: this.errorCount, color: 'red' },
      { label: 'Warn', value: 'warn', count: this.warnCount, color: 'amber' },
      { label: 'Context', value: 'context', count: this.errorCount, color: 'purple' },
    ];
  }

  onLevelChange(v: string) { this.levelFilter = v as any; this.filterLines(); }

  ngOnInit() {
    this.api.getPods().subscribe(res => {
      this.podOptions = res.pods.map(p => ({ label: `${p.status === 'Running' ? '●' : '○'} ${p.name}`, value: p.name }));

      // P0: Auto-load from query param
      this.route.queryParams.subscribe(params => {
        const target = params['pod'] || params['target'];
        if (target) {
          // Fuzzy match: find pod that starts with or contains target
          const match = this.podOptions.find(p => p.value === target)
            || this.podOptions.find(p => p.value.startsWith(target))
            || this.podOptions.find(p => p.value.includes(target));
          if (match) {
            this.selectedPod = match.value;
            this.onPodChange();
            this.fetchLogs();
          }
        }
      });
    });
  }

  ngOnDestroy() { this.stopStream(); this.stopWatch(); }

  onPodChange() {
    this.selectedContainer = null;
    this.containerOptions = [];
    if (!this.selectedPod) return;
    this.api.getContainers(this.selectedPod).subscribe(res => {
      this.containerOptions = res.containers.map(c => ({ label: c, value: c }));
    });
  }

  fetchLogs() {
    if (!this.selectedPod) return;
    this.stopStream();
    this.currentErrorNavIndex = -1;
    this.api.getLogs(this.selectedPod, this.tailSize, false, this.selectedContainer || undefined).subscribe(res => {
      this.lines = res.lines;
      this.fetched = true;
      this.filterLines();
    });
  }

  toggleLive() {
    if (this.streaming) { this.stopStream(); return; }
    if (!this.selectedPod) return;
    this.stopWatch(); this.streaming = true; this.lines = []; this.filteredLines = [];
    const cp = this.selectedContainer ? `?container=${this.selectedContainer}` : '';
    const conn = this.ws.connect(`/ws/logs/${this.selectedPod}${cp}`);
    this.streamClose = conn.close;
    this.streamSub = conn.messages$.subscribe(line => {
      this.lines.push(line);
      if (this.matchesFilter(line)) this.filteredLines = [...this.filteredLines, line];
      setTimeout(() => this.scrollBottom(), 30);
    });
  }

  toggleWatch() {
    if (this.watching) { this.stopWatch(); return; }
    if (!this.selectedPod) return;
    this.stopStream(); this.watching = true; this.fetchLogs();
    this.watchTimer = setInterval(() => this.fetchLogs(), this.watchInterval * 1000);
  }

  filterLines() {
    let result = this.lines;
    if (this.levelFilter === 'error') {
      result = result.filter(l => this.isError(l));
    } else if (this.levelFilter === 'warn') {
      result = result.filter(l => this.isWarn(l));
    } else if (this.levelFilter === 'context') {
      result = this.buildContextView();
    }
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(l => l.toLowerCase().includes(q));
    }
    this.filteredLines = result;
  }

  /** P1: Context mode — show N lines before/after each error */
  private buildContextView(): string[] {
    const result: string[] = [];
    const included = new Set<number>();
    for (let i = 0; i < this.lines.length; i++) {
      if (this.isError(this.lines[i])) {
        const start = Math.max(0, i - this.contextLines);
        const end = Math.min(this.lines.length - 1, i + this.contextLines);
        for (let j = start; j <= end; j++) included.add(j);
      }
    }
    let lastIncluded = -2;
    for (const idx of [...included].sort((a, b) => a - b)) {
      if (idx > lastIncluded + 1 && lastIncluded >= 0) {
        result.push('--- gap ---');
      }
      result.push(this.lines[idx]);
      lastIncluded = idx;
    }
    return result;
  }

  /** P0: Jump to first error */
  jumpToFirstError() {
    this.currentErrorNavIndex = 0;
    this.scrollToError(0);
  }

  /** P0: Jump to next error */
  jumpToNextError() {
    if (this.errorIndices.length === 0) return;
    this.currentErrorNavIndex = (this.currentErrorNavIndex + 1) % this.errorIndices.length;
    this.scrollToError(this.currentErrorNavIndex);
  }

  /** P0: Jump to prev error */
  jumpToPrevError() {
    if (this.errorIndices.length === 0) return;
    this.currentErrorNavIndex = this.currentErrorNavIndex <= 0
      ? this.errorIndices.length - 1
      : this.currentErrorNavIndex - 1;
    this.scrollToError(this.currentErrorNavIndex);
  }

  private scrollToError(navIndex: number) {
    const lineIdx = this.errorIndices[navIndex];
    if (lineIdx === undefined) return;
    setTimeout(() => {
      const viewer = this.logEl?.nativeElement?.querySelector('.log-viewer');
      const lines = viewer?.querySelectorAll('.log-line');
      if (lines?.[lineIdx]) {
        lines[lineIdx].scrollIntoView({ block: 'center', behavior: 'smooth' });
        lines[lineIdx].classList.add('line-highlight');
        setTimeout(() => lines[lineIdx].classList.remove('line-highlight'), 2000);
      }
    }, 50);
  }

  /** Jump to specific error from summary */
  jumpToErrorAt(originalIndex: number) {
    // Find this line in filteredLines
    const line = this.lines[originalIndex];
    const filteredIdx = this.filteredLines.indexOf(line);
    if (filteredIdx >= 0) {
      const navIdx = this.errorIndices.indexOf(filteredIdx);
      if (navIdx >= 0) {
        this.currentErrorNavIndex = navIdx;
        this.scrollToError(navIdx);
      }
    }
  }

  private matchesFilter(line: string): boolean {
    if (this.levelFilter === 'error' && !this.isError(line)) return false;
    if (this.levelFilter === 'warn' && !this.isWarn(line)) return false;
    if (this.searchQuery && !line.toLowerCase().includes(this.searchQuery.toLowerCase())) return false;
    return true;
  }

  scrollBottom() { const v = this.logEl?.nativeElement?.querySelector('.log-viewer'); if (v) v.scrollTop = v.scrollHeight; }
  copyLogs() { navigator.clipboard.writeText(this.filteredLines.join('\n')); }
  downloadLogs() {
    const blob = new Blob([this.filteredLines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `${this.selectedPod || 'logs'}-${new Date().toISOString().slice(0, 19)}.log`;
    a.click(); URL.revokeObjectURL(url);
  }

  lineClass(line: string): string {
    if (line === '--- gap ---') return 'level-gap';
    if (this.isError(line)) return 'level-error';
    if (this.isWarn(line)) return 'level-warn';
    if (line.toLowerCase().includes('debug')) return 'level-debug';
    return 'level-default';
  }

  lineLevel(line: string): string {
    if (line === '--- gap ---') return '···';
    const l = line.toLowerCase();
    if (l.includes('error') || l.includes('fatal') || l.includes('panic')) return 'ERR';
    if (l.includes('warn')) return 'WRN';
    if (l.includes('debug')) return 'DBG';
    if (l.includes('info')) return 'INF';
    return '';
  }

  private isError(line: string): boolean {
    if (line === '--- gap ---') return false;
    const l = line.toLowerCase();
    return l.includes('error') || l.includes('fatal') || l.includes('panic') || l.includes('oomkilled');
  }

  private isWarn(line: string): boolean {
    if (line === '--- gap ---') return false;
    return line.toLowerCase().includes('warn');
  }

  /** Extract a short pattern from error line for grouping */
  private extractErrorPattern(line: string): string {
    // Try to extract meaningful error message after level indicator
    const lower = line.toLowerCase();
    const markers = ['error:', 'fatal:', 'panic:', 'err ', 'error ', 'exception:'];
    for (const m of markers) {
      const idx = lower.indexOf(m);
      if (idx >= 0) {
        const rest = line.substring(idx + m.length).trim();
        // Take first ~60 chars as pattern
        return rest.length > 60 ? rest.substring(0, 60) + '...' : rest;
      }
    }
    // Fallback: take last portion of line
    return line.length > 60 ? line.substring(line.length - 60) : line;
  }

  private stopStream() { this.streaming = false; this.streamSub?.unsubscribe(); this.streamClose?.(); this.streamSub = null; this.streamClose = null; }
  private stopWatch() { this.watching = false; if (this.watchTimer) { clearInterval(this.watchTimer); this.watchTimer = null; } }
}
