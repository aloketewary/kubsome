import { Component, inject, Input, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { JsonPipe } from '@angular/common';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { ApiService } from '../../core/services/api.service';
import { WsService } from '../../core/services/ws.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-pod-drawer',
  standalone: true,
  imports: [FormsModule, JsonPipe, TagModule, ButtonModule],
  template: `
    @if (podName) {
      <div class="drawer-overlay" (click)="close()"></div>
      <aside class="drawer">
        <div class="drawer-header">
          <div class="drawer-title">
            <code class="mono">{{ podName }}</code>
            <p-tag [value]="podStatus" [severity]="podStatus === 'Running' ? 'success' : 'danger'" />
          </div>
          <button pButton icon="pi pi-times" class="p-button-text p-button-sm" (click)="close()"></button>
        </div>

        <!-- Tabs -->
        <div class="drawer-tabs">
          @for (tab of tabs; track tab.id) {
            <button class="tab-btn" [class.active]="activeTab === tab.id" (click)="switchTab(tab.id)">
              <i [class]="tab.icon"></i>
              {{ tab.label }}
            </button>
          }
        </div>

        <!-- Tab Content -->
        <div class="drawer-content">
          @if (activeTab === 'logs') {
            <div class="tab-actions">
              <button pButton icon="pi pi-play" label="Live" class="p-button-sm p-button-text"
                      [class.p-button-success]="streaming" (click)="toggleLiveStream()"></button>
            </div>
            <div class="log-viewer">
              @for (line of logLines; track $index) {
                <div class="log-line" [class.error-line]="isError(line)">{{ line }}</div>
              }
              @if (logLines.length === 0) {
                <div class="tab-empty">No logs</div>
              }
            </div>
          }

          @if (activeTab === 'events') {
            <div class="events-list">
              @for (ev of events; track $index) {
                <div class="event-item">
                  <span class="ev-dot" [class.warn]="ev.type === 'Warning'"></span>
                  <span class="ev-reason">{{ ev.reason }}</span>
                  <span class="ev-msg">{{ ev.message }}</span>
                </div>
              }
              @if (events.length === 0) {
                <div class="tab-empty">No events for this pod</div>
              }
            </div>
          }

          @if (activeTab === 'info') {
            <pre class="info-output">{{ inspectData | json }}</pre>
          }

          @if (activeTab === 'diagnose') {
            @if (findings.length > 0) {
              @for (f of findings; track $index) {
                <div class="finding" [class]="'finding-' + f.severity">
                  <div class="finding-head">
                    <p-tag [value]="f.severity" [severity]="f.severity === 'critical' ? 'danger' : 'warn'" />
                    <strong>{{ f.title }}</strong>
                  </div>
                  <p class="finding-detail">{{ f.detail }}</p>
                  <p class="finding-action">→ {{ f.action }}</p>
                </div>
              }
            } @else if (diagnoseDone) {
              <div class="tab-empty healthy">
                <i class="pi pi-check-circle"></i>
                Pod appears healthy
              </div>
            } @else {
              <div class="tab-empty"><i class="pi pi-spin pi-spinner"></i> Analyzing...</div>
            }
          }
        </div>
      </aside>
    }
  `,
  styles: [`
    .drawer-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      z-index: 1100;
    }
    .drawer {
      position: fixed;
      top: 0;
      right: 0;
      width: 520px;
      height: 100vh;
      background: var(--bg-card);
      border-left: 1px solid var(--border);
      z-index: 1200;
      display: flex;
      flex-direction: column;
      animation: slideIn 0.2s ease-out;
    }
    @keyframes slideIn {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }
    .drawer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
    }
    .drawer-title {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .drawer-title code { font-size: 14px; font-weight: 600; }

    .drawer-tabs {
      display: flex;
      border-bottom: 1px solid var(--border);
      padding: 0 12px;
    }
    .tab-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px 14px;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--text-muted);
      font-size: 12px;
      cursor: pointer;
      transition: all 0.12s;
    }
    .tab-btn:hover { color: var(--text); }
    .tab-btn.active {
      color: var(--accent);
      border-bottom-color: var(--accent);
    }
    .tab-btn i { font-size: 13px; }

    .drawer-content {
      flex: 1;
      overflow-y: auto;
      padding: 16px 20px;
    }
    .tab-actions {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 8px;
    }
    .log-viewer {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      line-height: 1.7;
      max-height: calc(100vh - 200px);
      overflow-y: auto;
    }
    .log-line { padding: 1px 0; }
    .error-line { color: var(--danger); }
    .tab-empty {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 40px;
      color: var(--text-muted);
      font-size: 13px;
    }
    .tab-empty.healthy { color: var(--success); }

    .events-list { display: flex; flex-direction: column; gap: 6px; }
    .event-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 8px 0;
      border-bottom: 1px solid var(--border);
      font-size: 12px;
    }
    .ev-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--accent); margin-top: 5px; flex-shrink: 0;
    }
    .ev-dot.warn { background: var(--warning); }
    .ev-reason { font-weight: 500; white-space: nowrap; }
    .ev-msg { color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; }

    .info-output {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      white-space: pre-wrap;
      background: var(--bg-elevated);
      padding: 12px;
      border-radius: 8px;
      max-height: calc(100vh - 200px);
      overflow-y: auto;
    }

    .finding {
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 8px;
      border: 1px solid var(--border);
    }
    .finding-critical { border-left: 3px solid var(--danger); }
    .finding-warning { border-left: 3px solid var(--warning); }
    .finding-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .finding-detail { font-size: 12px; color: var(--text-secondary); margin: 2px 0; }
    .finding-action { font-size: 11px; color: var(--text-muted); margin: 2px 0; }
  `],
})
export class PodDrawerComponent {
  private api = inject(ApiService);
  private ws = inject(WsService);

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
  private streamSub: Subscription | null = null;
  private streamClose: (() => void) | null = null;

