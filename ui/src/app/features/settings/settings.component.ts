import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { PreferencesService } from '../../core/services/preferences.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, ButtonModule, TagModule],
  template: `
    <div class="page-header">
      <h1>Settings</h1>
      <p class="subtitle">Customize your KubeEasy experience</p>
    </div>

    <div class="settings-grid">
      <!-- Theme -->
      <div class="setting-card">
        <div class="setting-header">
          <i class="pi pi-palette"></i>
          <div>
            <span class="setting-title">Theme</span>
            <span class="setting-desc">Switch between dark and light mode</span>
          </div>
        </div>
        <div class="setting-control">
          <button class="theme-btn" [class.active]="prefs.get('theme') === 'dark'" (click)="setTheme('dark')">
            <i class="pi pi-moon"></i> Dark
          </button>
          <button class="theme-btn" [class.active]="prefs.get('theme') === 'light'" (click)="setTheme('light')">
            <i class="pi pi-sun"></i> Light
          </button>
        </div>
      </div>

      <!-- Refresh Interval -->
      <div class="setting-card">
        <div class="setting-header">
          <i class="pi pi-sync"></i>
          <div>
            <span class="setting-title">Auto-refresh</span>
            <span class="setting-desc">Dashboard refresh interval</span>
          </div>
        </div>
        <div class="setting-control">
          @for (opt of refreshOptions; track opt.value) {
            <button class="option-btn" [class.active]="prefs.get('refreshInterval') === opt.value"
                    (click)="prefs.set('refreshInterval', opt.value)">
              {{ opt.label }}
            </button>
          }
        </div>
      </div>

      <!-- Notifications -->
      <div class="setting-card">
        <div class="setting-header">
          <i class="pi pi-bell"></i>
          <div>
            <span class="setting-title">Notifications</span>
            <span class="setting-desc">Toast alerts for pod crashes</span>
          </div>
        </div>
        <div class="setting-control">
          <button class="option-btn" [class.active]="prefs.get('notifications')" (click)="prefs.set('notifications', true)">On</button>
          <button class="option-btn" [class.active]="!prefs.get('notifications')" (click)="prefs.set('notifications', false)">Off</button>
        </div>
      </div>

      <!-- Keyboard Shortcuts Reference -->
      <div class="setting-card full-width">
        <div class="setting-header">
          <i class="pi pi-key"></i>
          <div>
            <span class="setting-title">Keyboard Shortcuts</span>
            <span class="setting-desc">Navigate faster</span>
          </div>
        </div>
        <div class="shortcuts-grid">
          <div class="shortcut"><kbd>⌘K</kbd><span>Command Palette</span></div>
          <div class="shortcut"><kbd>G D</kbd><span>Dashboard</span></div>
          <div class="shortcut"><kbd>G P</kbd><span>Pods</span></div>
          <div class="shortcut"><kbd>G E</kbd><span>Events</span></div>
          <div class="shortcut"><kbd>G L</kbd><span>Logs</span></div>
          <div class="shortcut"><kbd>G T</kbd><span>Terminal</span></div>
          <div class="shortcut"><kbd>G A</kbd><span>AI Assistant</span></div>
          <div class="shortcut"><kbd>H</kbd><span>Help</span></div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-header { margin-bottom: 28px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

    .settings-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 12px;
    }
    .setting-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 20px;
    }
    .setting-card.full-width { grid-column: 1 / -1; }
    .setting-header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 16px;
    }
    .setting-header > i { font-size: 18px; color: var(--accent); margin-top: 2px; }
    .setting-title { display: block; font-size: 14px; font-weight: 600; }
    .setting-desc { display: block; font-size: 12px; color: var(--text-muted); margin-top: 2px; }

    .setting-control { display: flex; gap: 6px; }
    .theme-btn, .option-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--bg-elevated);
      color: var(--text-secondary);
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .theme-btn:hover, .option-btn:hover { border-color: var(--border-hover); color: var(--text); }
    .theme-btn.active, .option-btn.active {
      border-color: var(--accent);
      background: var(--accent-subtle);
      color: var(--accent);
    }

    .shortcuts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 8px;
    }
    .shortcut {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border-radius: 6px;
      background: var(--bg-elevated);
    }
    .shortcut kbd {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 4px;
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--text-muted);
      min-width: 32px;
      text-align: center;
    }
    .shortcut span { font-size: 12px; color: var(--text-secondary); }
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

  setTheme(theme: 'dark' | 'light') {
    this.prefs.set('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }
}
