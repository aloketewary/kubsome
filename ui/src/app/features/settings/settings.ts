import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { PreferencesService } from '../../core/services/preferences.service';
import { SpotlightComponent } from '../../shared/components/spotlight.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { ConfirmService } from '../../shared/services/confirm.service';


@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, ButtonModule, TagModule, TooltipModule, SpotlightComponent, PageHeaderComponent],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class SettingsComponent implements OnInit {
  prefs = inject(PreferencesService);
  private http = inject(HttpClient);
  private confirmService = inject(ConfirmService);
  appVersion = '...';
  clusterInfo: any = { context: '', namespace: '', server: '', connected: false };
  webhooks: { type: string; url: string }[] = [];
  webhookSaving = false;
  webhookMsg = '';
  private webhookPlaceholders: Record<string, string> = {};

  themes = [
    { id: 'dark', label: 'Dark' },
    { id: 'light', label: 'Light' },
  ];

  refreshOptions = [
    { label: '10s', value: 10000 },
    { label: '30s', value: 30000 },
    { label: '60s', value: 60000 },
    { label: 'Off', value: 0 },
  ];

  shortcutGroups = [
    {
      label: 'Navigation',
      items: [
        { key: '⌘K', action: 'Command Palette' },
        { key: 'G D', action: 'Dashboard' },
        { key: 'G P', action: 'Pods' },
        { key: 'G E', action: 'Events' },
        { key: 'G L', action: 'Logs' },
        { key: 'G M', action: 'Metrics' },
      ],
    },
    {
      label: 'Actions',
      items: [
        { key: 'G T', action: 'Terminal' },
        { key: 'G A', action: 'AI Assistant' },
        { key: 'G R', action: 'Runbooks' },
        { key: 'G S', action: 'Settings' },
        { key: 'H', action: 'Help' },
        { key: 'ESC', action: 'Close overlay' },
      ],
    },
  ];

  ngOnInit() {
    this.http.get<any>('/api/version').subscribe({
      next: (res) => this.appVersion = res.version || '1.7.6',
      error: () => this.appVersion = '1.7.6',
    });
    this.http.get<any>('/api/contexts').subscribe({
      next: (res) => {
        this.clusterInfo.context = res.current || '';
        this.clusterInfo.connected = true;
        const ctx = (res.contexts || []).find((c: any) => c.name === res.current);
        this.clusterInfo.server = ctx?.cluster || '';
      },
      error: () => { this.clusterInfo.connected = false; },
    });
    this.http.get<any>('/api/namespaces').subscribe({
      next: (res) => { this.clusterInfo.namespace = res.current || ''; },
    });
    this.http.get<any>('/api/webhooks').subscribe({
      next: (res) => { this.webhooks = res.webhooks || []; },
    });
    this.http.get<Record<string, string>>('/api/webhook/placeholders').subscribe({
      next: (res) => { this.webhookPlaceholders = res; },
    });
  }

  setTheme(theme: string) {
    this.prefs.set('theme', theme as 'dark' | 'light');
    document.documentElement.setAttribute('data-theme', theme);
  }

  toggleNotifications() {
    const enabled = !this.prefs.get('notifications');
    this.prefs.set('notifications', enabled);
    if (enabled && 'Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  }

  resetSpotlights() {
    Object.keys(localStorage).filter(k => k.startsWith('kubsome_spotlight_')).forEach(k => localStorage.removeItem(k));
  }

  addWebhook() {
    this.webhooks = [...this.webhooks, { type: 'slack', url: '' }];
  }

  removeWebhook(index: number) {
    this.webhooks = this.webhooks.filter((_, i) => i !== index);
  }

  saveWebhooks() {
    this.webhookSaving = true;
    this.webhookMsg = '';
    const valid = this.webhooks.filter(w => w.url.trim());
    this.http.post<any>('/api/webhooks', { webhooks: valid }).subscribe({
      next: () => { this.webhookMsg = '✓ Saved'; this.webhookSaving = false; setTimeout(() => this.webhookMsg = '', 3000); },
      error: () => { this.webhookMsg = 'Save failed'; this.webhookSaving = false; },
    });
  }

  testWebhook() {
    this.webhookMsg = 'Sending...';
    this.http.post<any>('/api/webhook/test', {}).subscribe({
      next: (res) => { this.webhookMsg = `✓ Sent to ${res.sent_to} webhook(s)`; setTimeout(() => this.webhookMsg = '', 3000); },
      error: () => { this.webhookMsg = 'Test failed'; },
    });
  }

  webhookPlaceholder(type: string): string {
    return this.webhookPlaceholders[type] ?? this.webhookPlaceholders['generic'] ?? '';
  }

  clearMonitorCards() {
    localStorage.removeItem('kubsome_monitor_cards');
  }

  resetAll() {
    this.confirmService.confirm({
      title: 'Reset All Settings',
      message: 'This will clear all preferences, monitor cards, and onboarding state. Continue?',
      confirmLabel: 'Reset',
      severity: 'danger',
    }).then(ok => {
      if (ok) {
        Object.keys(localStorage).filter(k => k.startsWith('kubsome_')).forEach(k => localStorage.removeItem(k));
        window.location.reload();
      }
    });
  }
}
