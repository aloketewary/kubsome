import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { PreferencesService } from '../../core/services/preferences.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, ButtonModule, TagModule, TooltipModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Settings</h1>
        <p class="subtitle">Customize your experience</p>
      </div>
    </div>

    <div class="settings-layout">
      <!-- Appearance -->
      <div class="settings-section">
        <div class="section-icon"><i class="pi pi-palette"></i></div>
        <div class="section-content">
          <h3>Appearance</h3>
          <p class="section-desc">Visual theme and display preferences</p>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-name">Theme</span>
              <span class="setting-hint">Choose between dark and light mode</span>
            </div>
            <div class="theme-toggle">
              <button class="toggle-btn" [class.active]="prefs.get('theme') === 'dark'" (click)="setTheme('dark')">
                <i class="pi pi-moon"></i>
                <span>Dark</span>
              </button>
              <button class="toggle-btn" [class.active]="prefs.get('theme') === 'light'" (click)="setTheme('light')">
                <i class="pi pi-sun"></i>
                <span>Light</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Data & Refresh -->
      <div class="settings-section">
        <div class="section-icon"><i class="pi pi-sync"></i></div>
        <div class="section-content">
          <h3>Data & Refresh</h3>
          <p class="section-desc">How often data updates automatically</p>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-name">Auto-refresh interval</span>
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
        </div>
      </div>

      <!-- Notifications -->
      <div class="settings-section">
        <div class="section-icon"><i class="pi pi-bell"></i></div>
        <div class="section-content">
          <h3>Notifications</h3>
          <p class="section-desc">Alert behavior for cluster events</p>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-name">Toast alerts</span>
              <span class="setting-hint">Show notifications when pods crash or recover</span>
            </div>
            <div class="toggle-switch" [class.on]="prefs.get('notifications')" (click)="prefs.set('notifications', !prefs.get('notifications'))">
              <div class="toggle-thumb"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Keyboard Shortcuts -->
      <div class="settings-section">
        <div class="section-icon"><i class="pi pi-key"></i></div>
        <div class="section-content">
          <h3>Keyboard Shortcuts</h3>
          <p class="section-desc">Navigate faster with your keyboard</p>

          <div class="shortcuts-table">
            @for (shortcut of shortcuts; track shortcut.key) {
              <div class="shortcut-row">
                <kbd>{{ shortcut.key }}</kbd>
                <span>{{ shortcut.action }}</span>
              </div>
            }
          </div>
        </div>
      </div>

      <!-- About -->
      <div class="settings-section">
        <div class="section-icon"><i class="pi pi-info-circle"></i></div>
        <div class="section-content">
          <h3>About Kubsome</h3>
          <p class="section-desc">AI-native Kubernetes Operations Platform</p>

          <div class="about-hero">
            <div class="about-logo">◆</div>
            <div class="about-tagline">
              <span class="about-name">Kubsome</span>
              <span class="about-version">v1.0.0</span>
            </div>
          </div>

          <p class="about-description">
            Faster debugging. Safer operations. Less cognitive load.
            Multi-interface Kubernetes operations platform with CLI, Web UI, API, and AI intelligence.
          </p>

          <div class="about-grid">
            <div class="about-item">
              <span class="about-label">API</span>
              <span class="about-value">72</span>
            </div>
            <div class="about-item">
              <span class="about-label">WebSocket</span>
              <span class="about-value">4</span>
            </div>
            <div class="about-item">
              <span class="about-label">Pages</span>
              <span class="about-value">22</span>
            </div>
            <div class="about-item">
              <span class="about-label">Commands</span>
              <span class="about-value">85+</span>
            </div>
          </div>

          <div class="about-credits">
            <span class="credits-label">Created by</span>
            <div class="credits-author">
              <div class="author-avatar">A</div>
              <div class="author-info">
                <span class="author-name">Aloke Tewary</span>
                <a href="https://github.com/aloketewary" target="_blank" class="author-handle">&#64;aloketewary</a>
              </div>
            </div>
          </div>

          <div class="about-links">
            <a href="http://localhost:8000/docs" target="_blank" class="about-link">
              <i class="pi pi-external-link"></i> API Docs
            </a>
            <a href="https://github.com/aloketewary/kubsome" target="_blank" class="about-link">
              <i class="pi pi-github"></i> GitHub
            </a>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

    .settings-layout { display: flex; flex-direction: column; gap: 12px; max-width: 640px; }

    .settings-section {
      display: flex;
      gap: 16px;
      padding: 20px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      transition: border-color 0.12s;
    }
    .settings-section:hover { border-color: var(--border-hover); }

    .section-icon {
      width: 36px; height: 36px; border-radius: 10px;
      background: var(--accent-subtle); color: var(--accent);
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; flex-shrink: 0;
    }
    .section-content { flex: 1; }
    .section-content h3 { font-size: 15px; font-weight: 600; margin: 0 0 2px; }
    .section-desc { font-size: 12px; color: var(--text-muted); margin: 0 0 14px; }

    .setting-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
    }
    .setting-info { display: flex; flex-direction: column; gap: 2px; }
    .setting-name { font-size: 13px; font-weight: 500; }
    .setting-hint { font-size: 11px; color: var(--text-muted); }

    /* Theme Toggle */
    .theme-toggle { display: flex; gap: 4px; background: var(--bg-elevated); border-radius: 8px; padding: 3px; }
    .toggle-btn {
      display: flex; align-items: center; gap: 5px;
      padding: 6px 12px; border-radius: 6px; border: none;
      background: transparent; color: var(--text-muted);
      font-size: 12px; cursor: pointer; transition: all 0.12s;
    }
    .toggle-btn i { font-size: 12px; }
    .toggle-btn.active { background: var(--bg-card); color: var(--text); box-shadow: 0 1px 3px rgba(0,0,0,0.2); }

    /* Interval Options */
    .interval-options { display: flex; gap: 4px; background: var(--bg-elevated); border-radius: 8px; padding: 3px; }
    .opt-btn {
      padding: 5px 10px; border-radius: 5px; border: none;
      background: transparent; color: var(--text-muted);
      font-size: 11px; cursor: pointer; transition: all 0.12s;
    }
    .opt-btn.active { background: var(--accent); color: #fff; }
    .opt-btn:hover:not(.active) { color: var(--text); }

    /* Toggle Switch */
    .toggle-switch {
      width: 40px; height: 22px; border-radius: 11px;
      background: var(--border); cursor: pointer;
      position: relative; transition: background 0.2s;
    }
    .toggle-switch.on { background: var(--accent); }
    .toggle-thumb {
      width: 16px; height: 16px; border-radius: 50%;
      background: #fff; position: absolute;
      top: 3px; left: 3px; transition: transform 0.2s;
    }
    .toggle-switch.on .toggle-thumb { transform: translateX(18px); }

    /* Shortcuts */
    .shortcuts-table { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
    .shortcut-row {
      display: flex; align-items: center; gap: 10px;
      padding: 6px 10px; border-radius: 6px; background: var(--bg-elevated);
    }
    .shortcut-row kbd {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px; font-weight: 600;
      padding: 2px 6px; border-radius: 4px;
      background: var(--bg); border: 1px solid var(--border);
      color: var(--text-muted); min-width: 28px; text-align: center;
    }
    .shortcut-row span { font-size: 12px; color: var(--text-secondary); }

    /* About */
    .about-hero {
      display: flex; align-items: center; gap: 10px; margin-bottom: 12px;
    }
    .about-logo {
      font-size: 24px; color: var(--accent);
    }
    .about-tagline { display: flex; align-items: baseline; gap: 8px; }
    .about-name { font-size: 18px; font-weight: 700; letter-spacing: -0.02em; }
    .about-version { font-size: 11px; color: var(--text-muted); background: var(--bg-elevated); padding: 2px 6px; border-radius: 4px; }
    .about-description { font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin: 0 0 14px; }

    .about-grid {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px;
    }

    .about-credits {
      padding: 12px; background: var(--bg-elevated); border-radius: 8px; margin-bottom: 12px;
    }
    .credits-label { font-size: 9px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; display: block; margin-bottom: 8px; }
    .credits-author { display: flex; align-items: center; gap: 10px; }
    .author-avatar {
      width: 32px; height: 32px; border-radius: 50%;
      background: linear-gradient(135deg, var(--accent), var(--purple));
      color: #fff; display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 700;
    }
    .author-info { display: flex; flex-direction: column; }
    .author-name { font-size: 13px; font-weight: 600; }
    .author-handle { font-size: 11px; color: var(--accent); }
    .about-item {
      padding: 10px; border-radius: 8px; background: var(--bg-elevated); text-align: center;
    }
    .about-label { display: block; font-size: 9px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 2px; }
    .about-value { display: block; font-size: 14px; font-weight: 700; }

    .about-links { display: flex; gap: 10px; }
    .about-link {
      display: flex; align-items: center; gap: 5px;
      font-size: 12px; color: var(--accent);
      padding: 6px 12px; border-radius: 6px;
      border: 1px solid var(--border); transition: all 0.12s;
    }
    .about-link:hover { border-color: var(--accent); background: var(--accent-subtle); }
    .about-link i { font-size: 12px; }
  `],
})
export class SettingsComponent {
  prefs = inject(PreferencesService);

  refreshOptions = [
    { label: '10s', value: 10000 },
    { label: '30s', value: 30000 },
    { label: '60s', value: 60000 },
    { label: 'Off', value: 0 },
  ];

  shortcuts = [
    { key: '⌘K', action: 'Command Palette' },
    { key: 'G D', action: 'Dashboard' },
    { key: 'G P', action: 'Pods' },
    { key: 'G E', action: 'Events' },
    { key: 'G L', action: 'Logs' },
    { key: 'G T', action: 'Terminal' },
    { key: 'G A', action: 'AI Assistant' },
    { key: 'G M', action: 'Metrics' },
    { key: 'G R', action: 'Runbooks' },
    { key: 'G S', action: 'Settings' },
    { key: 'H', action: 'Help' },
    { key: 'ESC', action: 'Close overlay' },
  ];

  setTheme(theme: 'dark' | 'light') {
    this.prefs.set('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }
}
