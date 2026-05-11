import { Component, inject, Input, Output, EventEmitter, OnChanges, SimpleChanges, ViewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { JsonPipe } from '@angular/common';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ApiService } from '../../core/services/api.service';
import { WsService } from '../../core/services/ws.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-pod-drawer',
  standalone: true,
  imports: [FormsModule, JsonPipe, TagModule, ButtonModule, TooltipModule],
  template: `
    @if (podName) {
      <div class="drawer-overlay" (click)="close()"></div>
      <aside class="drawer">
        <!-- Rich Header -->
        <div class="drawer-header">
          <div class="header-top">
            <div class="header-status">
              <span class="status-dot" [class.running]="podStatus === 'Running'" [class.error]="podStatus !== 'Running' && podStatus !== 'Pending'" [class.pending]="podStatus === 'Pending'"></span>
              <p-tag [value]="podStatus" [severity]="podStatus === 'Running' ? 'success' : podStatus === 'Pending' ? 'warn' : 'danger'" />
            </div>
            <button pButton icon="pi pi-times" class="p-button-text p-button-sm p-button-rounded" (click)="close()"></button>
          </div>
          <div class="header-name">
            <code>{{ podName }}</code>
            <i class="pi pi-copy copy-icon" pTooltip="Copy name" (click)="copyName()"
               aria-label="Copy pod name" tabindex="0" role="button"
               (keydown.enter)="$event.stopPropagation(); copyName()"
               (keydown.space)="$event.preventDefault(); $event.stopPropagation(); copyName()"></i>
          </div>
          @if (podMeta) {
            <div class="header-meta">
              <span class="meta-item"><i class="pi pi-server"></i> {{ podMeta.node }}</span>
              <span class="meta-item"><i class="pi pi-clock"></i> {{ podMeta.age }}</span>
              <span class="meta-item"><i class="pi pi-globe"></i> {{ podMeta.ip }}</span>
            </div>
          }
        </div>

        <!-- Tabs with badges -->
        <div class="drawer-tabs">
          @for (tab of tabs; track tab.id) {
            <button class="tab-btn" [class.active]="activeTab === tab.id" (click)="switchTab(tab.id)">
              <i [class]="tab.icon"></i>
              {{ tab.label }}
              @if (tab.id === 'logs' && logLines.length > 0) {
                <span class="tab-badge">{{ logLines.length }}</span>
              }
              @if (tab.id === 'events' && events.length > 0) {
                <span class="tab-badge">{{ events.length }}</span>
              }
              @if (tab.id === 'diagnose' && findings.length > 0) {
                <span class="tab-badge warn">{{ findings.length }}</span>
              }
            </button>
          }
        </div>

        <!-- Content -->
        <div class="drawer-content">
          <!-- LOGS TAB -->
          @if (activeTab === 'logs') {
            <div class="logs-toolbar">
              <span class="logs-count">{{ logLines.length }} lines</span>
              <div class="logs-actions">
                <button pButton [icon]="streaming ? 'pi pi-stop' : 'pi pi-play'" [label]="streaming ? 'Stop' : 'Live'"
                        class="p-button-sm p-button-text" [class.p-button-success]="streaming" (click)="toggleLiveStream()"></button>
                <button pButton icon="pi pi-arrow-down" class="p-button-sm p-button-text" pTooltip="Scroll to bottom" (click)="scrollToBottom()"></button>
              </div>
            </div>
            <div class="log-viewer" #logContainer>
              @for (line of logLines; track $index) {
                <div class="log-line" [class.error-line]="isError(line)">
                  <span class="line-num">{{ $index + 1 }}</span>
                  <span class="line-text">{{ line }}</span>
                </div>
              }
              @if (logLines.length === 0) {
                <div class="tab-empty"><i class="pi pi-terminal"></i> No logs available</div>
              }
            </div>
          }

          <!-- EVENTS TAB -->
          @if (activeTab === 'events') {
            <div class="events-timeline">
              @for (ev of events; track $index) {
                <div class="ev-item">
                  <div class="ev-marker">
                    <div class="ev-dot" [class.ev-warn]="ev.type === 'Warning'" [class.ev-normal]="ev.type !== 'Warning'"></div>
                    @if ($index < events.length - 1) { <div class="ev-line"></div> }
                  </div>
                  <div class="ev-content">
                    <div class="ev-header">
                      <span class="ev-reason">{{ ev.reason }}</span>
                      <span class="ev-time">{{ ev.last_seen || '' }}</span>
                    </div>
                    <p class="ev-message">{{ ev.message }}</p>
                    @if (ev.count > 1) {
                      <span class="ev-count">{{ ev.count }}× repeated</span>
                    }
                  </div>
                </div>
              }
              @if (events.length === 0) {
                <div class="tab-empty"><i class="pi pi-check-circle"></i> No events</div>
              }
            </div>
          }

          <!-- INFO TAB -->
          @if (activeTab === 'info') {
            @if (inspectData) {
              <div class="info-grid">
                <div class="info-section">
                  <h4>Pod</h4>
                  <div class="info-row"><span class="info-key">Name</span><code class="info-val">{{ inspectData.name }}</code></div>
                  <div class="info-row"><span class="info-key">Namespace</span><code class="info-val">{{ inspectData.namespace }}</code></div>
                  <div class="info-row"><span class="info-key">Node</span><code class="info-val">{{ inspectData.node }}</code></div>
                  <div class="info-row"><span class="info-key">Pod IP</span><code class="info-val">{{ inspectData.pod_ip }}</code></div>
                  <div class="info-row"><span class="info-key">Phase</span><p-tag [value]="inspectData.phase" [severity]="inspectData.phase === 'Running' ? 'success' : 'warn'" /></div>
                  <div class="info-row"><span class="info-key">Age</span><span class="info-val">{{ inspectData.age }}</span></div>
                  <div class="info-row"><span class="info-key">Restart Policy</span><span class="info-val">{{ inspectData.restart_policy }}</span></div>
                  <div class="info-row"><span class="info-key">Service Account</span><code class="info-val">{{ inspectData.service_account }}</code></div>
                </div>

                @if (inspectData.containers?.length > 0) {
                  <div class="info-section">
                    <h4>Containers</h4>
                    @for (c of inspectData.containers; track c.name) {
                      <div class="container-card">
                        <div class="container-header">
                          <span class="container-name">{{ c.name }}</span>
                          <p-tag [value]="c.state" [severity]="c.state === 'running' ? 'success' : 'danger'" />
                        </div>
                        <div class="info-row"><span class="info-key">Image</span><code class="info-val img">{{ c.image }}</code></div>
                        <div class="info-row"><span class="info-key">Restarts</span><span class="info-val" [class.danger-text]="c.restarts > 5">{{ c.restarts }}</span></div>
                        @if (c.ports?.length > 0) {
                          <div class="info-row"><span class="info-key">Ports</span><span class="info-val">{{ c.ports.join(', ') }}</span></div>
                        }
                      </div>
                    }
                  </div>
                }

                @if (inspectData.labels && objectKeys(inspectData.labels).length > 0) {
                  <div class="info-section">
                    <h4>Labels</h4>
                    <div class="labels-wrap">
                      @for (key of objectKeys(inspectData.labels); track key) {
                        <span class="label-chip">{{ key }}={{ inspectData.labels[key] }}</span>
                      }
                    </div>
                  </div>
                }
              </div>
            } @else {
              <div class="tab-empty"><i class="pi pi-spin pi-spinner"></i> Loading...</div>
            }
          }

          <!-- DIAGNOSE TAB -->
          @if (activeTab === 'diagnose') {
            @if (findings.length > 0) {
              @for (f of findings; track $index) {
                <div class="finding" [class]="'finding-' + f.severity">
                  <div class="finding-head">
                    <p-tag [value]="f.severity" [severity]="f.severity === 'critical' ? 'danger' : 'warn'" />
                    <strong>{{ f.title }}</strong>
                  </div>
                  <p class="finding-detail">{{ f.detail }}</p>
                  <p class="finding-action"><i class="pi pi-arrow-right"></i> {{ f.action }}</p>
                </div>
              }
            } @else if (diagnoseDone) {
              <div class="tab-empty healthy"><i class="pi pi-check-circle"></i> Pod appears healthy — no issues detected</div>
            } @else {
              <div class="tab-empty"><i class="pi pi-spin pi-spinner"></i> Running diagnostics...</div>
            }
          }
        </div>
      </aside>
    }
  `,
  styles: [`
    .drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(2px); z-index: 1100; }
    .drawer {
      position: fixed; top: 0; right: 0; width: 580px; height: 100vh;
      background: var(--bg); border-left: 1px solid var(--border);
      z-index: 1200; display: flex; flex-direction: column;
      animation: slideIn 0.2s ease-out; box-shadow: -8px 0 30px rgba(0,0,0,0.3);
    }
    @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }

    /* Header */
    .drawer-header { padding: 20px; border-bottom: 1px solid var(--border); background: var(--bg-card); }
    .header-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .header-status { display: flex; align-items: center; gap: 8px; }
    .status-dot { width: 10px; height: 10px; border-radius: 50%; }
    .status-dot.running { background: var(--success); box-shadow: 0 0 8px var(--success); }
    .status-dot.pending { background: var(--warning); animation: pulse 2s infinite; }
    .status-dot.error { background: var(--danger); box-shadow: 0 0 8px var(--danger); }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
    .header-name { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .header-name code { font-size: 15px; font-weight: 600; }
    .copy-icon { font-size: 12px; color: var(--text-muted); cursor: pointer; padding: 4px; border-radius: 4px; }
    .copy-icon:hover { color: var(--accent); background: var(--accent-subtle); }
    .header-meta { display: flex; gap: 16px; }
    .meta-item { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--text-muted); }
    .meta-item i { font-size: 11px; }

    /* Tabs */
    .drawer-tabs { display: flex; border-bottom: 1px solid var(--border); padding: 0 16px; background: var(--bg-card); }
    .tab-btn {
      display: flex; align-items: center; gap: 6px;
      padding: 12px 14px; background: none; border: none;
      border-bottom: 2px solid transparent; color: var(--text-muted);
      font-size: 12px; cursor: pointer; transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
    }
    .tab-btn:hover { color: var(--text); }
    .tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); }
    .tab-btn i { font-size: 13px; }
    .tab-badge {
      font-size: 10px; font-weight: 600; padding: 1px 5px;
      border-radius: 8px; background: var(--bg-elevated); color: var(--text-muted);
    }
    .tab-badge.warn { background: var(--warning-subtle); color: var(--warning); }

    /* Content */
    .drawer-content { flex: 1; overflow-y: auto; padding: 16px 20px; }
    .tab-empty {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      padding: 48px; color: var(--text-muted); font-size: 13px;
    }
    .tab-empty i { font-size: 20px; opacity: 0.5; }
    .tab-empty.healthy { color: var(--success); }
    .tab-empty.healthy i { opacity: 1; }

    /* Logs */
    .logs-toolbar {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--border);
    }
    .logs-count { font-size: 11px; color: var(--text-muted); }
    .logs-actions { display: flex; gap: 4px; }
    .log-viewer {
      font-family: 'JetBrains Mono', monospace; font-size: 11px;
      line-height: 1.7; max-height: calc(100vh - 260px); overflow-y: auto;
      background: var(--bg-elevated); border-radius: 8px; padding: 8px 0;
    }
    .log-line { display: flex; gap: 8px; padding: 0 12px; }
    .log-line:hover { background: var(--bg-hover); }
    .error-line { background: var(--danger-subtle); color: var(--danger); }
    .line-num { color: var(--text-muted); min-width: 28px; text-align: right; user-select: none; opacity: 0.5; }
    .line-text { white-space: pre-wrap; word-break: break-all; }

    /* Events Timeline */
    .events-timeline { padding-left: 8px; }
    .ev-item { display: flex; gap: 12px; }
    .ev-marker { display: flex; flex-direction: column; align-items: center; }
    .ev-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 6px; }
    .ev-normal { background: var(--accent); }
    .ev-warn { background: var(--warning); }
    .ev-line { width: 2px; flex: 1; background: var(--border); min-height: 20px; }
    .ev-content { flex: 1; padding-bottom: 16px; }
    .ev-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
    .ev-reason { font-size: 13px; font-weight: 500; }
    .ev-time { font-size: 10px; color: var(--text-muted); font-family: 'JetBrains Mono', monospace; }
    .ev-message { font-size: 12px; color: var(--text-secondary); margin: 0; }
    .ev-count { font-size: 10px; color: var(--text-muted); margin-top: 4px; display: inline-block; }

    /* Info */
    .info-grid { display: flex; flex-direction: column; gap: 20px; }
    .info-section h4 { font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px; }
    .info-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--border); font-size: 12px; }
    .info-key { color: var(--text-muted); }
    .info-val { font-family: 'JetBrains Mono', monospace; font-size: 11px; }
    .info-val.img { max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .danger-text { color: var(--danger); font-weight: 600; }
    .container-card { background: var(--bg-elevated); border-radius: 8px; padding: 12px; margin-bottom: 8px; }
    .container-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .container-name { font-size: 13px; font-weight: 600; }
    .labels-wrap { display: flex; flex-wrap: wrap; gap: 6px; }
    .label-chip {
      font-size: 10px; font-family: 'JetBrains Mono', monospace;
      padding: 3px 8px; border-radius: 4px;
      background: var(--bg-elevated); border: 1px solid var(--border);
      color: var(--text-secondary);
    }

    /* Findings */
    .finding { padding: 14px; border-radius: 8px; margin-bottom: 8px; border: 1px solid var(--border); }
    .finding-critical { border-left: 3px solid var(--danger); background: var(--danger-subtle); }
    .finding-warning { border-left: 3px solid var(--warning); background: var(--warning-subtle); }
    .finding-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .finding-detail { font-size: 12px; color: var(--text-secondary); margin: 4px 0; }
    .finding-action { font-size: 11px; color: var(--text-muted); margin: 4px 0; display: flex; align-items: center; gap: 4px; }
    .finding-action i { font-size: 10px; }
  `],
})
export class PodDrawerComponent implements OnChanges {
  private api = inject(ApiService);
  private ws = inject(WsService);