  switchTab(tab: string) {
    this.activeTab = tab;
    if (tab === 'logs' && this.logLines.length === 0) this.loadLogs();
    if (tab === 'events' && this.events.length === 0) this.loadEvents();
    if (tab === 'info' && !this.inspectData) this.loadInfo();
    if (tab === 'diagnose' && !this.diagnoseDone && this.findings.length === 0) this.loadDiagnose();
  }

  ngOnChanges() {
    if (this.podName) {
      this.reset();
      this.loadLogs();
    }
  }

  close() {
    this.stopStream();
    this.closed.emit();
  }

  toggleLiveStream() {
    if (this.streaming) {
      this.stopStream();
    } else {
      this.streaming = true;
      const conn = this.ws.connect(`/ws/logs/${this.podName}`);
      this.streamClose = conn.close;
      this.streamSub = conn.messages$.subscribe(line => {
        this.logLines = [...this.logLines, line];
      });
    }
  }

  isError(line: string): boolean {
    const l = line.toLowerCase();
    return l.includes('error') || l.includes('fatal') || l.includes('panic');
  }

  private loadLogs() {
    this.api.getLogs(this.podName, 100).subscribe(res => (this.logLines = res.lines));
  }

  private loadEvents() {
    this.api.inspect(this.podName).subscribe(res => (this.events = res.events || []));
  }

  private loadInfo() {
    this.api.inspect(this.podName).subscribe(res => (this.inspectData = res.details));
  }

  private loadDiagnose() {
    this.api.diagnose(this.podName).subscribe(res => {
      this.findings = res.findings;
      this.diagnoseDone = true;
    });
  }

  private stopStream() {
    this.streaming = false;
    this.streamSub?.unsubscribe();
    this.streamClose?.();
    this.streamSub = null;
    this.streamClose = null;
  }

  private reset() {
    this.stopStream();
    this.logLines = [];
    this.events = [];
    this.inspectData = null;
    this.findings = [];
    this.diagnoseDone = false;
    this.activeTab = 'logs';
  }
}
