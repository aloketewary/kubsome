import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-page-info',
  standalone: true,
  template: `
    <div class="info-wrap">
      <button class="info-btn" (click)="open = !open" [class.active]="open">
        <i class="pi pi-info-circle"></i>
      </button>
      @if (open) {
        <div class="info-backdrop" (click)="open = false"></div>
        <div class="info-panel">
          <div class="info-header">
            <span>{{ title }}</span>
            <button class="info-close" (click)="open = false"><i class="pi pi-times"></i></button>
          </div>
          <div class="info-body">
            <p class="info-desc">{{ description }}</p>
            @if (tips.length > 0) {
              <div class="info-section">
                <span class="info-label">Tips</span>
                @for (tip of tips; track tip) {
                  <div class="info-tip">• {{ tip }}</div>
                }
              </div>
            }
            @if (commands.length > 0) {
              <div class="info-section">
                <span class="info-label">CLI Commands</span>
                @for (cmd of commands; track cmd) {
                  <code class="info-cmd">{{ cmd }}</code>
                }
              </div>
            }
            @if (shortcuts.length > 0) {
              <div class="info-section">
                <span class="info-label">Shortcuts</span>
                @for (sc of shortcuts; track sc) {
                  <div class="info-shortcut"><kbd>{{ sc.key }}</kbd> {{ sc.action }}</div>
                }
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .info-wrap { position: relative; display: inline-flex; }
    .info-btn {
      width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--border);
      background: var(--bg-card); color: var(--text-muted); cursor: pointer;
      display: flex; align-items: center; justify-content: center; font-size: 13px;
      transition: all 0.12s;
    }
    .info-btn:hover, .info-btn.active { border-color: var(--accent); color: var(--accent); background: var(--accent-subtle); }

    .info-backdrop { position: fixed; inset: 0; z-index: 999; }
    .info-panel {
      position: absolute; top: 36px; right: 0; z-index: 1000;
      width: 320px; background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,0.4);
      overflow: hidden; animation: fadeIn 0.15s ease-out;
    }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }

    .info-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px; border-bottom: 1px solid var(--border);
      font-size: 13px; font-weight: 600;
    }
    .info-close { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; border-radius: 4px; }
    .info-close:hover { background: var(--bg-hover); color: var(--text); }

    .info-body { padding: 14px 16px; }
    .info-desc { font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin: 0 0 12px; }
    .info-section { margin-bottom: 12px; }
    .info-section:last-child { margin-bottom: 0; }
    .info-label { font-size: 9px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; display: block; margin-bottom: 6px; }
    .info-tip { font-size: 11px; color: var(--text-secondary); padding: 2px 0; }
    .info-cmd {
      display: block; font-size: 11px; padding: 4px 8px; margin-bottom: 4px;
      background: var(--bg-elevated); border-radius: 4px; border: 1px solid var(--border);
      font-family: 'JetBrains Mono', monospace; color: var(--accent);
    }
    .info-shortcut { display: flex; align-items: center; gap: 8px; font-size: 11px; padding: 2px 0; }
    .info-shortcut kbd {
      font-size: 10px; padding: 2px 5px; border-radius: 3px;
      background: var(--bg-elevated); border: 1px solid var(--border); font-family: inherit;
    }
  `],
})
export class PageInfoComponent {
  @Input() title = 'Help';
  @Input() description = '';
  @Input() tips: string[] = [];
  @Input() commands: string[] = [];
  @Input() shortcuts: { key: string; action: string }[] = [];
  open = false;
}
