import { Component } from '@angular/core';

@Component({
  selector: 'app-help-dialog',
  standalone: true,
  template: `
    <div class="help-grid">
      <div class="help-section">
        <span class="section-label">Workspace</span>
        <div class="cmd"><code>switch &lt;ctx&gt;</code><span>Fuzzy context switch</span></div>
        <div class="cmd"><code>use &lt;ns&gt;</code><span>Switch namespace</span></div>
        <div class="cmd"><code>contexts</code><span>List contexts</span></div>
      </div>
      <div class="help-section">
        <span class="section-label">Observability</span>
        <div class="cmd"><code>overview</code><span>Cluster health</span></div>
        <div class="cmd"><code>pods</code><span>Pod list</span></div>
        <div class="cmd"><code>events</code><span>Events</span></div>
        <div class="cmd"><code>top pods</code><span>CPU/memory</span></div>
        <div class="cmd"><code>top nodes</code><span>Node pressure</span></div>
      </div>
      <div class="help-section">
        <span class="section-label">Operations</span>
        <div class="cmd"><code>logs &lt;pod&gt;</code><span>Pod logs</span></div>
        <div class="cmd"><code>rollout &lt;dep&gt;</code><span>Rollout status</span></div>
        <div class="cmd"><code>rollback &lt;dep&gt;</code><span>Undo rollout</span></div>
        <div class="cmd"><code>restart &lt;dep&gt;</code><span>Rolling restart</span></div>
        <div class="cmd"><code>scale &lt;dep&gt; N</code><span>Scale replicas</span></div>
      </div>
      <div class="help-section">
        <span class="section-label">Diagnostics & AI</span>
        <div class="cmd"><code>inspect &lt;pod&gt;</code><span>Deep inspection</span></div>
        <div class="cmd"><code>diagnose &lt;pod&gt;</code><span>Root cause</span></div>
        <div class="cmd"><code>why is X failing</code><span>AI explain</span></div>
        <div class="cmd"><code>summarize</code><span>Health summary</span></div>
      </div>
      <div class="help-section">
        <span class="section-label">Cost & Security</span>
        <div class="cmd"><code>cost-estimate</code><span>$/month per deploy</span></div>
        <div class="cmd"><code>security</code><span>Misconfig scan</span></div>
        <div class="cmd"><code>optimize</code><span>Right-sizing</span></div>
        <div class="cmd"><code>scorecard</code><span>A-F health grade</span></div>
      </div>
      <div class="help-section">
        <span class="section-label">Shortcuts</span>
        <div class="cmd"><kbd>⌘K</kbd><span>Command palette</span></div>
        <div class="cmd"><kbd>G D</kbd><span>Dashboard</span></div>
        <div class="cmd"><kbd>G P</kbd><span>Pods</span></div>
        <div class="cmd"><kbd>G T</kbd><span>Terminal</span></div>
        <div class="cmd"><kbd>G A</kbd><span>AI Assistant</span></div>
        <div class="cmd"><kbd>H</kbd><span>This help</span></div>
      </div>
    </div>
  `,
  styles: [`
    .help-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0;
    }
    .help-section {
      padding: 16px 20px;
      border-bottom: 1px solid rgba(94, 84, 75, 0.08);
      border-right: 1px solid rgba(94, 84, 75, 0.08);
    }
    .help-section:nth-child(even) { border-right: none; }
    .help-section:nth-last-child(-n+2) { border-bottom: none; }

    .section-label {
      display: block;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      margin-bottom: 10px;
    }
    .cmd {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 5px 0;
      border-bottom: 1px solid rgba(94, 84, 75, 0.04);
      font-size: 11px;
    }
    .cmd:last-child { border-bottom: none; }
    .cmd code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 500;
      color: var(--text);
    }
    .cmd kbd {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      padding: 2px 6px;
      border: 1px solid rgba(94, 84, 75, 0.15);
      border-radius: 0;
      background: transparent;
      color: var(--text-secondary);
      min-width: 28px;
      text-align: center;
    }
    .cmd span {
      color: var(--text-muted);
      font-size: 10px;
    }

    :host-context([data-theme="light"]) .help-section {
      border-bottom-color: rgba(0, 0, 0, 0.04);
      border-right-color: rgba(0, 0, 0, 0.04);
    }
    :host-context([data-theme="light"]) .cmd {
      border-bottom-color: rgba(0, 0, 0, 0.02);
    }
    :host-context([data-theme="light"]) .cmd kbd {
      border-color: rgba(0, 0, 0, 0.08);
    }
  `],
})
export class HelpDialogComponent {}
