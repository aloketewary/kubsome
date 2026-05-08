import { Component, inject, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { Select } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { WsService } from '../../core/services/ws.service';
import { Pod } from '../../core/models';

@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [ButtonModule, Select, TooltipModule, FormsModule, InputTextModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Logs</h1>
        <p class="subtitle">Pod log viewer</p>
      </div>
    </div>

    <!-- Controls Bar -->
    <div class="controls-bar">
      <div class="controls-left">
        <p-select [options]="podOptions" [(ngModel)]="selectedPod" placeholder="Select pod..."
                  [style]="{ width: '280px' }" [filter]="true" optionLabel="label" optionValue="value" />
        <div class="tail-control">
          <span class="tail-label">Lines:</span>
          @for (t of tailOptions; track t) {
            <button class="tail-btn" [class.active]="tailSize === t" (click)="tailSize = t">{{ t }}</button>
          }
        </div>
      </div>
      <div class="controls-right">
        <button pButton icon="pi pi-download" label="Fetch" class="p-button-sm" (click)="fetchLogs()" [disabled]="!selectedPod"></button>
        <button pButton [icon]="streaming ? 'pi pi-stop' : 'pi pi-play'" [label]="streaming ? 'Stop' : 'Live'"
                [class]="streaming ? 'p-button-sm p-button-danger' : 'p-button-sm p-button-success'" (click)="toggleLive()" [disabled]="!selectedPod"></button>
      </div>
    </div>

    <!-- Log Toolbar -->
    @if (lines.length > 0 || streaming) {
      <div class="log-toolbar">
        <div class="toolbar-stats">
          <span class="stat">{{ lines.length }} lines</span>
          @if (errorCount > 0) {
            <span class="stat stat-error">{{ errorCount }} errors</span>
          }
          @if (streaming) {
            <span class="stat stat-live"><span class="live-dot"></span> Streaming</span>
          }
        </div>
        <div class="toolbar-actions">
          <div class="search-inline">
            <i class="pi pi-search"></i>
            <input [(ngModel)]="searchQuery" placeholder="Search logs..." (ngModelChange)="filterLines()" />
            @if (searchQuery) {
              <span class="search-count">{{ filteredLines.length }} matches</span>
            }
          </div>
          <div class="filter-pills">
            <button class="fpill" [class.active]="levelFilter === 'all'" (click)="levelFilter = 'all'; filterLines()">All</button>
            <button class="fpill fpill-err" [class.active]="levelFilter === 'error'" (click)="levelFilter = 'error'; filterLines()">Errors</button>
            <button class="fpill fpill-warn" [class.active]="levelFilter === 'warn'" (click)="levelFilter = 'warn'; filterLines()">Warn</button>
          </div>
          <button pButton icon="pi pi-arrow-down" class="p-button-sm p-button-text p-button-rounded" pTooltip="Scroll to bottom" (click)="scrollBottom()"></button>
          <button pButton icon="pi pi-copy" class="p-button-sm p-button-text p-button-rounded" pTooltip="Copy all" (click)="copyLogs()"></button>
        </div>
      </div>
    }

    <!-- Log Viewer -->
    <div class="log-container" #logEl>
      @if (filteredLines.length > 0) {
        <div class="log-viewer">
          @for (line of filteredLines; track $index) {
            <div class="log-line" [class]="lineClass(line)">
              <span class="line-num">{{ $index + 1 }}</span>
              <span class="line-level">{{ lineLevel(line) }}</span>
              <span class="line-text">{{ line }}</span>
            </div>
          }
        </div>
      } @else if (lines.length > 0 && searchQuery) {
        <div class="log-empty"><i class="pi pi-search"></i> No lines matching "{{ searchQuery }}"</div>
      } @else if (fetched && lines.length === 0) {
        <div class="log-empty"><i class="pi pi-inbox"></i> No log output</div>
      } @else if (!fetched && !streaming) {
        <div class="log-empty">
          <i class="pi pi-terminal"></i>
          <span>Select a pod and fetch or stream logs</span>
          <span class="empty-hint">Tip: Use "Live" for real-time streaming via WebSocket</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

    /* Controls */
    .controls-bar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px; margin-bottom: 12px;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-sm);
    }
    .controls-left, .controls-right { display: flex; align-items: center; gap: 12px; }
    .tail-control { display: flex; align-items: center; gap: 4px; }
    .tail-label { font-size: 11px; color: var(--text-muted); margin-right: 4px; }
    .tail-btn {
      padding: 3px 8px; border: 1px solid var(--border); border-radius: 4px;
      background: var(--bg-elevated); color: var(--text-muted); font-size: 11px;
      cursor: pointer; transition: all 0.12s;
    }
    .tail-btn.active { border-color: var(--accent); background: var(--accent-subtle); color: var(--accent); }
    .tail-btn:hover:not(.active) { border-color: var(--border-hover); color: var(--text); }

    /* Toolbar */
    .log-toolbar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 16px; margin-bottom: 0;
      background: var(--bg-elevated); border: 1px solid var(--border);
      border-radius: var(--radius-sm) var(--radius-sm) 0 0; border-bottom: none;
    }
    .toolbar-stats { display: flex; gap: 12px; }
    .stat { font-size: 11px; color: var(--text-muted); }
    .stat-error { color: var(--danger); font-weight: 600; }
    .stat-live { display: flex; align-items: center; gap: 5px; color: var(--success); font-weight: 500; }
    .live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--success); animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
    .toolbar-actions { display: flex; align-items: center; gap: 8px; }
    .search-inline {
      position: relative; display: flex; align-items: center;
    }
    .search-inline i { position: absolute; left: 8px; font-size: 11px; color: var(--text-muted); }
    .search-inline input {
      padding: 4px 8px 4px 26px; width: 160px;
      background: var(--bg); border: 1px solid var(--border); border-radius: 4px;
      color: var(--text); font-size: 11px; outline: none;
    }
    .search-inline input:focus { border-color: var(--accent); }
    .search-count { font-size: 10px; color: var(--text-muted); margin-left: 6px; }
    .filter-pills { display: flex; gap: 2px; }
    .fpill {
      padding: 3px 8px; border: 1px solid var(--border); border-radius: 4px;
      background: transparent; color: var(--text-muted); font-size: 10px;
      cursor: pointer; transition: all 0.12s;
    }
    .fpill.active { border-color: var(--accent); color: var(--accent); background: var(--accent-subtle); }
    .fpill-err.active { border-color: var(--danger); color: var(--danger); background: var(--danger-subtle); }
    .fpill-warn.active { border-color: var(--warning); color: var(--warning); background: var(--warning-subtle); }

    /* Log Container */
    .log-container {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 0 0 var(--radius-sm) var(--radius-sm);
      overflow: hidden;
    }
    .log-viewer {
      max-height: calc(100vh - 320px); overflow-y: auto; padding: 8px 0;
      font-family: 'JetBrains Mono', monospace; font-size: 11px; line-height: 1.7;
    }
    .log-line { display: flex; gap: 0; padding: 0 12px; align-items: flex-start; }
    .log-line:hover { background: var(--bg-hover); }
    .line-num { color: var(--text-muted); min-width: 32px; text-align: right; user-select: none; opacity: 0.4; padding-right: 8px; }
    .line-level {
      min-width: 36px; font-size: 9px; font-weight: 600; text-transform: uppercase;
      padding: 1px 0; text-align: center; letter-spacing: 0.03em;
    }
    .line-text { white-space: pre-wrap; word-break: break-all; padding-left: 8px; }

    /* Level colors */
    .log-line.level-error { background: var(--danger-subtle); }
    .log-line.level-error .line-level { color: var(--danger); }
    .log-line.level-error .line-text { color: var(--danger); }
    .log-line.level-warn .line-level { color: var(--warning); }
    .log-line.level-info .line-level { color: var(--text-muted); }
    .log-line.level-debug .line-level { color: var(--accent); }
    .log-line.level-default .line-text { color: var(--text-secondary); }

    .log-empty {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      padding: 56px; color: var(--text-muted); font-size: 13px;
    }
    .log-empty i { font-size: 24px; opacity: 0.3; }
    .empty-hint { font-size: 11px; opacity: 0.6; }
  `],
})
export class LogsComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private ws = inject(WsService);

  @ViewChild('logEl') logEl!: ElementRef;

  podOptions: { label: string; value: string }[] = [];
  selectedPod = '';
  tailSize = 200;
  tailOptions = [50, 100, 200, 500];
  lines: string[] = [];
  filteredLines: string[] = [];
  fetched = false;
  streaming = false;
  searchQuery = '';
  levelFilter: 'all' | 'error' | 'warn' = 'all';

  private streamSub: Subscription | null = null;
  private streamClose: (() => void) | null = null;

  get errorCount() { return this.lines.filter(l => this.isError(l)).length; }

  ngOnInit() {
    this.api.getPods().subscribe(res => {
      this.podOptions = res.pods.map(p => ({
        label: `${p.status === 'Running' ? '●' : '○'} ${p.name}`,
        value: p.name,
      }));
    });
  }

  ngOnDestroy() { this.stopStream(); }

  fetchLogs() {
    if (!this.selectedPod) return;
    this.stopStream();
    this.api.getLogs(this.selectedPod, this.tailSize, this.levelFilter === 'error').subscribe(res => {
      this.lines = res.lines;
      this.fetched = true;
      this.filterLines();
    });
  }

  toggleLive() {
    if (this.streaming) { this.stopStream(); return; }
    if (!this.selectedPod) return;
    this.streaming = true;
    this.lines = [];
    this.filteredLines = [];
    const conn = this.ws.connect(`/ws/logs/${this.selectedPod}`);
    this.streamClose = conn.close;
    this.streamSub = conn.messages$.subscribe(line => {
      this.lines.push(line);
      if (this.matchesFilter(line)) {
        this.filteredLines = [...this.filteredLines, line];
      }
      setTimeout(() => this.scrollBottom(), 30);
    });
  }

  filterLines() {
    let result = this.lines;
    if (this.levelFilter === 'error') result = result.filter(l => this.isError(l));
    if (this.levelFilter === 'warn') result = result.filter(l => this.isWarn(l));
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(l => l.toLowerCase().includes(q));
    }
    this.filteredLines = result;
  }

  private matchesFilter(line: string): boolean {
    if (this.levelFilter === 'error' && !this.isError(line)) return false;
    if (this.levelFilter === 'warn' && !this.isWarn(line)) return false;
    if (this.searchQuery && !line.toLowerCase().includes(this.searchQuery.toLowerCase())) return false;
    return true;
  }

  scrollBottom() {
    const viewer = this.logEl?.nativeElement?.querySelector('.log-viewer');
    if (viewer) viewer.scrollTop = viewer.scrollHeight;
  }

  copyLogs() {
    navigator.clipboard.writeText(this.filteredLines.join('\n'));
  }

  lineClass(line: string): string {
    if (this.isError(line)) return 'level-error';
    if (this.isWarn(line)) return 'level-warn';
    if (line.toLowerCase().includes('debug')) return 'level-debug';
    if (line.toLowerCase().includes('info')) return 'level-info';
    return 'level-default';
  }

  lineLevel(line: string): string {
    const l = line.toLowerCase();
    if (l.includes('error') || l.includes('fatal') || l.includes('panic')) return 'ERR';
    if (l.includes('warn')) return 'WRN';
    if (l.includes('debug')) return 'DBG';
    if (l.includes('info')) return 'INF';
    return '';
  }

  private isError(line: string): boolean {
    const l = line.toLowerCase();
    return l.includes('error') || l.includes('fatal') || l.includes('panic');
  }

  private isWarn(line: string): boolean {
    return line.toLowerCase().includes('warn');
  }

  private stopStream() {
    this.streaming = false;
    this.streamSub?.unsubscribe();
    this.streamClose?.();
    this.streamSub = null;
    this.streamClose = null;
  }
}
