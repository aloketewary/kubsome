import { Component } from '@angular/core';

@Component({
  selector: 'app-help-dialog',
  standalone: true,
  template: `
    <div class="help-grid">
      <div class="help-section">
        <h4>Workspace</h4>
        <div class="cmd"><code>switch &lt;ctx&gt;</code><span>Fuzzy context switch</span></div>
        <div class="cmd"><code>use &lt;ns&gt;</code><span>Switch namespace</span></div>
        <div class="cmd"><code>contexts</code><span>List contexts</span></div>
      </div>
      <div class="help-section">
        <h4>Observability</h4>
        <div class="cmd"><code>overview</code><span>Cluster health</span></div>
        <div class="cmd"><code>pods</code><span>Pod list</span></div>
        <div class="cmd"><code>events</code><span>Events</span></div>
        <div class="cmd"><code>top pods</code><span>CPU/memory</span></div>
        <div class="cmd"><code>top nodes</code><span>Node pressure</span></div>
      </div>
      <div class="help-section">
        <h4>Operations</h4>
        <div class="cmd"><code>logs &lt;pod&gt;</code><span>Pod logs</span></div>
        <div class="cmd"><code>rollout &lt;dep&gt;</code><span>Rollout status</span></div>
        <div class="cmd"><code>rollback &lt;dep&gt;</code><span>Undo rollout</span></div>
        <div class="cmd"><code>restart &lt;dep&gt;</code><span>Rolling restart</span></div>
        <div class="cmd"><code>scale &lt;dep&gt; N</code><span>Scale replicas</span></div>
      </div>
      <div class="help-section">
        <h4>Diagnostics & AI</h4>
        <div class="cmd"><code>inspect &lt;pod&gt;</code><span>Deep inspection</span></div>
        <div class="cmd"><code>diagnose &lt;pod&gt;</code><span>Root cause</span></div>
        <div class="cmd"><code>why is X failing</code><span>AI explain</span></div>
        <div class="cmd"><code>summarize</code><span>Health summary</span></div>
      </div>
    </div>
  `,
  styles: [`
    .help-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }
    .help-section h4 {
      margin: 0 0 12px;
      font-size: 13px;
      font-weight: 600;
      opacity: 0.7;
    }
    .cmd {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 13px;
    }
    .cmd code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
    }
    .cmd span {
      opacity: 0.5;
      font-size: 12px;
    }
  `],
})
export class HelpDialogComponent {}