  @ViewChild('logContainer') logContainer!: ElementRef;
  @Input() podName = '';
  @Input() podStatus = '';
  @Output() closed = new EventEmitter<void>();

  activeTab = 'logs';
  tabs = [
    { id: 'logs', icon: 'pi pi-align-left', label: 'Logs' },
    { id: 'events', icon: 'pi pi-bolt', label: 'Events' },
    { id: 'info', icon: 'pi pi-info-circle', label: 'Info' },
    { id: 'diagnose', icon: 'pi pi-exclamation-triangle', label: 'Diagnose' },
  ];

  logLines: string[] = [];
  events: any[] = [];
  inspectData: any = null;
  findings: any[] = [];
  diagnoseDone = false;
  streaming = false;
  podMeta: { node: string; age: string; ip: string } | null = null;
  private streamSub: Subscription | null = null;
  private streamClose: (() => void) | null = null;

  objectKeys(obj: any): string[] { return obj ? Object.keys(obj) : []; }

  switchTab(tab: string) {
    this.activeTab = tab;
    if (tab === 'logs' && this.logLines.length === 0) this.loadLogs();
    if (tab === 'events' && this.events.length === 0) this.loadEvents();
    if (tab === 'info' && !this.inspectData) this.loadInfo();
    if (tab === 'diagnose' && !this.diagnoseDone && this.findings.length === 0) this.loadDiagnose();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['podName'] && this.podName) {
      this.reset();
      this.loadLogs();
      this.loadMeta();
    }
  }

  close() { this.stopStream(); this.closed.emit(); }

  copyName() { navigator.clipboard.writeText(this.podName); }

  scrollToBottom() {
    const el = this.logContainer?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  toggleLiveStream() {
    if (this.streaming) { this.stopStream(); return; }
    this.streaming = true;
    const conn = this.ws.connect(`/ws/logs/${this.podName}`);
    this.streamClose = conn.close;
    this.streamSub = conn.messages$.subscribe(line => {
      this.logLines = [...this.logLines, line];
      setTimeout(() => this.scrollToBottom(), 50);
    });
  }

  isError(line: string): boolean {
    const l = line.toLowerCase();
    return l.includes('error') || l.includes('fatal') || l.includes('panic');
  }

  private loadLogs() { this.api.getLogs(this.podName, 100).subscribe(res => (this.logLines = res.lines)); }
  private loadEvents() { this.api.inspect(this.podName).subscribe(res => (this.events = res.events || [])); }
  private loadInfo() { this.api.inspect(this.podName).subscribe(res => (this.inspectData = res.details)); }
  private loadMeta() {
    this.api.inspect(this.podName).subscribe(res => {
      if (res.details) {
        this.podMeta = { node: res.details.node || 'N/A', age: res.details.age || '', ip: res.details.pod_ip || 'N/A' };
      }
    });
  }
  private loadDiagnose() { this.api.diagnose(this.podName).subscribe(res => { this.findings = res.findings; this.diagnoseDone = true; }); }
  private stopStream() { this.streaming = false; this.streamSub?.unsubscribe(); this.streamClose?.(); this.streamSub = null; this.streamClose = null; }
  private reset() { this.stopStream(); this.logLines = []; this.events = []; this.inspectData = null; this.findings = []; this.diagnoseDone = false; this.podMeta = null; this.activeTab = 'logs'; }
}
