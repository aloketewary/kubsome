import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { Select } from 'primeng/select';
import { SpotlightComponent } from '../../shared/components/spotlight.component';

@Component({
  selector: 'app-yaml-editor',
  standalone: true,
  imports: [FormsModule, ButtonModule, TagModule, TooltipModule, Select, SpotlightComponent],
  template: `
    <app-spotlight id="yaml-editor" title="YAML Editor" icon="pi pi-code"
      description="Edit and apply Kubernetes manifests."
      [capabilities]="['Syntax highlighting', 'Apply to cluster', 'Template generation']" [compact]="true" />

        <div class="page-header">
      <div>
        <h1>YAML Editor</h1>
        <p class="subtitle">Create and apply Kubernetes manifests</p>
      </div>
    </div>

    <!-- Quick Templates -->
    @if (!yaml) {
      <div class="templates-section">
        <h3 class="section-label">Quick Start</h3>
        <div class="template-grid">
          @for (tpl of templates; track tpl.kind) {
            <div class="template-card" (click)="useTemplate(tpl)">
              <div class="tpl-icon" [style.background]="tpl.color + '15'" [style.color]="tpl.color">
                <i [class]="tpl.icon"></i>
              </div>
              <div class="tpl-info">
                <span class="tpl-name">{{ tpl.kind }}</span>
                <span class="tpl-desc">{{ tpl.desc }}</span>
              </div>
            </div>
          }
        </div>
      </div>
    }

    <!-- Generator Bar -->
    <div class="generator-bar">
      <div class="gen-left">
        <p-select [options]="kinds" [(ngModel)]="kind" placeholder="Kind" [style]="{ width: '140px' }" />
        <input class="gen-input" [(ngModel)]="name" placeholder="Resource name..." (keyup.enter)="generate()" />
        <button pButton label="Generate" icon="pi pi-sparkles" class="p-button-sm" (click)="generate()" [disabled]="!kind || !name" pTooltip="AI-generate manifest"></button>
      </div>
      <div class="gen-right">
        @if (yaml) {
          <button pButton icon="pi pi-trash" class="p-button-sm p-button-text p-button-danger" pTooltip="Clear" (click)="clear()"></button>
        }
      </div>
    </div>

    <!-- Editor -->
    @if (yaml || showEditor) {
      <div class="editor-wrap">
        <!-- Tab Bar -->
        <div class="editor-tabs">
          <div class="tab active">
            <i class="pi pi-file"></i>
            <span>{{ fileName }}</span>
          </div>
          <div class="tab-spacer"></div>
          <div class="editor-actions">
            <button pButton icon="pi pi-copy" class="p-button-sm p-button-text p-button-rounded" pTooltip="Copy" (click)="copy()"></button>
            <button pButton label="Dry Run" icon="pi pi-eye" class="p-button-sm p-button-outlined" (click)="dryRun()" [disabled]="!yaml.trim()" pTooltip="Validate without applying"></button>
            <button pButton label="Apply" icon="pi pi-upload" class="p-button-sm p-button-success" (click)="apply()" [disabled]="!yaml.trim()"></button>
          </div>
        </div>

        <!-- Editor Body -->
        <div class="editor-body">
          <div class="line-numbers">
            @for (n of lineNumbers; track n) {
              <span>{{ n }}</span>
            }
          </div>
          <textarea class="code-area" [(ngModel)]="yaml" (ngModelChange)="updateLines()" placeholder="# Paste or generate YAML here..." spellcheck="false"></textarea>
        </div>

        <!-- Status Bar -->
        <div class="editor-status">
          <span>{{ lineCount }} lines</span>
          <span>{{ yaml.length }} chars</span>
          <span>YAML</span>
          @if (copied) {
            <span class="copied-badge"><i class="pi pi-check"></i> Copied</span>
          }
        </div>
      </div>
    }

    <!-- Result -->
    @if (result) {
      <div class="result-card" [class.result-ok]="resultSuccess" [class.result-err]="!resultSuccess">
        <div class="result-header">
          <i class="pi" [class.pi-check-circle]="resultSuccess" [class.pi-times-circle]="!resultSuccess"></i>
          <span class="result-title">{{ resultSuccess ? (isDryRun ? 'Validation Passed' : 'Applied Successfully') : 'Failed' }}</span>
          <button pButton icon="pi pi-times" class="p-button-sm p-button-text p-button-rounded" (click)="result = ''"></button>
        </div>
        <pre class="result-output">{{ result }}</pre>
      </div>
    }
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

    /* Templates */
    .templates-section { margin-bottom: 20px; }
    .section-label { font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px; }
    .template-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px; }
    .template-card {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 14px; background: var(--bg-card);
      border: 1px solid var(--border); border-radius: var(--radius-sm);
      cursor: pointer; transition: all 0.12s;
    }
    .template-card:hover { border-color: var(--accent); transform: translateY(-1px); }
    .tpl-icon {
      width: 32px; height: 32px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center; font-size: 14px;
    }
    .tpl-info { display: flex; flex-direction: column; }
    .tpl-name { font-size: 12px; font-weight: 600; }
    .tpl-desc { font-size: 10px; color: var(--text-muted); }

    /* Generator */
    .generator-bar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px; margin-bottom: 12px;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-sm);
    }
    .gen-left { display: flex; align-items: center; gap: 8px; }
    .gen-right { display: flex; gap: 4px; }
    .gen-input {
      padding: 7px 12px; width: 200px;
      background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 6px;
      color: var(--text); font-size: 12px; outline: none;
    }
    .gen-input:focus { border-color: var(--accent); }

    /* Editor */
    .editor-wrap {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
      overflow: hidden;
    }
    .editor-tabs {
      display: flex; align-items: center;
      padding: 0 12px; height: 38px;
      background: var(--bg-elevated); border-bottom: 1px solid var(--border);
    }
    .tab {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 12px; font-size: 12px; color: var(--text-secondary);
      border-bottom: 2px solid transparent;
    }
    .tab.active { color: var(--text); border-bottom-color: var(--accent); }
    .tab i { font-size: 12px; color: var(--accent); }
    .tab-spacer { flex: 1; }
    .editor-actions { display: flex; gap: 6px; }

    .editor-body { display: flex; min-height: 350px; }
    .line-numbers {
      display: flex; flex-direction: column;
      padding: 16px 0; min-width: 40px;
      background: var(--bg-elevated); border-right: 1px solid var(--border);
      text-align: right; user-select: none;
    }
    .line-numbers span {
      display: block; padding: 0 10px; height: 21px;
      font-family: 'JetBrains Mono', monospace; font-size: 11px;
      color: var(--text-muted); opacity: 0.5; line-height: 21px;
    }
    .code-area {
      flex: 1; padding: 16px; border: none; outline: none; resize: none;
      background: transparent; color: var(--text);
      font-family: 'JetBrains Mono', monospace; font-size: 12px;
      line-height: 21px; tab-size: 2;
    }
    .code-area::placeholder { color: var(--text-muted); opacity: 0.5; }

    .editor-status {
      display: flex; gap: 16px; padding: 6px 16px;
      background: var(--bg-elevated); border-top: 1px solid var(--border);
      font-size: 10px; color: var(--text-muted);
    }
    .copied-badge { color: var(--success); display: flex; align-items: center; gap: 3px; animation: fadeIn 0.2s; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    /* Result */
    .result-card {
      margin-top: 12px; border-radius: var(--radius-sm); overflow: hidden;
      border: 1px solid var(--border);
    }
    .result-ok { border-color: var(--success); }
    .result-err { border-color: var(--danger); }
    .result-header {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 14px; background: var(--bg-elevated);
    }
    .result-ok .result-header i { color: var(--success); }
    .result-err .result-header i { color: var(--danger); }
    .result-title { flex: 1; font-size: 13px; font-weight: 600; }
    .result-output {
      font-family: 'JetBrains Mono', monospace; font-size: 11px;
      padding: 12px 14px; margin: 0; white-space: pre-wrap;
      max-height: 150px; overflow-y: auto; background: var(--bg-card);
    }
  `],
})
export class YamlEditorComponent {
  private http = inject(HttpClient);
  private base = '/api';

