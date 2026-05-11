import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { SlicePipe } from '@angular/common';
import { Select } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';

interface ActionEntry {
  time: string;
  action: string;
  target: string;
}

interface MonitorCard {
  id: number;
  context: string;
  namespace: string;
  app: string;
  loading: boolean;
  data: any;
  events: any[];
  activityBars: number[];
  expanded: boolean;
  lastUpdated: string;
  namespaces: string[];
  apps: string[];
  order: number;
  configuring: boolean;
  fullscreen: boolean;
  refreshInterval: number;
  alertEnabled: boolean;
  alertThreshold: number;
  actionLog: ActionEntry[];
}

@Component({
  selector: 'app-monitor',
  standalone: true,
  imports: [FormsModule, SlicePipe, Select, ButtonModule, TagModule, TooltipModule, DialogModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Monitor</h1>
        <p class="subtitle">{{ cards.length }} card{{ cards.length !== 1 ? 's' : '' }} · Multi-cluster overview</p>
      </div>
      <div class="header-actions">
        <button pButton icon="pi pi-refresh" label="Refresh All" class="p-button-sm p-button-outlined" (click)="refreshAll()"></button>
        <button pButton icon="pi pi-plus" label="Add" class="p-button-sm" (click)="addCard()"></button>
      </div>
    </div>

    <!-- Global Health Strip -->
    @if (cards.length > 0 && loadedCards > 0) {
      <div class="global-strip">
        <div class="gs-item">
          <span class="gs-val">{{ totalHealthy }}</span>
          <span class="gs-label">Healthy</span>
        </div>
        <div class="gs-item gs-warn">
          <span class="gs-val">{{ totalWarning }}</span>
          <span class="gs-label">Warning</span>
        </div>
        <div class="gs-item gs-crit">
          <span class="gs-val">{{ totalCritical }}</span>
          <span class="gs-label">Critical</span>
        </div>
        <div class="gs-bar">
          <div class="gsb-fill gsb-ok" [style.width.%]="globalHealthPct"></div>
        </div>
      </div>
    }

    <!-- Cards Grid -->
    <div class="monitor-grid">
      @for (card of cards; track card.id; let i = $index) {
        <div class="monitor-card" [class.card-critical]="isCritical(card)" [class.card-healthy]="cardHealth(card) === 'healthy'" [class.card-degraded]="cardHealth(card) === 'degraded'"
             [attr.draggable]="true" (dragstart)="onDragStart(i)" (dragover)="onDragOver($event, i)" (drop)="onDrop(i)">

          <!-- Card Toolbar -->
          <div class="mc-toolbar">
            <div class="mc-drag" pTooltip="Drag to reorder"><i class="pi pi-bars"></i></div>
            <div class="mc-badge" [class]="'badge-' + cardHealth(card)">{{ cardHealth(card) }}</div>
            <span class="mc-title">{{ card.context ? (card.context | slice:0:20) : 'New Card' }} / {{ card.namespace || '...' }}{{ card.app ? ' / ' + card.app : '' }}</span>
            <div class="mc-toolbar-actions">
              <button pButton icon="pi pi-expand" class="p-button-text p-button-sm p-button-rounded" pTooltip="Full screen" (click)="openFsDialog(card)"></button>
              <button pButton icon="pi pi-cog" class="p-button-text p-button-sm p-button-rounded" pTooltip="Configure" (click)="card.configuring = !card.configuring"></button>
              <button pButton icon="pi pi-refresh" class="p-button-text p-button-sm p-button-rounded" pTooltip="Refresh" (click)="fetchCardData(card)"></button>
              <button pButton icon="pi pi-times" class="p-button-text p-button-sm p-button-rounded p-button-danger" pTooltip="Remove" (click)="removeCard(card.id)"></button>
            </div>
          </div>

          <!-- Config Panel -->
          @if (card.configuring) {
            <div class="mc-config">
              <div class="cfg-row">
                <span class="cfg-label">Cluster</span>
                <p-select [options]="contexts" [(ngModel)]="card.context" placeholder="Select cluster..."
                          [filter]="true" [style]="{ width: '100%' }" (ngModelChange)="onContextSelect(card)" />
              </div>
              <div class="cfg-row">
                <span class="cfg-label">Namespace</span>
                <p-select [options]="card.namespaces" [(ngModel)]="card.namespace" placeholder="Select namespace..."
                          [filter]="true" [style]="{ width: '100%' }" (ngModelChange)="onNamespaceSelect(card)" />
              </div>
              <div class="cfg-row">
                <span class="cfg-label">App (optional)</span>
                <p-select [options]="card.apps" [(ngModel)]="card.app" placeholder="All apps"
                          [filter]="true" [showClear]="true" [style]="{ width: '100%' }" />
              </div>
              <div class="cfg-row">
                <span class="cfg-label">Alert</span>
                <div class="cfg-alert-row">
                  <button class="cfg-int" [class.active]="card.alertEnabled" (click)="card.alertEnabled = !card.alertEnabled">
                    {{ card.alertEnabled ? 'On' : 'Off' }}
                  </button>
                  @if (card.alertEnabled) {
                    <span class="cfg-hint">Trigger when health &lt;</span>
                    <input class="cfg-threshold" type="number" [(ngModel)]="card.alertThreshold" min="10" max="100" />
                    <span class="cfg-hint">%</span>
                  }
                </div>
              </div>
              <div class="cfg-row">
                <span class="cfg-label">Auto Refresh</span>
                <div class="cfg-intervals">
                  <button class="cfg-int" [class.active]="card.refreshInterval === 30" (click)="card.refreshInterval = 30">30s</button>
                  <button class="cfg-int" [class.active]="card.refreshInterval === 60" (click)="card.refreshInterval = 60">60s</button>
                  <button class="cfg-int" [class.active]="card.refreshInterval === 120" (click)="card.refreshInterval = 120">2m</button>
                  <button class="cfg-int" [class.active]="card.refreshInterval === 0" (click)="card.refreshInterval = 0">Off</button>
                </div>
              </div>
              <button pButton label="Apply" icon="pi pi-check" class="p-button-sm cfg-apply"
                      [disabled]="!card.context || !card.namespace" (click)="applyConfig(card)"></button>
            </div>
          }

          <!-- Data -->
          @if (card.data) {
            @if (card.data.mode === 'app') {
              <!-- App-specific View -->
              <div class="mc-app-view">
                <div class="app-replica-ring">
                  <svg viewBox="0 0 36 36">
                    <path class="ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <path class="ring-fill" [class]="ringClass(card)" [attr.stroke-dasharray]="healthPct(card) + ', 100'" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  </svg>
                  <span class="ring-val">{{ card.data.app_info?.available || 0 }}/{{ card.data.app_info?.desired || 0 }}</span>
                </div>
                <div class="app-details">
                  <div class="app-stat-row"><span class="app-stat-label">Pods</span><span class="app-stat-val">{{ card.data.pods?.total || 0 }}</span></div>
                  <div class="app-stat-row"><span class="app-stat-label">Running</span><span class="app-stat-val app-ok">{{ card.data.pods?.healthy || 0 }}</span></div>
                  <div class="app-stat-row"><span class="app-stat-label">Restarts</span><span class="app-stat-val" [class.app-warn]="(card.data.pods?.restarts || 0) > 5">{{ card.data.pods?.restarts || 0 }}</span></div>
                  @if (card.data.pods?.critical > 0) {
                    <div class="app-stat-row"><span class="app-stat-label">Failed</span><span class="app-stat-val app-crit">{{ card.data.pods?.critical }}</span></div>
                  }
                </div>
              </div>
              @if (card.data.app_info?.image) {
                <div class="app-image"><i class="pi pi-box"></i> {{ card.data.app_info.image | slice:-40 }}</div>
              }
            } @else {
              <!-- Cluster View -->
              <div class="mc-compact">
                <div class="compact-ring">
                  <svg viewBox="0 0 36 36">
                    <path class="ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <path class="ring-fill" [class]="ringClass(card)" [attr.stroke-dasharray]="healthPct(card) + ', 100'" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  </svg>
                  <span class="ring-val">{{ healthPct(card) }}%</span>
                </div>
                <div class="compact-stats">
                  <div class="cs-row"><span class="cs-dot cs-ok"></span><span class="cs-num">{{ card.data.pods?.healthy || 0 }}</span> running</div>
                  <div class="cs-row"><span class="cs-dot cs-warn"></span><span class="cs-num">{{ card.data.pods?.warning || 0 }}</span> warn</div>
                  <div class="cs-row"><span class="cs-dot cs-crit"></span><span class="cs-num">{{ card.data.pods?.critical || 0 }}</span> crit</div>
                </div>
                <div class="compact-nodes">
                  <span class="cn-label">Nodes</span>
                  <span class="cn-val">{{ card.data.nodes?.healthy || 0 }}/{{ (card.data.nodes?.healthy || 0) + (card.data.nodes?.warning || 0) }}</span>
                </div>
              </div>
            }

            <!-- Mini Activity -->
            <div class="mc-mini-activity">
              <span class="mini-label">Activity</span>
              <div class="mini-chart">
                @for (bar of card.activityBars; track $index) {
                  <div class="mini-bar" [style.height.%]="bar" [class.mini-high]="bar > 70" [attr.title]="Math.round(bar) + '% activity'"></div>
                }
              </div>
            </div>

            <!-- Footer -->
            <div class="mc-footer">
              <span class="mc-events-count"><i class="pi pi-bolt"></i> {{ card.events.length }} events</span>
              @if (card.alertEnabled) {
                <span class="mc-alert-badge" [class.alert-triggered]="healthPct(card) < card.alertThreshold">
                  <i class="pi pi-bell"></i> {{ healthPct(card) < card.alertThreshold ? 'ALERT' : 'OK' }}
                </span>
              }
              <span class="mc-time">{{ card.lastUpdated || '—' }}</span>
            </div>


            <!-- Action Log -->
            @if (card.actionLog.length > 0) {
              <div class="mc-action-log">
                @for (entry of card.actionLog.slice(-3).reverse(); track $index) {
                  <div class="action-entry">
                    <span class="action-icon" [class.action-restart]="entry.action === 'restart'" [class.action-scale]="entry.action.startsWith('scale')">●</span>
                    <span class="action-text">{{ entry.target }} {{ entry.action }}</span>
                    <span class="action-time">{{ entry.time }}</span>
                  </div>
                }
              </div>
            }
          } @else if (card.loading) {
            <div class="mc-state"><div class="spin"></div> Loading...</div>
          } @else if (card.data?.error) {
            <div class="mc-error"><i class="pi pi-exclamation-triangle"></i> {{ card.data.error }}</div>
          } @else {
            <div class="mc-state"><i class="pi pi-chart-bar"></i> Select cluster & namespace</div>
          }
        </div>
      }

      <!-- Empty -->
      @if (cards.length === 0) {
        <div class="empty-page">
          <div class="empty-icon"><i class="pi pi-desktop"></i></div>
          <h3>Multi-Cluster Monitor</h3>
          <p>Add cards to watch health across clusters and namespaces in real-time.</p>
          <button pButton label="Add First Card" icon="pi pi-plus" class="p-button-sm" (click)="addCard()"></button>
        </div>
      }

    <!-- Fullscreen Dialog -->
    <p-dialog [(visible)]="fsVisible" [modal]="true" [maximizable]="true" [header]="fsCard?.context + ' / ' + fsCard?.namespace + (fsCard?.app ? ' / ' + fsCard?.app : '')" styleClass="fullscreen-dialog" [appendTo]="'body'" (onHide)="closeFsDialog()">
      @if (fsCard?.data) {
        <div class="fsd-body">
          <!-- Health Row -->
          <div class="fsd-health-row">
            <div class="fsd-ring-wrap">
              <svg viewBox="0 0 36 36">
                <path class="ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path class="ring-fill" [class]="ringClass(fsCard!)" [attr.stroke-dasharray]="healthPct(fsCard!) + ', 100'" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              </svg>
              <span class="fsd-ring-val">{{ healthPct(fsCard!) }}%</span>
            </div>
            <div class="fsd-stats">
              <div class="fsd-stat"><span class="fsd-stat-val">{{ fsCard!.data.pods?.healthy || 0 }}</span><span class="fsd-stat-label">Running</span></div>
              <div class="fsd-stat fsd-warn"><span class="fsd-stat-val">{{ fsCard!.data.pods?.warning || 0 }}</span><span class="fsd-stat-label">Warning</span></div>
              <div class="fsd-stat fsd-crit"><span class="fsd-stat-val">{{ fsCard!.data.pods?.critical || 0 }}</span><span class="fsd-stat-label">Critical</span></div>
              <div class="fsd-stat"><span class="fsd-stat-val">{{ fsCard!.data.deployments?.healthy || 0 }}/{{ (fsCard!.data.deployments?.healthy || 0) + (fsCard!.data.deployments?.unavailable || 0) }}</span><span class="fsd-stat-label">Deploys</span></div>
            </div>
          </div>

          <!-- Actions -->
          @if (fsCard!.app) {
            <div class="fsd-actions">
              <button pButton icon="pi pi-refresh" label="Restart" class="p-button-sm p-button-outlined" (click)="restartApp(fsCard!)"></button>
              <button pButton icon="pi pi-minus" label="Scale Down" class="p-button-sm p-button-outlined" (click)="scaleDown(fsCard!)"></button>
              <button pButton icon="pi pi-plus" label="Scale Up" class="p-button-sm p-button-outlined" (click)="scaleUp(fsCard!)"></button>
              <button pButton icon="pi pi-sync" label="Refresh" class="p-button-sm p-button-text" (click)="fetchCardData(fsCard!)"></button>
            </div>
          }

          <!-- Activity Histogram -->
          <div class="fsd-section">
            <div class="fsd-section-header">
              <h4>Activity</h4>
              <span class="fsd-hint">{{ fsCard!.events.length }} events · {{ fsCard!.actionLog.length }} actions</span>
            </div>
            <div class="fsd-histogram">
              @for (bar of fsCard!.activityBars; track $index) {
                <div class="fsd-hbar" [style.height.%]="bar" [class.fsd-hbar-high]="bar > 70" [class.fsd-hbar-med]="bar > 40 && bar <= 70"></div>
              }
            </div>
          </div>

          <!-- Action Log -->
          @if (fsCard!.actionLog.length > 0) {
            <div class="fsd-section">
              <h4>Action Log</h4>
              <div class="fsd-action-list">
                @for (entry of fsCard!.actionLog.slice().reverse(); track $index) {
                  <div class="fsd-al-row">
                    <span class="fsd-al-dot" [class.al-restart]="entry.action === 'restart'" [class.al-scale-up]="entry.action === 'scale-up'" [class.al-scale-down]="entry.action === 'scale-down'"></span>
                    <span class="fsd-al-action">{{ entry.action }}</span>
                    <span class="fsd-al-target">{{ entry.target }}</span>
                    <span class="fsd-al-time">{{ entry.time }}</span>
                  </div>
                }
              </div>
            </div>
          }

          <!-- Events -->
          <div class="fsd-section">
            <div class="fsd-section-header">
              <h4>Events</h4>
              <span class="fsd-hint">{{ fsCard!.events.length }}</span>
            </div>
            <div class="fsd-events">
              @for (ev of fsCard!.events; track $index) {
                <div class="fsd-ev">
                  <span class="fsd-ev-dot" [class.fsd-ev-warn]="ev.type === 'Warning'"></span>
                  <span class="fsd-ev-reason">{{ ev.reason }}</span>
                  <span class="fsd-ev-obj">{{ ev.object }}</span>
                  <span class="fsd-ev-msg">{{ ev.message }}</span>
                </div>
              }
              @if (fsCard!.events.length === 0) {
                <div class="fsd-empty">No events</div>
              }
            </div>
          </div>
        </div>
      }
    </p-dialog>
    </div>
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .header-actions { display: flex; gap: 8px; }

    /* Global Strip */
    .global-strip {
      display: flex; align-items: center; gap: 16px;
      padding: 10px 16px; margin-bottom: 16px;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
    }
    .gs-item { text-align: center; }
    .gs-val { display: block; font-size: 18px; font-weight: 700; }
    .gs-warn .gs-val { color: var(--warning); }
    .gs-crit .gs-val { color: var(--danger); }
    .gs-label { font-size: 9px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .gs-bar { flex: 1; height: 4px; border-radius: 2px; background: var(--bg-elevated); overflow: hidden; }
    .gsb-fill { height: 100%; border-radius: 2px; transition: width 0.4s; }
    .gsb-ok { background: var(--success); }

    /* Grid */
    .monitor-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }

    /* Card */
    .monitor-card {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 14px; display: flex; flex-direction: column; gap: 10px;
      transition: all 0.15s; cursor: default;
    }
    .monitor-card:hover { border-color: var(--border-hover); transform: translateY(-2px); box-shadow: 0 8px 24px -8px rgba(0,0,0,0.2); }
    .monitor-card[draggable="true"] { cursor: grab; }
    .monitor-card[draggable="true"]:active { cursor: grabbing; opacity: 0.7; }
    .card-healthy { border-left: 3px solid var(--success); }
    .card-degraded { border-left: 3px solid var(--warning); }
    .card-critical { border-color: var(--danger); border-left: 3px solid var(--danger); }

    /* Toolbar */
    .mc-toolbar { display: flex; align-items: center; gap: 6px; }
    .mc-drag { color: var(--text-muted); cursor: grab; padding: 2px; }
    .mc-drag i { font-size: 12px; }
    .mc-badge {
      font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px;
      text-transform: uppercase; letter-spacing: 0.03em;
    }
    .badge-healthy { background: var(--success-subtle); color: var(--success); }
    .badge-degraded { background: var(--warning-subtle); color: var(--warning); }
    .badge-critical { background: var(--danger-subtle); color: var(--danger); }
    .badge-unknown { background: var(--bg-elevated); color: var(--text-muted); }
    .mc-title { font-size: 12px; font-weight: 500; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mc-toolbar-actions { display: flex; gap: 2px; }

    /* Selectors */
    .mc-config { padding: 12px; background: var(--bg-elevated); border-radius: 8px; display: flex; flex-direction: column; gap: 8px; }
    .cfg-row { display: flex; flex-direction: column; gap: 4px; }
    .cfg-label { font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .cfg-intervals { display: flex; gap: 4px; }
    .cfg-int {
      padding: 4px 10px; border: 1px solid var(--border); border-radius: 4px;
      background: var(--bg-card); color: var(--text-muted); font-size: 11px;
      cursor: pointer; transition: all 0.1s;
    }
    .cfg-int.active { border-color: var(--accent); background: var(--accent-subtle); color: var(--accent); }
    .cfg-int:hover:not(.active) { border-color: var(--border-hover); color: var(--text); }
    .cfg-apply { align-self: flex-end; }

    /* Compact Health */
    .mc-compact { display: flex; align-items: center; gap: 12px; padding: 8px 0; }
    .compact-ring { position: relative; width: 56px; height: 56px; flex-shrink: 0; }
    .compact-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    .ring-bg { fill: none; stroke: var(--bg-elevated); stroke-width: 3.5; }
    .ring-fill { fill: none; stroke-width: 3.5; stroke-linecap: round; transition: stroke-dasharray 0.5s; }
    .ring-fill.ring-ok { stroke: var(--success); }
    .ring-fill.ring-warn { stroke: var(--warning); }
    .ring-fill.ring-crit { stroke: var(--danger); }
    .ring-val { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; }
    .compact-stats { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .cs-row { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--text-secondary); }
    .cs-dot { width: 5px; height: 5px; border-radius: 50%; }
    .cs-ok { background: var(--success); }
    .cs-warn { background: var(--warning); }
    .cs-crit { background: var(--danger); }
    .cs-num { font-weight: 600; font-family: 'JetBrains Mono', monospace; }
    .compact-nodes { text-align: center; padding: 6px 10px; background: var(--bg-elevated); border-radius: 6px; }
    .cn-label { display: block; font-size: 9px; color: var(--text-muted); text-transform: uppercase; }
    .cn-val { font-size: 14px; font-weight: 700; }

    /* App-specific card view */
    .mc-app-view { display: flex; align-items: center; gap: 14px; padding: 8px 0; }
    .app-replica-ring { position: relative; width: 56px; height: 56px; flex-shrink: 0; }
    .app-replica-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    .app-details { flex: 1; display: flex; flex-direction: column; gap: 3px; }
    .app-stat-row { display: flex; align-items: center; justify-content: space-between; font-size: 11px; }
    .app-stat-label { color: var(--text-muted); }
    .app-stat-val { font-weight: 600; font-family: 'JetBrains Mono', monospace; }
    .app-ok { color: var(--success); }
    .app-warn { color: var(--warning); }
    .app-crit { color: var(--danger); }
    .app-image {
      font-size: 10px; color: var(--text-muted); font-family: 'JetBrains Mono', monospace;
      display: flex; align-items: center; gap: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .app-image i { font-size: 10px; }

    /* Sections */
    .mc-section { padding-top: 8px; border-top: 1px solid var(--border); }
    .section-label { font-size: 9px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; display: block; margin-bottom: 6px; }
    .dep-bar { height: 4px; border-radius: 2px; background: var(--bg-elevated); overflow: hidden; margin-bottom: 4px; }
    .dep-fill { height: 100%; background: var(--success); border-radius: 2px; transition: width 0.4s; }
    .dep-ratio { font-size: 10px; color: var(--text-muted); }

    /* Activity */
    .activity-chart { display: flex; align-items: flex-end; gap: 1px; height: 32px; }
    .act-bar { flex: 1; min-height: 2px; border-radius: 1px 1px 0 0; background: var(--accent); opacity: 0.4; }
    .act-bar.act-high { background: var(--danger); opacity: 0.7; }
    .act-bar.act-med { background: var(--warning); opacity: 0.5; }

    /* Events */
    .mc-events { display: flex; flex-direction: column; gap: 3px; }
    .mce-row { display: flex; align-items: center; gap: 6px; font-size: 10px; }
    .mce-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--accent); }
    .mce-dot.mce-warn { background: var(--warning); }
    .mce-reason { font-weight: 500; }
    .mce-obj { color: var(--text-muted); font-family: 'JetBrains Mono', monospace; font-size: 9px; }

    /* Footer */
    .mc-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .mc-events-count { font-size: 10px; color: var(--text-muted); display: flex; align-items: center; gap: 4px; }
    .mc-events-count i { font-size: 10px; }
    .mc-alert-badge {
      font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px;
      background: var(--success-subtle); color: var(--success);
    }
    .mc-alert-badge.alert-triggered {
      background: var(--danger-subtle); color: var(--danger); animation: pulse 1.5s infinite;
    }
    .mc-actions {
      display: flex; gap: 4px; padding-top: 8px; border-top: 1px solid var(--border); flex-wrap: wrap;
    }
    .cfg-alert-row { display: flex; align-items: center; gap: 6px; }
    .cfg-hint { font-size: 10px; color: var(--text-muted); }
    .cfg-threshold {
      width: 48px; padding: 4px 6px; border: 1px solid var(--border); border-radius: 4px;
      background: var(--bg-card); color: var(--text); font-size: 11px; text-align: center;
    }

    /* Action Log (card) */
    .mc-action-log {
      padding-top: 6px; border-top: 1px solid var(--border);
      display: flex; flex-direction: column; gap: 3px;
    }
    .action-entry {
      display: flex; align-items: center; gap: 6px; font-size: 10px;
    }
    .action-icon { font-size: 8px; color: var(--text-muted); }
    .action-icon.action-restart { color: var(--warning); }
    .action-icon.action-scale { color: var(--success); }
    .action-text { flex: 1; color: var(--text-secondary); }
    .action-time { color: var(--text-muted); font-family: 'JetBrains Mono', monospace; font-size: 9px; }
    .mc-mini-activity { padding-top: 6px; }
    .mini-label { font-size: 9px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; display: block; margin-bottom: 3px; }
    .mini-chart { display: flex; align-items: flex-end; gap: 1px; height: 24px; }
    .mini-bar { flex: 1; min-width: 4px; min-height: 2px; cursor: crosshair; border-radius: 1px 1px 0 0; background: var(--accent); opacity: 0.4; }
    .mini-bar.mini-high { background: var(--danger); opacity: 0.6; }
    .mc-time { font-size: 9px; color: var(--text-muted); }

    /* States */
    .mc-state { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 24px; color: var(--text-muted); font-size: 11px; }
    .mc-state i { font-size: 16px; opacity: 0.3; }
    .mc-error {
      display: flex; align-items: center; gap: 8px; padding: 12px 14px;
      background: var(--danger-subtle); border-radius: 6px;
      font-size: 11px; color: var(--danger); font-weight: 500;
    }
    .mc-error i { font-size: 14px; }
    .spin { width: 14px; height: 14px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Empty */
    .empty-page {
      grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; gap: 10px;
      padding: 56px; text-align: center;
    }
    .empty-icon { width: 56px; height: 56px; border-radius: 16px; background: var(--accent-subtle); color: var(--accent); display: flex; align-items: center; justify-content: center; font-size: 24px; }
    .empty-page h3 { font-size: 18px; font-weight: 600; margin: 0; }
    .empty-page p { font-size: 13px; color: var(--text-secondary); margin: 0; max-width: 320px; }

    /* Dialog Fullscreen */
    .fsd-body { display: flex; flex-direction: column; gap: 20px; }
    .fsd-health-row { display: flex; align-items: center; gap: 20px; }
    .fsd-ring-wrap { position: relative; width: 80px; height: 80px; flex-shrink: 0; }
    .fsd-ring-wrap svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    .fsd-ring-val { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; }
    .fsd-stats { display: flex; gap: 10px; flex: 1; }
    .fsd-stat {
      flex: 1; text-align: center; padding: 12px 8px; background: var(--bg-elevated);
      border-radius: 8px; border: 1px solid var(--border);
    }
    .fsd-stat-val { display: block; font-size: 22px; font-weight: 700; }
    .fsd-stat-label { display: block; font-size: 9px; color: var(--text-muted); text-transform: uppercase; margin-top: 2px; }
    .fsd-warn .fsd-stat-val { color: var(--warning); }
    .fsd-crit .fsd-stat-val { color: var(--danger); }
    .fsd-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .fsd-section { }
    .fsd-section h4 { font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 8px; }
    .fsd-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .fsd-section-header h4 { margin: 0; }
    .fsd-hint { font-size: 10px; color: var(--text-muted); }
    .fsd-histogram { display: flex; align-items: flex-end; gap: 2px; height: 60px; padding: 4px 0; }
    .fsd-hbar { flex: 1; min-height: 3px; border-radius: 2px 2px 0 0; background: var(--accent); opacity: 0.5; }
    .fsd-hbar.fsd-hbar-high { background: var(--danger); opacity: 0.7; }
    .fsd-hbar.fsd-hbar-med { background: var(--warning); opacity: 0.6; }
    .fsd-action-list { display: flex; flex-direction: column; gap: 3px; max-height: 180px; overflow-y: auto; }
    .fsd-al-row { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: 6px; font-size: 12px; }
    .fsd-al-row:hover { background: var(--bg-hover); }
    .fsd-al-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
    .al-restart { background: var(--warning); }
    .al-scale-up { background: var(--success); }
    .al-scale-down { background: var(--accent); }
    .fsd-al-action { font-weight: 500; min-width: 70px; font-size: 11px; }
    .fsd-al-target { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-muted); flex: 1; }
    .fsd-al-time { font-size: 10px; color: var(--text-muted); font-family: 'JetBrains Mono', monospace; }
    .fsd-events { display: flex; flex-direction: column; gap: 3px; max-height: 200px; overflow-y: auto; }
    .fsd-ev { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: 6px; font-size: 12px; }
    .fsd-ev:hover { background: var(--bg-hover); }
    .fsd-ev-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); flex-shrink: 0; }
    .fsd-ev-dot.fsd-ev-warn { background: var(--warning); }
    .fsd-ev-reason { font-weight: 500; min-width: 80px; font-size: 11px; }
    .fsd-ev-obj { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--text-muted); min-width: 100px; }
    .fsd-ev-msg { flex: 1; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
    .fsd-empty { text-align: center; padding: 16px; color: var(--text-muted); font-size: 12px; }
    @media (max-width: 768px) { .monitor-grid { grid-template-columns: 1fr; } }
  `],
})
export class MonitorComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  contexts: string[] = [];
  cards: MonitorCard[] = [];
  Math = Math;
  fsVisible = false;
  fsCard: MonitorCard | null = null;
  private idCounter = 0;
  private cardTimers = new Map<number, any>();
  private dragIndex = -1;

  get loadedCards() { return this.cards.filter(c => c.data).length; }
  get totalHealthy() { return this.cards.reduce((s, c) => s + (c.data?.pods?.healthy || 0), 0); }
  get totalWarning() { return this.cards.reduce((s, c) => s + (c.data?.pods?.warning || 0), 0); }
  get totalCritical() { return this.cards.reduce((s, c) => s + (c.data?.pods?.critical || 0), 0); }
  get globalHealthPct() {
    const total = this.totalHealthy + this.totalWarning + this.totalCritical;
    return total > 0 ? Math.round((this.totalHealthy / total) * 100) : 100;
  }

  ngOnInit() {
    this.http.get<any>('/api/contexts').subscribe(res => {
      this.contexts = (res.contexts || []).map((c: any) => c.name);
    });
    this.loadSavedCards();
    // Start per-card auto-refresh
    this.startCardTimers();
  }

  ngOnDestroy() { this.stopCardTimers(); }

  addCard() {
    const card: MonitorCard = {
      id: ++this.idCounter, context: '', namespace: '', app: '',
      loading: false, data: null, events: [], activityBars: [],
      expanded: true, configuring: true, fullscreen: false, refreshInterval: 60,
      lastUpdated: '', namespaces: [], apps: [], order: this.cards.length,
      alertEnabled: false, alertThreshold: 70, actionLog: [],
    };
    this.cards.push(card);
    this.saveCards();
  }

  removeCard(id: number) {
    this.cards = this.cards.filter(c => c.id !== id);
    this.saveCards();
  }

  refreshAll() {
    this.cards.filter(c => c.context && c.namespace).forEach(c => this.fetchCardData(c));
  }

  private startCardTimers() {
    this.stopCardTimers();
    for (const card of this.cards) {
      if (card.refreshInterval > 0 && card.context && card.namespace) {
        const timer = setInterval(() => this.fetchCardData(card), card.refreshInterval * 1000);
        this.cardTimers.set(card.id, timer);
      }
    }
  }

  private stopCardTimers() {
    this.cardTimers.forEach(t => clearInterval(t));
    this.cardTimers.clear();
  }

  onContextSelect(card: MonitorCard) {
    if (!card.context) return;
    card.namespace = '';
    card.app = '';
    card.apps = [];
    card.data = null;
    this.http.get<any>(`/api/namespaces/${card.context}`).subscribe({
      next: (res) => {
        card.namespaces = res.namespaces || [];
        if (res.error) {
          card.data = { error: res.error };
        }
      },
      error: () => { card.namespaces = []; },
    });
  }

  onNamespaceSelect(card: MonitorCard) {
    card.app = '';
    card.apps = [];
    if (!card.context || !card.namespace) return;
    this.http.get<any>(`/api/list-apps/${card.context}/${card.namespace}`).subscribe({
      next: (res) => {
        card.apps = (res.deployments || []).map((d: any) => d.name);
      },
      error: () => { card.apps = []; },
    });
  }

  applyConfig(card: MonitorCard) {
    card.configuring = false;
    this.fetchCardData(card);
    this.saveCards();
    this.startCardTimers();
  }

  fetchCardData(card: MonitorCard) {
    if (!card.context || !card.namespace) return;
    card.loading = true;
    const url = card.app
      ? `/api/overview/${card.context}/${card.namespace}?app=${card.app}`
      : `/api/overview/${card.context}/${card.namespace}`;
    this.http.get<any>(url).subscribe({
      next: (res) => {
        card.data = res;
        card.events = res.events || [];
        card.activityBars = this.buildBars(card.events);
        card.loading = false;
        card.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (card.alertEnabled && this.healthPct(card) < card.alertThreshold) {
          this.triggerAlert(card);
        }
        this.saveCards();
      },
      error: () => { card.loading = false; },
    });
  }

  // Drag & Drop reorder
  onDragStart(index: number) { this.dragIndex = index; }
  onDragOver(event: DragEvent, index: number) { event.preventDefault(); }
  onDrop(index: number) {
    if (this.dragIndex === index) return;
    const item = this.cards.splice(this.dragIndex, 1)[0];
    this.cards.splice(index, 0, item);
    this.saveCards();
  }

  healthPct(card: MonitorCard): number {
    if (!card.data) return 0;
    const t = (card.data.pods?.healthy || 0) + (card.data.pods?.warning || 0) + (card.data.pods?.critical || 0);
    return t > 0 ? Math.round(((card.data.pods?.healthy || 0) / t) * 100) : 100;
  }

  depPct(card: MonitorCard): number {
    if (!card.data) return 0;
    const t = (card.data.deployments?.healthy || 0) + (card.data.deployments?.unavailable || 0);
    return t > 0 ? Math.round(((card.data.deployments?.healthy || 0) / t) * 100) : 100;
  }

  ringClass(card: MonitorCard): string {
    const p = this.healthPct(card);
    return p >= 90 ? 'ring-ok' : p >= 60 ? 'ring-warn' : 'ring-crit';
  }

  cardHealth(card: MonitorCard): string {
    if (!card.data) return 'unknown';
    const p = this.healthPct(card);
    return p >= 90 ? 'healthy' : p >= 60 ? 'degraded' : 'critical';
  }

  isCritical(card: MonitorCard): boolean {
    return this.cardHealth(card) === 'critical';
  }

  private buildBars(events: any[]): number[] {
    const bars = new Array(20).fill(0);
    const total = events.length;
    if (total === 0) return bars.map(() => Math.random() * 10 + 3);
    for (let i = 0; i < total; i++) { bars[Math.floor((i / total) * 20)]++; }
    const max = Math.max(...bars, 1);
    return bars.map(b => Math.max((b / max) * 100, 4));
  }

  restartApp(card: MonitorCard) {
    if (!card.app) return;
    this.http.post<any>(`/api/restart/${card.app}`, {}).subscribe(() => {
      this.logAction(card, 'restart');
      setTimeout(() => this.fetchCardData(card), 3000);
    });
  }

  scaleDown(card: MonitorCard) {
    if (!card.app) return;
    this.http.post<any>(`/api/scale/${card.app}`, { replicas: -1, relative: true }).subscribe(() => {
      this.logAction(card, 'scale-down');
      setTimeout(() => this.fetchCardData(card), 2000);
    });
  }

  scaleUp(card: MonitorCard) {
    if (!card.app) return;
    this.http.post<any>(`/api/scale/${card.app}`, { replicas: 1, relative: true }).subscribe(() => {
      this.logAction(card, 'scale-up');
      setTimeout(() => this.fetchCardData(card), 2000);
    });
  }

  private logAction(card: MonitorCard, action: string) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const target = `${card.context}/${card.namespace}/${card.app}`;
    card.actionLog.push({ time, action, target: card.app });
    this.saveCards();
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`✅ ${target}`, { body: `${action} executed at ${time}` });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }

  diagnoseCard(card: MonitorCard) {
    window.location.href = `/pods?filter=${card.namespace}`;
  }

  openFsDialog(card: MonitorCard) {
    this.fsCard = card;
    this.fsVisible = true;
  }

  closeFsDialog() {
    this.fsVisible = false;
    this.fsCard = null;
  }

  private triggerAlert(card: MonitorCard) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`⚠️ ${card.context}/${card.namespace}${card.app ? '/' + card.app : ''}`, {
        body: `Health dropped to ${this.healthPct(card)}% (threshold: ${card.alertThreshold}%)`,
      });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }

  private saveCards() {
    const saved = this.cards.map(c => ({
      context: c.context, namespace: c.namespace, app: c.app || '',
      expanded: c.expanded, refreshInterval: c.refreshInterval || 60,
      alertEnabled: c.alertEnabled, alertThreshold: c.alertThreshold,
      actionLog: (c.actionLog || []).slice(-50),
    }));
    localStorage.setItem('kubsome_monitor_cards', JSON.stringify(saved));
  }

  private loadSavedCards() {
    try {
      const raw = localStorage.getItem('kubsome_monitor_cards');
      if (raw) {
        const saved = JSON.parse(raw);
        for (const s of saved) {
          const card: MonitorCard = {
            id: ++this.idCounter, context: s.context || '', namespace: s.namespace || '', app: s.app || '',
            loading: false, data: null, events: [], activityBars: [],
            expanded: s.expanded ?? true, configuring: !(s.context && s.namespace), fullscreen: false,
            refreshInterval: s.refreshInterval || 60, lastUpdated: '', namespaces: [], apps: [], order: this.cards.length,
            alertEnabled: s.alertEnabled || false, alertThreshold: s.alertThreshold || 70,
            actionLog: s.actionLog || [],
          };
          this.cards.push(card);
          if (card.context && card.namespace) {
            const savedNs = card.namespace;
            const savedApp = card.app;
            this.http.get<any>(`/api/namespaces/${card.context}`).subscribe({
              next: (res) => {
                card.namespaces = res.namespaces || [];
                card.namespace = savedNs;
                this.http.get<any>(`/api/list-apps/${card.context}/${savedNs}`).subscribe({
                  next: (appsRes) => {
                    card.apps = (appsRes.deployments || []).map((d: any) => d.name);
                    card.app = savedApp;
                    this.fetchCardData(card);
                  },
                  error: () => { this.fetchCardData(card); },
                });
              },
              error: () => { card.namespaces = []; },
            });
          }
        }
      } else {
        this.addCard();
      }
    } catch {
      this.addCard();
    }
  }
}
