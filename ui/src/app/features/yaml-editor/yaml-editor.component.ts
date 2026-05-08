import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';

@Component({
  selector: 'app-yaml-editor',
  standalone: true,
  imports: [FormsModule, ButtonModule, TagModule, SelectModule],
  template: `
    <div class="page-header">
      <h1>YAML Editor</h1>
      <p class="subtitle">Generate and apply Kubernetes manifests</p>
    </div>

    <!-- Generator -->
    <div class="generator-bar">
      <p-select [options]="kinds" [(ngModel)]="kind" placeholder="Kind" [style]="{ width: '140px' }" />
      <input class="name-input" [(ngModel)]="name" placeholder="Resource name..." />
      <button pButton label="Generate" icon="pi pi-sparkles" class="p-button-sm" (click)="generate()" [disabled]="!kind || !name"></button>
    </div>

    <!-- Editor -->
    <div class="editor-container">
      <div class="editor-toolbar">
        <span class="editor-label">{{ kind || 'manifest' }}.yaml</span>
        <div class="editor-actions">
          <button pButton label="Apply" icon="pi pi-upload" class="p-button-sm p-button-success" (click)="apply()" [disabled]="!yaml.trim()"></button>
          <button pButton icon="pi pi-copy" class="p-button-sm p-button-text" (click)="copy()"></button>
        </div>
      </div>
      <textarea class="yaml-editor" [(ngModel)]="yaml" placeholder="# Paste or generate YAML here..." spellcheck="false"></textarea>
    </div>

    @if (result) {
      <div class="result-bar" [class.result-success]="resultSuccess" [class.result-error]="!resultSuccess">
        <i class="pi" [class.pi-check-circle]="resultSuccess" [class.pi-times-circle]="!resultSuccess"></i>
        <span>{{ result }}</span>
      </div>
    }
  `,
  styles: [`
    .page-header { margin-bottom: 24px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

    .generator-bar {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-bottom: 16px;
    }
    .name-input {
      flex: 1;
      max-width: 240px;
      padding: 8px 12px;
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      font-size: 13px;
      outline: none;
    }
    .name-input:focus { border-color: var(--accent); }

    .editor-container {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
    }
    .editor-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 16px;
      border-bottom: 1px solid var(--border);
      background: var(--bg-elevated);
    }
    .editor-label {
      font-size: 12px;
      font-family: 'JetBrains Mono', monospace;
      color: var(--text-muted);
    }
    .editor-actions { display: flex; gap: 6px; }
    .yaml-editor {
      width: 100%;
      min-height: 400px;
      padding: 16px;
      background: var(--bg-card);
      border: none;
      color: var(--text);
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      line-height: 1.6;
      resize: vertical;
      outline: none;
    }

    .result-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      border-radius: var(--radius-sm);
      margin-top: 12px;
      font-size: 13px;
    }
    .result-success { background: var(--success-subtle); color: var(--success); }
    .result-error { background: var(--danger-subtle); color: var(--danger); }
  `],
})
export class YamlEditorComponent {
  private http = inject(HttpClient);
  private base = 'http://localhost:8000/api';

  kinds = ['Deployment', 'Service', 'ConfigMap', 'Secret', 'Ingress', 'CronJob', 'HPA'];
  kind = '';
  name = '';
  yaml = '';
  result = '';
  resultSuccess = false;

  generate() {
    this.http.post<any>(`${this.base}/generate`, { kind: this.kind, name: this.name }).subscribe(res => {
      this.yaml = res.yaml || '# Could not generate manifest';
    });
  }

  apply() {
    // Send YAML to exec endpoint as kubectl apply
    this.http.post<any>(`${this.base}/exec`, {
      command: `kubectl apply -f - <<EOF\n${this.yaml}\nEOF`
    }).subscribe({
      next: (res) => {
        this.result = res.output || 'Applied successfully';
        this.resultSuccess = res.exit_code === 0;
      },
      error: () => {
        this.result = 'Failed to apply';
        this.resultSuccess = false;
      },
    });
  }

  copy() {
    navigator.clipboard.writeText(this.yaml);
  }
}
