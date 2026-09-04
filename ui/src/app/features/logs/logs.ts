import { Component, inject, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Select } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { WsService } from '../../core/services/ws.service';
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
  imports: [Select, ButtonModule, TooltipModule, FormsModule, MetricTileComponent, StatusBeaconComponent, CommandBarComponent, LiveIndicatorComponent, IntelHeaderComponent],
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
  tailOptions = [50, 100, 200, 500, 1000, 5000];
  lines: string[] = [];
  filteredLines: string[] = [];
  private filteredLineIndices: number[] = [];
  fetched = false;
  streaming = false;
  watching = false;
  followStream = true;
  watchInterval = 5;
  searchQuery = '';
  levelFilter: 'all' | 'error' | 'warn' | 'context' = 'all';
  fullscreen = false;
  wordWrap = true;
  contextLines = 10;
  loadingPods = false;
  loadingContainers = false;
  loadingLogs = false;
  errorMessage = '';
  actionNotice = '';
  private streamSub: Subscription | null = null;
  private streamClose: (() => void) | null = null;
  private watchTimer: any = null;
  private noticeTimer: any = null;

  // Error navigation
  private currentErrorNavIndex = -1;

  get errorCount() { return this.lines.filter(l => this.isError(l)).length; }
  get warnCount() { return this.lines.filter(l => this.isWarn(l)).length; }
  get contextCount() { return this.buildContextView().filter(line => line !== '--- gap ---').length; }

  /** Error summary - group error lines by pattern */
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
      { label: 'Context', value: 'context', count: this.contextCount, color: 'purple' },
    ];
  }

  get hasActiveFilters(): boolean {
    return this.levelFilter !== 'all' || !!this.searchQuery;
  }

  ngOnInit() {
    this.loadPods();
  }

  ngOnDestroy() {
    this.stopStream();
    this.stopWatch();
    clearTimeout(this.noticeTimer);
  }

  private loadPods() {
    this.loadingPods = true;
    this.errorMessage = '';
    this.api.getPods().subscribe({
      next: res => {
        this.podOptions = res.pods.map(p => ({ label: `${p.status === 'Running' ? '●' : '○'} ${p.name}`, value: p.name }));
        this.loadingPods = false;
        this.route.queryParams.subscribe(params => {
          const target = params['pod'] || params['target'];
          const requestedContainer = params['container'] || null;
          if (!target) return;

          const match = this.podOptions.find(p => p.value === target)
            || this.podOptions.find(p => p.value.startsWith(target))
            || this.podOptions.find(p => p.value.includes(target));
          if (match) {
            this.selectedPod = match.value;
            this.onPodChange(requestedContainer, true);
          }
        });
      },
      error: () => {
        this.loadingPods = false;
        this.errorMessage = 'Unable to load pods. Check cluster connectivity and retry.';
      },
    });
  }

  onPodChange(requestedContainer: string | null = null, autoFetch = false) {
    this.selectedContainer = null;
    this.containerOptions = [];
    this.lines = [];
    this.filteredLines = [];
    this.filteredLineIndices = [];
    this.fetched = false;
    this.currentErrorNavIndex = -1;
    this.errorMessage = '';
    if (!this.selectedPod) return;

    this.loadingContainers = true;
    this.api.getContainers(this.selectedPod).subscribe({
      next: res => {
        this.containerOptions = res.containers.map(c => ({ label: c, value: c }));
        if (requestedContainer && this.containerOptions.some(c => c.value === requestedContainer)) {
          this.selectedContainer = requestedContainer;
        }
        this.loadingContainers = false;
        if (autoFetch) this.fetchLogs();
      },
      error: () => {
        this.loadingContainers = false;
        this.errorMessage = 'Unable to load container list. Logs can still be fetched for all containers.';
        if (autoFetch) this.fetchLogs();
      },
    });
  }

  onLevelChange(v: string) {
    this.levelFilter = v as 'all' | 'error' | 'warn' | 'context';
    this.filterLines();
  }

  onSearchChange(value: string) {
    this.searchQuery = value;
    this.filterLines();
  }

  clearFilters() {
    this.levelFilter = 'all';
    this.searchQuery = '';
    this.filterLines();
  }

  retry() {
    if (this.podOptions.length === 0) {
      this.loadPods();
    } else if (this.selectedPod) {
      this.fetchLogs();
    }
  }

  fetchLogs() {
    if (!this.selectedPod) return;
    this.stopStream();
    this.currentErrorNavIndex = -1;
    this.loadingLogs = true;
    this.errorMessage = '';
    this.api.getLogs(this.selectedPod, this.tailSize, false, this.selectedContainer || undefined).subscribe({
      next: res => {
        this.lines = res.lines;
        this.fetched = true;
        this.loadingLogs = false;
        this.filterLines();
      },
      error: () => {
        this.loadingLogs = false;
        this.fetched = true;
        this.errorMessage = `Unable to fetch logs for ${this.selectedPod}. Retry the request or choose another pod.`;
      },
    });
  }

  toggleLive() {
    if (this.streaming) { this.stopStream(); return; }
    if (!this.selectedPod) return;
    this.stopWatch();
    this.streaming = true;
    this.followStream = true;
    this.fetched = true;
    this.errorMessage = '';
    this.lines = [];
    this.filteredLines = [];
    this.filteredLineIndices = [];
    const cp = this.selectedContainer ? `?container=${encodeURIComponent(this.selectedContainer)}` : '';
    const conn = this.ws.connect(`/ws/logs/${this.selectedPod}${cp}`);
    this.streamClose = conn.close;
    this.streamSub = conn.messages$.subscribe({
      next: line => {
        this.lines.push(line);
        this.filterLines();
        if (this.followStream) setTimeout(() => this.scrollBottom(), 30);
      },
      error: () => {
        this.streaming = false;
        this.errorMessage = 'Live log stream disconnected. Fetch logs or start the stream again.';
      },
    });
  }

  toggleWatch() {
    if (this.watching) { this.stopWatch(); return; }
    if (!this.selectedPod) return;
    this.stopStream();
    this.watching = true;
    this.fetchLogs();
    this.watchTimer = setInterval(() => this.fetchLogs(), this.watchInterval * 1000);
  }

  toggleFollow() {
    this.followStream = !this.followStream;
    if (this.followStream) this.scrollBottom();
  }

  filterLines() {
    let indices = this.lines.map((_, index) => index);
    if (this.levelFilter === 'error') {
      indices = indices.filter(index => this.isError(this.lines[index]));
    } else if (this.levelFilter === 'warn') {
      indices = indices.filter(index => this.isWarn(this.lines[index]));
    } else if (this.levelFilter === 'context') {
      indices = this.buildContextIndices();
    }

    let result = indices.map(index => index < 0 ? '--- gap ---' : this.lines[index]);
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      const matching = result.map((line, index) => ({ line, index }))
        .filter(item => item.line.toLowerCase().includes(q));
      result = matching.map(item => item.line);
      indices = matching.map(item => indices[item.index]);
    }

    this.filteredLines = result;
    this.filteredLineIndices = indices;
  }

  /** Context mode - show N lines before/after each error */
  private buildContextView(): string[] {
    return this.buildContextIndices().map(index => index < 0 ? '--- gap ---' : this.lines[index]);
  }

  private buildContextIndices(): number[] {
    const included = new Set<number>();
    for (let i = 0; i < this.lines.length; i++) {
      if (this.isError(this.lines[i])) {
        const start = Math.max(0, i - this.contextLines);
        const end = Math.min(this.lines.length - 1, i + this.contextLines);
        for (let j = start; j <= end; j++) included.add(j);
      }
    }

    const result: number[] = [];
    let lastIncluded = -2;
    for (const index of [...included].sort((a, b) => a - b)) {
      if (index > lastIncluded + 1 && lastIncluded >= 0) result.push(-1);
      result.push(index);
      lastIncluded = index;
    }
    return result;
  }

  /** Jump to first error */
  jumpToFirstError() {
    this.currentErrorNavIndex = 0;
    this.scrollToError(0);
  }

  /** Jump to next error */
  jumpToNextError() {
    if (this.errorIndices.length === 0) return;
    this.currentErrorNavIndex = (this.currentErrorNavIndex + 1) % this.errorIndices.length;
    this.scrollToError(this.currentErrorNavIndex);
  }

  /** Jump to prev error */
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
      const lineElements = viewer?.querySelectorAll('.log-line');
      const target = lineElements?.[lineIdx] as HTMLElement | undefined;
      if (target) {
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
        target.classList.add('line-highlight');
        setTimeout(() => target.classList.remove('line-highlight'), 2000);
      }
    }, 50);
  }

  /** Jump to specific error from summary */
  jumpToErrorAt(originalIndex: number) {
    const filteredIdx = this.filteredLineIndices.indexOf(originalIndex);
    if (filteredIdx < 0) return;
    const navIdx = this.errorIndices.indexOf(filteredIdx);
    if (navIdx >= 0) {
      this.currentErrorNavIndex = navIdx;
      this.scrollToError(navIdx);
    }
  }

  scrollBottom() {
    const viewer = this.logEl?.nativeElement?.querySelector('.log-viewer');
    if (viewer) viewer.scrollTop = viewer.scrollHeight;
  }

  async copyLogs() {
    if (!this.filteredLines.length) return;
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(this.filteredLines.join('\n'));
      this.showNotice(`${this.filteredLines.length} lines copied`);
    } catch {
      this.showNotice('Clipboard unavailable. Select and copy the log text manually.');
    }
  }

  downloadLogs() {
    if (!this.filteredLines.length) return;
    const blob = new Blob([this.filteredLines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.selectedPod || 'logs'}-${new Date().toISOString().slice(0, 19)}.log`;
    a.click();
    URL.revokeObjectURL(url);
    this.showNotice(`${this.filteredLines.length} lines downloaded`);
  }

  private showNotice(message: string) {
    this.actionNotice = message;
    clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => this.actionNotice = '', 3500);
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
    const lower = line.toLowerCase();
    const markers = ['error:', 'fatal:', 'panic:', 'err ', 'error ', 'exception:'];
    for (const marker of markers) {
      const index = lower.indexOf(marker);
      if (index >= 0) {
        const rest = line.substring(index + marker.length).trim();
        return rest.length > 60 ? rest.substring(0, 60) + '...' : rest;
      }
    }
    return line.length > 60 ? line.substring(line.length - 60) : line;
  }

  private stopStream() {
    this.streaming = false;
    this.streamSub?.unsubscribe();
    this.streamClose?.();
    this.streamSub = null;
    this.streamClose = null;
  }

  private stopWatch() {
    this.watching = false;
    if (this.watchTimer) {
      clearInterval(this.watchTimer);
      this.watchTimer = null;
    }
  }
}
