import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SlicePipe } from '@angular/common';
import { forkJoin } from 'rxjs';
import { Select } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';

import { HealthRingComponent, SparklineComponent, IntelHeaderComponent } from '../../shared/components/futuristic';

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
  prevHealthPct: number;
}

@Component({
  selector: 'app-monitor',
  standalone: true,
  imports: [FormsModule, SlicePipe, Select, ButtonModule, TagModule, TooltipModule, DialogModule, HealthRingComponent, SparklineComponent, IntelHeaderComponent],
  templateUrl: './monitor.html',
  styleUrl: './monitor.scss',
})
export class MonitorComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private router = inject(Router);
  contexts: string[] = [];
  cards: MonitorCard[] = [];
  signals: any = null;
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

  /** P0: Cards needing attention (health < 90%), sorted worst-first */
  get attentionCards(): MonitorCard[] {
    return this.cards
      .filter(c => c.data && this.healthPct(c) < 90)
      .sort((a, b) => this.healthPct(a) - this.healthPct(b));
  }

  /** P0: Auto-sort cards by severity (critical → warning → healthy) */
  get sortedCards(): MonitorCard[] {
    return [...this.cards].sort((a, b) => this.healthPct(a) - this.healthPct(b));
  }

  ngOnInit() {
    this.http.get<any>('/api/contexts').subscribe(res => {
      this.contexts = (res.contexts || []).map((c: any) => c.name);
    });
    this.loadSavedCards();
    this.fetchSignals();
    this.startCardTimers();
  }

  ngOnDestroy() { this.stopCardTimers(); }

  fetchSignals() {
    this.http.get<any>('/api/monitor/health-signals').subscribe({
      next: (res) => { this.signals = res; },
      error: () => { this.signals = null; },
    });
  }

  navigateTo(path: string) {
    this.router.navigateByUrl(path);
  }

  addCard() {
    const card: MonitorCard = {
      id: ++this.idCounter, context: '', namespace: '', app: '',
      loading: false, data: null, events: [], activityBars: [],
      expanded: true, configuring: true, fullscreen: false, refreshInterval: 60,
      lastUpdated: '', namespaces: [], apps: [], order: this.cards.length,
      alertEnabled: false, alertThreshold: 70, actionLog: [],
      prevHealthPct: -1,
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
    const grouped = new Map<number, MonitorCard[]>();
    for (const card of this.cards) {
      if (card.refreshInterval > 0 && card.context && card.namespace) {
        const group = grouped.get(card.refreshInterval) || [];
        group.push(card);
        grouped.set(card.refreshInterval, group);
      }
    }
    grouped.forEach((cards, interval) => {
      const timer = setInterval(() => {
        cards.filter(c => c.context && c.namespace).forEach(c => this.fetchCardData(c));
      }, interval * 1000);
      this.cardTimers.set(cards[0].id, timer);
    });
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
    card.namespaces = [];
    card.data = null;
    this.http.get<any>('/api/ns-for-context', { params: { ctx: card.context } }).subscribe({
      next: (res) => {
        card.namespaces = res.namespaces || [];
        if (res.error) { card.data = { error: res.error }; }
      },
      error: () => { card.namespaces = []; },
    });
  }

  onNamespaceSelect(card: MonitorCard) {
    card.app = '';
    card.apps = [];
    if (!card.context || !card.namespace) return;
    this.http.get<any>('/api/monitor/apps', { params: { ctx: card.context, ns: card.namespace } }).subscribe({
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
    // P2: Store previous health before fetching new data
    if (card.data) {
      card.prevHealthPct = this.healthPct(card);
    }
    card.loading = true;
    const params: any = { ctx: card.context, ns: card.namespace };
    if (card.app) params.app = card.app;
    this.http.get<any>('/api/monitor/overview', { params }).subscribe({
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

  /** P1: Warning event count */
  warningEventCount(card: MonitorCard): number {
    return (card.events || []).filter((e: any) => e.type === 'Warning').length;
  }

  /** P1: Critical event count */
  criticalEventCount(card: MonitorCard): number {
    return (card.events || []).filter((e: any) =>
      e.type !== 'Normal' && /Kill|OOM|Back|Failed|Error/i.test(e.reason || '')
    ).length;
  }

  /** P2: Health delta from previous fetch */
  healthDelta(card: MonitorCard): number {
    if (card.prevHealthPct < 0) return 0;
    return this.healthPct(card) - card.prevHealthPct;
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
    this.router.navigateByUrl(`/pods?filter=${card.namespace}`);
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
        const cardsToFetch: MonitorCard[] = [];
        for (const s of saved) {
          const card: MonitorCard = {
            id: ++this.idCounter, context: s.context || '', namespace: s.namespace || '', app: s.app || '',
            loading: false, data: null, events: [], activityBars: [],
            expanded: s.expanded ?? true, configuring: !(s.context && s.namespace), fullscreen: false,
            refreshInterval: s.refreshInterval || 60, lastUpdated: '', namespaces: [], apps: [], order: this.cards.length,
            alertEnabled: s.alertEnabled || false, alertThreshold: s.alertThreshold || 70,
            actionLog: s.actionLog || [], prevHealthPct: -1,
          };
          this.cards.push(card);
          if (card.context && card.namespace) cardsToFetch.push(card);
        }
        if (cardsToFetch.length > 0) {
          const nsRequests = cardsToFetch.map(c =>
            this.http.get<any>('/api/ns-for-context', { params: { ctx: c.context } })
          );
          forkJoin(nsRequests).subscribe(results => {
            results.forEach((res, i) => {
              const card = cardsToFetch[i];
              card.namespaces = res.namespaces || [];
            });
            cardsToFetch.forEach(card => this.fetchCardData(card));
            this.startCardTimers();
          });
        }
      } else {
        this.addCard();
      }
    } catch {
      this.addCard();
    }
  }
}
