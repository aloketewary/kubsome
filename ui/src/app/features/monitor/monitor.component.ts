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
        <div class="monitor-card" [class.card-critical]="isCritical(card)" [class.card-expanded]="card.expanded"
             [attr.draggable]="true" (dragstart)="onDragStart(i)" (dragover)="onDragOver($event, i)" (drop)="onDrop(i)">

          <!-- Card Toolbar -->
          <div class="mc-toolbar">
            <div class="mc-drag" pTooltip="Drag to reorder">
              <i class="pi pi-bars"></i>
            </div>
            <div class="mc-badge" [class]="'badge-' + cardHealth(card)">
              {{ cardHealth(card) }}
            </div>
            <span class="mc-id">#{{ i + 1 }}</span>
            <div class="mc-toolbar-actions">
              <button pButton [icon]="card.expanded ? 'pi pi-minus' : 'pi pi-expand'" class="p-button-text p-button-sm p-button-rounded"
                      [pTooltip]="card.expanded ? 'Collapse' : 'Expand'" (click)="card.expanded = !card.expanded"></button>
              <button pButton icon="pi pi-refresh" class="p-button-text p-button-sm p-button-rounded" pTooltip="Refresh" (click)="fetchCardData(card)"></button>
              <button pButton icon="pi pi-times" class="p-button-text p-button-sm p-button-rounded p-button-danger" pTooltip="Remove" (click)="removeCard(card.id)"></button>
            </div>
          </div>

          <!-- Selectors -->
          <div class="mc-selectors">
            <div class="sel-row">
              <span class="sel-label">cluster</span>
              <p-select [options]="contexts" [(ngModel)]="card.context" placeholder="Select cluster..."
                        [filter]="true" [style]="{ width: '100%' }" (ngModelChange)="onContextSelect(card)" />
            </div>
            <div class="sel-row">
              <span class="sel-label">ns</span>
              <p-select [options]="card.namespaces" [(ngModel)]="card.namespace" placeholder="Select namespace..."
                        [filter]="true" [style]="{ width: '100%' }" (ngModelChange)="fetchCardData(card)" />
            </div>
          </div>

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

            <!-- Expanded View -->
            @if (card.expanded) {
              <!-- Deployments -->
              <div class="mc-section">
                <span class="section-label">Deployments</span>
                <div class="dep-bar">
                  <div class="dep-fill" [style.width.%]="depPct(card)"></div>
                </div>
                <span class="dep-ratio">{{ card.data.deployments?.healthy || 0 }}/{{ (card.data.deployments?.healthy || 0) + (card.data.deployments?.unavailable || 0) }} available</span>
              </div>

              <!-- Activity -->
              <div class="mc-section">
                <span class="section-label">Activity</span>
                <div class="activity-chart">
                  @for (bar of card.activityBars; track $index) {
                    <div class="act-bar" [style.height.%]="bar" [class.act-high]="bar > 70" [class.act-med]="bar > 40 && bar <= 70"></div>
                  }
                </div>
              </div>

              <!-- Recent Events -->
              @if (card.events.length > 0) {
                <div class="mc-section">
                  <span class="section-label">Recent ({{ card.events.length }})</span>
                  <div class="mc-events">
                    @for (ev of card.events | slice:0:3; track $index) {
                      <div class="mce-row">
                        <span class="mce-dot" [class.mce-warn]="ev.type === 'Warning'"></span>
                        <span class="mce-reason">{{ ev.reason }}</span>
                        <span class="mce-obj">{{ ev.object }}</span>
                      </div>
                    }
                  </div>
                </div>
              }
            }

            <!-- Footer -->
            <div class="mc-footer">
              @if (card.lastUpdated) {
                <span class="mc-time">{{ card.lastUpdated }}</span>
              }
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
    .mc-id { font-size: 10px; color: var(--text-muted); flex: 1; }
    .mc-toolbar-actions { display: flex; gap: 2px; }

    /* Selectors */
    .mc-selectors { display: flex; flex-direction: column; gap: 4px; }
    .sel-row { display: flex; align-items: center; gap: 6px; }
    .sel-label { font-size: 9px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; width: 36px; }

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
    .mc-footer { display: flex; align-items: center; }
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
    @media (max-width: 768px) { .monitor-grid { grid-template-columns: 1fr; } }
  `],
})
export class MonitorComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  contexts: string[] = [];
  cards: MonitorCard[] = [];
  private idCounter = 0;
  private refreshTimer: any;
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
    // Auto-refresh every 60s
    this.refreshTimer = setInterval(() => this.refreshAll(), 60000);
  }

  ngOnDestroy() { clearInterval(this.refreshTimer); }

  addCard() {
    const card: MonitorCard = {
      id: ++this.idCounter, context: '', namespace: '',
      loading: false, data: null, events: [], activityBars: [],
      expanded: true, lastUpdated: '', namespaces: [], order: this.cards.length,
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

  onContextSelect(card: MonitorCard) {
    if (!card.context) return;
    card.namespace = '';
    card.data = null;
    // Fetch namespaces for this context
    this.http.post<any>('http://localhost:8000/api/switch-context', { name: card.context }).subscribe(() => {
      this.http.get<any>('http://localhost:8000/api/namespaces').subscribe(res => {
        card.namespaces = res.namespaces || [];
      });
    });
  }

  fetchCardData(card: MonitorCard) {
    if (!card.context || !card.namespace) return;
    card.loading = true;
    this.http.post<any>('http://localhost:8000/api/switch-context', { name: card.context }).subscribe(() => {
      this.http.post<any>('http://localhost:8000/api/switch-namespace', { namespace: card.namespace }).subscribe(() => {
        this.http.get<any>('http://localhost:8000/api/overview').subscribe(res => {
          card.data = res;
          card.loading = false;
          card.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          this.saveCards();
        });
        this.http.get<any>('http://localhost:8000/api/events?limit=50').subscribe(res => {
          card.events = res.events || [];
          card.activityBars = this.buildBars(card.events);
        });
      });
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
    const saved = this.cards.map(c => ({ context: c.context, namespace: c.namespace, expanded: c.expanded }));
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
            expanded: s.expanded ?? true, lastUpdated: '', namespaces: [], order: this.cards.length,
          };
          this.cards.push(card);
          if (card.context && card.namespace) {
            this.onContextSelect(card);
            setTimeout(() => this.fetchCardData(card), 500);
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
