import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { SlicePipe } from '@angular/common';
import { Select } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

interface MonitorCard {
  id: number;
  context: string;
  namespace: string;
  loading: boolean;
  data: any;
  events: any[];
  activityBars: number[];
  expanded: boolean;
  lastUpdated: string;
  namespaces: string[];
  order: number;
  configuring: boolean;
  fullscreen: boolean;
  refreshInterval: number;
}

@Component({
  selector: 'app-monitor',
  standalone: true,
  imports: [FormsModule, SlicePipe, Select, ButtonModule, TagModule, TooltipModule],
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
            <span class="mc-title">{{ card.context ? (card.context | slice:0:20) : 'New Card' }} / {{ card.namespace || '...' }}</span>
            <div class="mc-toolbar-actions">
              <button pButton icon="pi pi-expand" class="p-button-text p-button-sm p-button-rounded" pTooltip="Full screen" (click)="card.fullscreen = true"></button>
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
                          [filter]="true" [style]="{ width: '100%' }" />
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
            <!-- Compact View -->
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
              <span class="mc-time">{{ card.lastUpdated || '—' }}</span>
            </div>
          } @else if (card.loading) {
            <div class="mc-state"><div class="spin"></div> Loading...</div>
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

    <!-- Fullscreen Modal -->
    @for (card of cards; track card.id) {
      @if (card.fullscreen && card.data) {
        <div class="fs-overlay" (click)="card.fullscreen = false">
          <div class="fs-modal" (click)="$event.stopPropagation()">
            <div class="fs-header">
              <div class="fs-title">
                <span class="fs-badge" [class]="'badge-' + cardHealth(card)">{{ cardHealth(card) }}</span>
                <h2>{{ card.context }} / {{ card.namespace }}</h2>
                @if (card.lastUpdated) {
                  <span class="fs-time">{{ card.lastUpdated }}</span>
                }
              </div>
              <div class="fs-header-actions">
                <button class="fs-btn" (click)="fetchCardData(card)" title="Refresh">
                  <i class="pi pi-refresh"></i>
                </button>
                <button class="fs-btn" (click)="card.fullscreen = false" title="Minimize">
                  <i class="pi pi-window-minimize"></i>
                </button>
                <button class="fs-btn fs-btn-close" (click)="card.fullscreen = false" title="Close">
                  <i class="pi pi-times"></i>
                </button>
              </div>
            </div>
            <div class="fs-body">
              <!-- Health Overview -->
              <div class="fs-health-row">
                <div class="fs-ring-wrap">
                  <svg viewBox="0 0 36 36" class="fs-ring-svg">
                    <path class="ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <path class="ring-fill" [class]="ringClass(card)" [attr.stroke-dasharray]="healthPct(card) + ', 100'" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  </svg>
                  <span class="fs-ring-val">{{ healthPct(card) }}%</span>
                </div>
                <div class="fs-stats">
                  <div class="fs-stat"><span class="fs-stat-val">{{ card.data.pods?.healthy || 0 }}</span><span class="fs-stat-label">Running</span></div>
                  <div class="fs-stat fs-warn"><span class="fs-stat-val">{{ card.data.pods?.warning || 0 }}</span><span class="fs-stat-label">Warning</span></div>
                  <div class="fs-stat fs-crit"><span class="fs-stat-val">{{ card.data.pods?.critical || 0 }}</span><span class="fs-stat-label">Critical</span></div>
                  <div class="fs-stat"><span class="fs-stat-val">{{ (card.data.nodes?.healthy || 0) }}/{{ (card.data.nodes?.healthy || 0) + (card.data.nodes?.warning || 0) }}</span><span class="fs-stat-label">Nodes</span></div>
                  <div class="fs-stat"><span class="fs-stat-val">{{ card.data.deployments?.healthy || 0 }}/{{ (card.data.deployments?.healthy || 0) + (card.data.deployments?.unavailable || 0) }}</span><span class="fs-stat-label">Deployments</span></div>
                </div>
              </div>

              <!-- Deployment Progress -->
              <div class="fs-section">
                <h4>Deployment Health</h4>
                <div class="fs-dep-bar">
                  <div class="fs-dep-fill" [style.width.%]="depPct(card)"></div>
                </div>
                <span class="fs-dep-label">{{ card.data.deployments?.healthy || 0 }} available / {{ (card.data.deployments?.healthy || 0) + (card.data.deployments?.unavailable || 0) }} total</span>
              </div>

              <!-- Activity -->
              <div class="fs-section">
                <div class="fs-section-header">
                  <h4>Activity (last hour)</h4>
                  <span class="fs-section-hint">{{ card.events.length }} total events</span>
                </div>
                <div class="fs-activity">
                  @for (bar of card.activityBars; track $index) {
                    <div class="fs-bar" [style.height.%]="bar" [class.fs-bar-high]="bar > 70" [class.fs-bar-med]="bar > 40 && bar <= 70" [attr.title]="Math.round(bar) + '%'"></div>
                  }
                </div>
                <div class="fs-activity-legend">
                  <span class="fs-leg"><span class="fs-leg-dot fs-leg-low"></span> Low</span>
                  <span class="fs-leg"><span class="fs-leg-dot fs-leg-med"></span> Medium</span>
                  <span class="fs-leg"><span class="fs-leg-dot fs-leg-high"></span> High</span>
                </div>
              </div>

              <!-- Events -->
              <div class="fs-section">
                <div class="fs-section-header">
                  <h4>Recent Events</h4>
                  <span class="fs-section-hint">{{ card.events.length }} events</span>
                </div>
                <div class="fs-events">
                  @for (ev of card.events; track $index) {
                    <div class="fs-ev">
                      <span class="fs-ev-dot" [class.fs-ev-warn]="ev.type === 'Warning'"></span>
                      <span class="fs-ev-reason">{{ ev.reason }}</span>
                      <span class="fs-ev-obj">{{ ev.object }}</span>
                      <span class="fs-ev-msg">{{ ev.message }}</span>
                    </div>
                  }
                  @if (card.events.length === 0) {
                    <div class="fs-ev-empty">No recent events</div>
                  }
                </div>
              </div>

              <!-- Updated -->
              <div class="fs-updated">Last updated: {{ card.lastUpdated || 'never' }}</div>
            </div>
          </div>
        </div>
      }
    }
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
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-sm);
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
    .monitor-card:hover { border-color: var(--border-hover); }
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
    .mc-footer { display: flex; align-items: center; justify-content: space-between; }
    .mc-events-count { font-size: 10px; color: var(--text-muted); display: flex; align-items: center; gap: 4px; }
    .mc-events-count i { font-size: 10px; }
    .mc-mini-activity { padding-top: 6px; }
    .mini-label { font-size: 9px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; display: block; margin-bottom: 3px; }
    .mini-chart { display: flex; align-items: flex-end; gap: 1px; height: 24px; }
    .mini-bar { flex: 1; min-width: 4px; min-height: 2px; cursor: crosshair; border-radius: 1px 1px 0 0; background: var(--accent); opacity: 0.4; }
    .mini-bar.mini-high { background: var(--danger); opacity: 0.6; }
    .mc-time { font-size: 9px; color: var(--text-muted); }

    /* States */
    .mc-state { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 24px; color: var(--text-muted); font-size: 11px; }
    .mc-state i { font-size: 16px; opacity: 0.3; }
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

    /* Fullscreen Modal */
    .fs-overlay {
      position: fixed; inset: 0; background: var(--bg);
      z-index: 9000; display: flex; flex-direction: column;
    }
    .fs-modal {
      width: 100%; height: 100%;
      background: var(--bg); display: flex; flex-direction: column; overflow: hidden;
    }
    .fs-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 24px; border-bottom: 1px solid var(--border); background: var(--bg-elevated);
    }
    .fs-title { display: flex; align-items: center; gap: 10px; flex: 1; }
    .fs-title h2 { font-size: 18px; font-weight: 700; margin: 0; }
    .fs-time { font-size: 10px; color: var(--text-muted); margin-left: 8px; }
    .fs-badge { font-size: 9px; font-weight: 700; padding: 3px 8px; border-radius: 4px; text-transform: uppercase; }
    .fs-header-actions { display: flex; gap: 6px; }
    .fs-btn {
      width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border);
      background: var(--bg-card); color: var(--text-muted); cursor: pointer;
      display: flex; align-items: center; justify-content: center; font-size: 14px;
      transition: all 0.12s;
    }
    .fs-btn:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-subtle); }
    .fs-btn-close:hover { border-color: var(--danger); color: var(--danger); background: var(--danger-subtle); }
    .fs-body { padding: 24px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 24px; }
    .fs-health-row { display: flex; align-items: center; gap: 24px; }
    .fs-ring-wrap { position: relative; width: 90px; height: 90px; flex-shrink: 0; }
    .fs-ring-svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    .fs-ring-val { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; }
    .fs-stats { display: flex; gap: 12px; flex: 1; }
    .fs-dep-bar { height: 6px; border-radius: 3px; background: var(--bg-elevated); overflow: hidden; margin-bottom: 6px; }
    .fs-dep-fill { height: 100%; background: var(--success); border-radius: 3px; transition: width 0.4s; }
    .fs-dep-label { font-size: 11px; color: var(--text-muted); }
    .fs-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .fs-section-header h4 { margin: 0; }
    .fs-section-hint { font-size: 10px; color: var(--text-muted); }
    .fs-bar.fs-bar-med { background: var(--warning); opacity: 0.5; }
    .fs-activity-legend { display: flex; gap: 12px; margin-top: 8px; }
    .fs-leg { display: flex; align-items: center; gap: 4px; font-size: 10px; color: var(--text-muted); }
    .fs-leg-dot { width: 8px; height: 8px; border-radius: 2px; }
    .fs-leg-low { background: var(--accent); opacity: 0.5; }
    .fs-leg-med { background: var(--warning); opacity: 0.6; }
    .fs-leg-high { background: var(--danger); opacity: 0.7; }
    .fs-ev-empty { text-align: center; padding: 20px; color: var(--text-muted); font-size: 12px; }
    .fs-updated { font-size: 10px; color: var(--text-muted); text-align: right; padding-top: 8px; border-top: 1px solid var(--border); }
    .fs-stat {
      flex: 1; text-align: center; padding: 16px 12px; background: var(--bg-card);
      border-radius: 12px; border: 1px solid var(--border); transition: border-color 0.12s;
    }
    .fs-stat:hover { border-color: var(--border-hover); }
    .fs-stat-val { display: block; font-size: 28px; font-weight: 700; letter-spacing: -0.02em; }
    .fs-stat-label { display: block; font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.03em; margin-top: 4px; }
    .fs-warn .fs-stat-val { color: var(--warning); }
    .fs-crit .fs-stat-val { color: var(--danger); }
    .fs-section h4 { font-size: 13px; font-weight: 600; color: var(--text-secondary); margin: 0; }
    .fs-activity { display: flex; align-items: flex-end; gap: 2px; height: 80px; padding: 8px 0; }
    .fs-bar { flex: 1; min-height: 3px; border-radius: 2px 2px 0 0; background: var(--accent); opacity: 0.5; }
    .fs-bar.fs-bar-high { background: var(--danger); opacity: 0.7; }
    .fs-events { display: flex; flex-direction: column; gap: 4px; max-height: 250px; overflow-y: auto; }
    .fs-ev { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 6px; font-size: 12px; }
    .fs-ev:hover { background: var(--bg-hover); }
    .fs-ev-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); flex-shrink: 0; }
    .fs-ev-dot.fs-ev-warn { background: var(--warning); }
    .fs-ev-reason { font-weight: 500; min-width: 80px; }
    .fs-ev-obj { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-muted); min-width: 120px; }
    .fs-ev-msg { flex: 1; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    @media (max-width: 768px) { .monitor-grid { grid-template-columns: 1fr; } }
  `],
})
export class MonitorComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  contexts: string[] = [];
  cards: MonitorCard[] = [];
  Math = Math;
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
    this.http.get<any>('http://localhost:8000/api/contexts').subscribe(res => {
      this.contexts = (res.contexts || []).map((c: any) => c.name);
    });
    this.loadSavedCards();
    // Start per-card auto-refresh
    this.startCardTimers();
  }

  ngOnDestroy() { this.stopCardTimers(); }

  addCard() {
    const card: MonitorCard = {
      id: ++this.idCounter, context: '', namespace: '',
      loading: false, data: null, events: [], activityBars: [],
      expanded: true, configuring: true, fullscreen: false, refreshInterval: 60, lastUpdated: '', namespaces: [], order: this.cards.length,
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
    card.data = null;
    this.http.get<any>(`http://localhost:8000/api/namespaces/${card.context}`).subscribe({
      next: (res) => { card.namespaces = res.namespaces || []; },
      error: () => { card.namespaces = []; },
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
    this.http.get<any>(`http://localhost:8000/api/overview/${card.context}/${card.namespace}`).subscribe({
      next: (res) => {
        card.data = res;
        card.events = res.events || [];
        card.activityBars = this.buildBars(card.events);
        card.loading = false;
        card.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

  private saveCards() {
    const saved = this.cards.map(c => ({ context: c.context, namespace: c.namespace, expanded: c.expanded, refreshInterval: c.refreshInterval || 60 }));
    localStorage.setItem('kubsome_monitor_cards', JSON.stringify(saved));
  }

  private loadSavedCards() {
    try {
      const raw = localStorage.getItem('kubsome_monitor_cards');
      if (raw) {
        const saved = JSON.parse(raw);
        for (const s of saved) {
          const card: MonitorCard = {
            id: ++this.idCounter, context: s.context || '', namespace: s.namespace || '',
            loading: false, data: null, events: [], activityBars: [],
            expanded: s.expanded ?? true, configuring: !(s.context && s.namespace), fullscreen: false, refreshInterval: s.refreshInterval || 60, lastUpdated: '', namespaces: [], order: this.cards.length,
          };
          this.cards.push(card);
          if (card.context && card.namespace) {
            // Fetch namespaces without clearing saved namespace
            const savedNs = card.namespace;
            this.http.get<any>(`http://localhost:8000/api/namespaces/${card.context}`).subscribe({
              next: (res) => {
                card.namespaces = res.namespaces || [];
                card.namespace = savedNs;
                this.fetchCardData(card);
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
