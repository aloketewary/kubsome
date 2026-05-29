import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TooltipModule } from 'primeng/tooltip';
import { PreferencesService } from '../../core/services/preferences.service';
import { ConfirmService } from '../../shared/services/confirm.service';
import { IntelHeaderComponent } from '../../shared/components/futuristic/intel-header.component';
import { HoloCardComponent } from '../../shared/components/futuristic/holo-card.component';
import { StatusBeaconComponent } from '../../shared/components/futuristic/status-beacon.component';
import { ActionIconComponent } from '../../shared/components/futuristic/action-icon.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, TooltipModule, IntelHeaderComponent, HoloCardComponent, StatusBeaconComponent, ActionIconComponent],
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
  webhookSaving = false; webhookMsg = '';
  themes = [{ id: 'dark', label: 'Dark' }, { id: 'light', label: 'Light' }];
  shortcutGroups = [
    { label: 'Navigation', items: [{ key: '⌘K', action: 'Command Palette' }, { key: 'G D', action: 'Dashboard' }, { key: 'G P', action: 'Pods' }, { key: 'G E', action: 'Events' }, { key: 'G L', action: 'Logs' }] },
    { label: 'Actions', items: [{ key: 'G T', action: 'Terminal' }, { key: 'G A', action: 'AI' }, { key: 'G R', action: 'Runbooks' }, { key: 'H', action: 'Help' }] },
  ];

  ngOnInit() {
    this.http.get<any>('/api/version').subscribe({ next: (res) => this.appVersion = res.version || '1.7.6', error: () => this.appVersion = '1.7.6' });
    this.http.get<any>('/api/contexts').subscribe({ next: (res) => { this.clusterInfo.context = res.current || ''; this.clusterInfo.connected = true; const ctx = (res.contexts || []).find((c: any) => c.name === res.current); this.clusterInfo.server = ctx?.cluster || ''; } });
    this.http.get<any>('/api/namespaces').subscribe({ next: (res) => { this.clusterInfo.namespace = res.current || ''; } });
    this.http.get<any>('/api/webhooks').subscribe({ next: (res) => { this.webhooks = res.webhooks || []; } });
  }

  setTheme(theme: string) { this.prefs.set('theme', theme as any); document.documentElement.setAttribute('data-theme', theme); }
  toggleNotifications() { const e = !this.prefs.get('notifications'); this.prefs.set('notifications', e); if (e && 'Notification' in window && Notification.permission !== 'granted') Notification.requestPermission(); }
  addWebhook() { this.webhooks = [...this.webhooks, { type: 'slack', url: '' }]; }
  removeWebhook(i: number) { this.webhooks = this.webhooks.filter((_, idx) => idx !== i); }
  saveWebhooks() { this.webhookSaving = true; this.http.post<any>('/api/webhooks', { webhooks: this.webhooks.filter(w => w.url.trim()) }).subscribe({ next: () => { this.webhookMsg = '✓ Saved'; this.webhookSaving = false; }, error: () => { this.webhookMsg = 'Failed'; this.webhookSaving = false; } }); }
  testWebhook() { this.http.post<any>('/api/webhook/test', {}).subscribe({ next: (res) => { this.webhookMsg = `✓ Sent to ${res.sent_to}`; } }); }
  resetAll() { this.confirmService.confirm({ title: 'Reset All', message: 'Clear all preferences?', confirmLabel: 'Reset', severity: 'danger' }).then(ok => { if (ok) { Object.keys(localStorage).filter(k => k.startsWith('kubsome_')).forEach(k => localStorage.removeItem(k)); window.location.reload(); } }); }
}
