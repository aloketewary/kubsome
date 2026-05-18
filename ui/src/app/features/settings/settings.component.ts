import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { PreferencesService } from '../../core/services/preferences.service';
import { SpotlightComponent } from '../../shared/components/spotlight.component';
import { ConfirmService } from '../../shared/services/confirm.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, ButtonModule, TagModule, TooltipModule, SpotlightComponent],
  template: `
    <app-spotlight id="settings" title="Settings" icon="pi pi-cog"
      description="Configure theme, refresh intervals, and preferences."
      [capabilities]="['Theme selection', 'Refresh intervals', 'Shortcuts reference', 'Data management']" [compact]="true" />

    <div class="page-header">
      <div>
        <h1>Settings</h1>
        <p class="subtitle">Customize your workspace</p>
      </div>
    </div>

    <div class="settings-grid">
      <!-- Left: Settings -->
      <div class="settings-main">
        <!-- Cluster Info -->
        <div class="settings-section">
          <div class="section-header">
            <div class="section-icon icon-cluster"><i class="pi pi-server"></i></div>
            <div><h3>Cluster Connection</h3><p class="section-desc">Current active connection</p></div>
          </div>
          <div class="cluster-info-grid">
            <div class="ci-item">
              <span class="ci-label">Context</span>
              <code class="ci-value">{{ clusterInfo.context || '—' }}</code>
            </div>
            <div class="ci-item">
              <span class="ci-label">Namespace</span>
              <code class="ci-value">{{ clusterInfo.namespace || '—' }}</code>
            </div>
            <div class="ci-item">
              <span class="ci-label">Server</span>
              <code class="ci-value">{{ clusterInfo.server || '—' }}</code>
            </div>
            <div class="ci-item">
              <span class="ci-label">Status</span>
              <span class="ci-status" [class.ci-ok]="clusterInfo.connected" [class.ci-err]="!clusterInfo.connected">
                <span class="ci-dot"></span> {{ clusterInfo.connected ? 'Connected' : 'Disconnected' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Appearance -->
        <div class="settings-section">
          <div class="section-header">
            <div class="section-icon icon-theme"><i class="pi pi-palette"></i></div>
            <div><h3>Appearance</h3><p class="section-desc">Visual theme and display</p></div>
          </div>
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-name">Theme</span>
              <span class="setting-hint">Interface color scheme</span>
            </div>
            <div class="theme-switcher">
              @for (t of themes; track t.id) {
                <button class="theme-card" [class.active]="prefs.get('theme') === t.id" (click)="setTheme(t.id)">
                  <div class="tc-preview" [class]="'tc-' + t.id"></div>
                  <span class="tc-label">{{ t.label }}</span>
                </button>
              }
            </div>
          </div>
        </div>

        <!-- Data & Refresh -->
        <div class="settings-section">
          <div class="section-header">
            <div class="section-icon icon-data"><i class="pi pi-sync"></i></div>
            <div><h3>Data & Refresh</h3><p class="section-desc">Auto-update intervals</p></div>
          </div>
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-name">Auto-refresh</span>
              <span class="setting-hint">Dashboard and pod data refresh rate</span>
            </div>
            <div class="interval-options">
              @for (opt of refreshOptions; track opt.value) {
                <button class="opt-btn" [class.active]="prefs.get('refreshInterval') === opt.value" (click)="prefs.set('refreshInterval', opt.value)">
                  {{ opt.label }}
                </button>
              }
            </div>
          </div>
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-name">Notifications</span>
              <span class="setting-hint">Browser alerts for pod crashes and recoveries</span>
            </div>
            <div class="toggle-switch" [class.on]="prefs.get('notifications')" (click)="toggleNotifications()">
              <div class="toggle-thumb"></div>
            </div>
          </div>
        </div>

        <!-- Webhooks -->
        <div class="settings-section">
          <div class="section-header">
            <div class="section-icon icon-webhook"><i class="pi pi-bell"></i></div>
            <div><h3>Webhook Notifications</h3><p class="section-desc">Send alerts to Slack, Teams, Webex, or custom endpoints</p></div>
          </div>

          @for (hook of webhooks; track $index; let i = $index) {
            <div class="webhook-row">
              <select class="wh-type" [(ngModel)]="hook.type">
                <option value="slack">Slack</option>
                <option value="teams">Teams</option>
                <option value="webex">Webex</option>
                <option value="generic">Generic</option>
              </select>
              <input class="wh-url" [(ngModel)]="hook.url" [placeholder]="webhookPlaceholder(hook.type)" />
              <button class="wh-remove" (click)="removeWebhook(i)" pTooltip="Remove"><i class="pi pi-trash"></i></button>
            </div>
          }

          <div class="webhook-actions">
            <button pButton icon="pi pi-plus" label="Add Webhook" class="p-button-sm p-button-outlined" (click)="addWebhook()"></button>
            @if (webhooks.length > 0) {
              <button pButton icon="pi pi-save" label="Save" class="p-button-sm" (click)="saveWebhooks()" [disabled]="webhookSaving"></button>
              <button pButton icon="pi pi-send" label="Test" class="p-button-sm p-button-outlined p-button-success" (click)="testWebhook()" [disabled]="webhookSaving"></button>
            }
            @if (webhookMsg) {
              <span class="wh-msg" [class.wh-ok]="webhookMsg.includes('✓')">{{ webhookMsg }}</span>
            }
          </div>
        </div>

        <!-- Keyboard Shortcuts -->
        <div class="settings-section">
          <div class="section-header">
            <div class="section-icon icon-keys"><i class="pi pi-key"></i></div>
            <div><h3>Keyboard Shortcuts</h3><p class="section-desc">Navigate faster</p></div>
          </div>
          <div class="shortcuts-grid">
            @for (group of shortcutGroups; track group.label) {
              <div class="sc-group">
                <span class="sc-group-label">{{ group.label }}</span>
                @for (sc of group.items; track sc.key) {
                  <div class="sc-row">
                    <kbd>{{ sc.key }}</kbd>
                    <span>{{ sc.action }}</span>
                  </div>
                }
              </div>
            }
          </div>
        </div>

        <!-- Data Management -->
        <div class="settings-section section-danger">
          <div class="section-header">
            <div class="section-icon icon-danger"><i class="pi pi-shield"></i></div>
            <div><h3>Data Management</h3><p class="section-desc">Reset and clear stored data</p></div>
          </div>
          <div class="danger-actions">
            <div class="danger-row">
              <div class="setting-info">
                <span class="setting-name">Reset onboarding</span>
                <span class="setting-hint">Show all feature spotlights again</span>
              </div>
              <button pButton label="Reset" icon="pi pi-refresh" class="p-button-sm p-button-outlined" (click)="resetSpotlights()"></button>
            </div>
            <div class="danger-row">
              <div class="setting-info">
                <span class="setting-name">Clear monitor cards</span>
                <span class="setting-hint">Remove all saved monitor configurations</span>
              </div>
              <button pButton label="Clear" icon="pi pi-trash" class="p-button-sm p-button-outlined p-button-warning" (click)="clearMonitorCards()"></button>
            </div>
            <div class="danger-row">
              <div class="setting-info">
                <span class="setting-name">Reset all preferences</span>
                <span class="setting-hint">Restore all settings to defaults</span>
              </div>
              <button pButton label="Reset All" icon="pi pi-exclamation-triangle" class="p-button-sm p-button-outlined p-button-danger" (click)="resetAll()"></button>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: About -->
      <div class="settings-aside">
        <div class="about-card">
          <div class="about-logo"><i class="pi pi-box"></i></div>
          <div class="about-name">Kubsome</div>
          <p-tag [value]="'v' + appVersion" severity="info" [rounded]="true" />
          <p class="about-tagline">AI-native Kubernetes Operations</p>

          <div class="about-stats">
            <div class="as-item"><span class="as-val">72</span><span class="as-label">APIs</span></div>
            <div class="as-item"><span class="as-val">30+</span><span class="as-label">Pages</span></div>
            <div class="as-item"><span class="as-val">85+</span><span class="as-label">Commands</span></div>
          </div>

          <div class="about-author">
            <div class="author-avatar">A</div>
            <div class="author-info">
              <span class="author-name">Aloke Tewary</span>
              <a href="https://github.com/aloketewary" target="_blank" class="author-link">&#64;aloketewary</a>
            </div>
          </div>

          <div class="about-links">
            <a href="https://github.com/aloketewary/kubsome" target="_blank" class="alink"><i class="pi pi-github"></i> GitHub</a>
            <a href="/docs" target="_blank" class="alink"><i class="pi pi-book"></i> Docs</a>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-header { margin-bottom: 20px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

    .settings-grid { display: grid; grid-template-columns: 1fr 260px; gap: 20px; align-items: start; }
    @media (max-width: 900px) { .settings-grid { grid-template-columns: 1fr; } }

    .settings-main { display: flex; flex-direction: column; gap: 12px; }

    .settings-section {
      padding: 20px; background: var(--bg-card); border: 1px solid var(--border);
      border-radius: var(--radius); transition: border-color 0.2s;
    }
    .settings-section:hover { border-color: var(--border-hover); }
    .section-danger { border-color: rgba(244,63,94,0.2); }
    .section-danger:hover { border-color: rgba(244,63,94,0.4); }

    .section-header { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 16px; }
    .section-icon {
      width: 34px; height: 34px; border-radius: 9px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center; font-size: 15px;
    }
    .icon-cluster { background: var(--success-subtle); color: var(--success); }
    .icon-theme { background: var(--accent-subtle); color: var(--accent); }
    .icon-data { background: var(--warning-subtle); color: var(--warning); }
    .icon-keys { background: var(--bg-elevated); color: var(--text-muted); }
    .icon-webhook { background: rgba(168,85,247,0.1); color: #a855f7; }
    .icon-danger { background: var(--danger-subtle); color: var(--danger); }
    .section-header h3 { font-size: 14px; font-weight: 600; margin: 0; }
    .section-desc { font-size: 11px; color: var(--text-muted); margin: 2px 0 0; }

    .setting-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 0; border-bottom: 1px solid var(--border);
    }
    .setting-row:last-child { border-bottom: none; padding-bottom: 0; }
    .setting-info { display: flex; flex-direction: column; gap: 2px; }
    .setting-name { font-size: 13px; font-weight: 500; }
    .setting-hint { font-size: 11px; color: var(--text-muted); }

    /* Cluster Info */
    .cluster-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .ci-item { padding: 10px 12px; background: var(--bg-elevated); border-radius: 8px; }
    .ci-label { display: block; font-size: 9px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px; }
    .ci-value { font-size: 11px; font-family: 'JetBrains Mono', monospace; word-break: break-all; }
    .ci-status { display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 500; }
    .ci-dot { width: 6px; height: 6px; border-radius: 50%; }
    .ci-ok { color: var(--success); }
    .ci-ok .ci-dot { background: var(--success); }
    .ci-err { color: var(--danger); }
    .ci-err .ci-dot { background: var(--danger); }

    /* Theme Switcher */
    .theme-switcher { display: flex; gap: 8px; }
    .theme-card {
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      padding: 8px 12px; border-radius: 8px; border: 2px solid var(--border);
      background: var(--bg-elevated); cursor: pointer; transition: all 0.2s;
    }
    .theme-card:hover { border-color: var(--border-hover); }
    .theme-card.active { border-color: var(--accent); background: var(--accent-subtle); }
    .tc-preview { width: 32px; height: 20px; border-radius: 4px; border: 1px solid var(--border); }
    .tc-dark { background: #0f0f11; }
    .tc-light { background: #f8f9fa; }
    .tc-label { font-size: 10px; color: var(--text-muted); }
    .theme-card.active .tc-label { color: var(--accent); }

    /* Interval */
    .interval-options { display: flex; gap: 3px; background: var(--bg-elevated); border-radius: 8px; padding: 3px; }
    .opt-btn {
      padding: 5px 10px; border-radius: 5px; border: none;
      background: transparent; color: var(--text-muted);
      font-size: 11px; cursor: pointer; transition: all 0.2s;
    }
    .opt-btn.active { background: var(--accent); color: #fff; }
    .opt-btn:hover:not(.active) { color: var(--text); }

    /* Toggle */
    .toggle-switch {
      width: 40px; height: 22px; border-radius: 11px;
      background: var(--border); cursor: pointer; position: relative; transition: background 0.2s;
    }
    .toggle-switch.on { background: var(--accent); }
    .toggle-thumb {
      width: 16px; height: 16px; border-radius: 50%; background: #fff;
      position: absolute; top: 3px; left: 3px; transition: transform 0.2s;
    }
    .toggle-switch.on .toggle-thumb { transform: translateX(18px); }

    /* Shortcuts */
    .shortcuts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .sc-group-label { font-size: 9px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; display: block; margin-bottom: 6px; }
    .sc-row { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
    .sc-row kbd {
      font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 600;
      padding: 2px 6px; border-radius: 4px; background: var(--bg-elevated);
      border: 1px solid var(--border); color: var(--text-muted); min-width: 28px; text-align: center;
    }
    .sc-row span { font-size: 11px; color: var(--text-secondary); }

    /* Danger Zone */
    .danger-actions { display: flex; flex-direction: column; gap: 10px; }
    .danger-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; }

    /* About Aside */
    .settings-aside { position: sticky; top: 20px; }
    .about-card {
      padding: 24px; background: var(--bg-card); border: 1px solid var(--border);
      border-radius: var(--radius); text-align: center;
      display: flex; flex-direction: column; align-items: center; gap: 8px;
    }
    .about-logo { font-size: 28px; color: var(--accent); }
    .about-name { font-size: 18px; font-weight: 700; letter-spacing: -0.02em; }
    .about-tagline { font-size: 11px; color: var(--text-muted); margin: 0; }

    .about-stats { display: flex; gap: 12px; margin: 12px 0; width: 100%; }
    .as-item { flex: 1; text-align: center; padding: 8px; background: var(--bg-elevated); border-radius: 6px; }
    .as-val { display: block; font-size: 14px; font-weight: 700; }
    .as-label { display: block; font-size: 9px; color: var(--text-muted); text-transform: uppercase; }

    .about-author {
      display: flex; align-items: center; gap: 10px; width: 100%;
      padding: 12px; background: var(--bg-elevated); border-radius: 8px; margin-top: 4px;
    }
    .author-avatar {
      width: 32px; height: 32px; border-radius: 50%;
      background: linear-gradient(135deg, var(--accent), var(--purple));
      color: #fff; display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700; flex-shrink: 0;
    }
    .author-info { display: flex; flex-direction: column; text-align: left; }
    .author-name { font-size: 12px; font-weight: 600; }
    .author-link { font-size: 11px; color: var(--accent); text-decoration: none; }

    .about-links { display: flex; gap: 8px; margin-top: 8px; width: 100%; }
    .alink {
      flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px;
      font-size: 11px; color: var(--text-muted); text-decoration: none;
      padding: 8px; border-radius: 6px; border: 1px solid var(--border); transition: all 0.2s;
    }
    .alink:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-subtle); }
    .alink i { font-size: 12px; }

    /* Webhooks */
    .webhook-row {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 0; border-bottom: 1px solid var(--border);
    }
    .webhook-row:last-of-type { border-bottom: none; }
    .wh-type {
      padding: 7px 10px; border-radius: 6px; border: 1px solid var(--border);
      background: var(--bg-elevated); color: var(--text); font-size: 12px;
      outline: none; min-width: 90px;
    }
    .wh-type:focus { border-color: var(--accent); }
    .wh-url {
      flex: 1; padding: 7px 10px; border-radius: 6px; border: 1px solid var(--border);
      background: var(--bg-elevated); color: var(--text); font-size: 11px;
      font-family: 'JetBrains Mono', monospace; outline: none;
    }
    .wh-url:focus { border-color: var(--accent); }
    .wh-remove {
      width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--border);
      background: transparent; color: var(--text-muted); cursor: pointer;
      display: flex; align-items: center; justify-content: center; font-size: 12px;
      transition: all 0.2s;
    }
    .wh-remove:hover { border-color: var(--danger); color: var(--danger); background: var(--danger-subtle); }
    .webhook-actions { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
    .wh-msg { font-size: 11px; color: var(--text-muted); }
    .wh-msg.wh-ok { color: var(--success); }
  `],
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