  kinds = ['Deployment', 'Service', 'ConfigMap', 'Secret', 'Ingress', 'CronJob', 'HPA'];
  kind = '';
  name = '';
  yaml = '';
  result = '';
  resultSuccess = false;
  isDryRun = false;
  copied = false;
  showEditor = false;
  lineNumbers: number[] = [1];

  templates = [
    { kind: 'Deployment', desc: 'Container workload', icon: 'pi pi-send', color: '#3b82f6' },
    { kind: 'Service', desc: 'Network endpoint', icon: 'pi pi-globe', color: '#22c55e' },
    { kind: 'ConfigMap', desc: 'Configuration data', icon: 'pi pi-file', color: '#eab308' },
    { kind: 'Secret', desc: 'Sensitive data', icon: 'pi pi-lock', color: '#ef4444' },
    { kind: 'Ingress', desc: 'External access', icon: 'pi pi-link', color: '#f472b6' },
    { kind: 'CronJob', desc: 'Scheduled task', icon: 'pi pi-clock', color: '#a855f7' },
  ];

  get lineCount() { return this.yaml.split('\n').length; }
  get fileName() { return this.kind ? `${this.name || 'untitled'}.${this.kind.toLowerCase()}.yaml` : 'manifest.yaml'; }

  useTemplate(tpl: any) {
    this.kind = tpl.kind;
    this.name = '';
    this.showEditor = true;
    this.yaml = `# ${tpl.kind} manifest\n# Enter a name above and click Generate\n`;
    this.updateLines();
  }

  generate() {
    this.showEditor = true;
    this.http.post<any>(`${this.base}/generate`, { kind: this.kind, name: this.name }).subscribe(res => {
      this.yaml = res.yaml || `# Could not generate ${this.kind} manifest`;
      this.updateLines();
    });
  }

  apply() {
    this.isDryRun = false;
    this.http.post<any>(`${this.base}/exec`, {
      command: `kubectl apply -f - <<EOF\n${this.yaml}\nEOF`
    }).subscribe({
      next: (res) => { this.result = res.output || 'Applied'; this.resultSuccess = res.exit_code === 0; },
      error: () => { this.result = 'Connection error'; this.resultSuccess = false; },
    });
  }

  dryRun() {
    this.isDryRun = true;
    this.http.post<any>(`${this.base}/exec`, {
      command: `kubectl apply --dry-run=client -f - <<EOF\n${this.yaml}\nEOF`
    }).subscribe({
      next: (res) => { this.result = res.output || 'Valid'; this.resultSuccess = res.exit_code === 0; },
      error: () => { this.result = 'Connection error'; this.resultSuccess = false; },
    });
  }

  copy() {
    navigator.clipboard.writeText(this.yaml);
    this.copied = true;
    setTimeout(() => this.copied = false, 2000);
  }

  clear() {
    this.yaml = '';
    this.result = '';
    this.showEditor = false;
    this.updateLines();
  }

  updateLines() {
    const count = Math.max(this.yaml.split('\n').length, 1);
    this.lineNumbers = Array.from({ length: count }, (_, i) => i + 1);
  }
}
