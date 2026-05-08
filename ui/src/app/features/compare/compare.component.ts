import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { JsonPipe } from '@angular/common';

@Component({
  selector: 'app-compare',
  standalone: true,
  imports: [FormsModule, SelectModule, ButtonModule, TagModule, JsonPipe],
  template: `
    <div class="page-header">
      <h1>Compare Clusters</h1>
      <p class="subtitle">Drift detection between contexts</p>
    </div>

    <div class="compare-bar">
      <p-select [options]="contexts" [(ngModel)]="ctxA" placeholder="Context A" [style]="{ width: '220px' }" />
      <span class="vs">vs</span>
      <p-select [options]="contexts" [(ngModel)]="ctxB" placeholder="Context B" [style]="{ width: '220px' }" />
      <button pButton label="Compare" icon="pi pi-arrows-h" class="p-button-sm" (click)="compare()" [disabled]="!ctxA || !ctxB"></button>
    </div>

    @if (result) {
      <div class="compare-grid">
        @for (section of sections; track section.key) {
          @if (result[section.key]) {
            <div class="compare-section">
              <h3>{{ section.label }}</h3>
              <div class="diff-table">
                <div class="diff-header">
                  <span>{{ ctxA }}</span>
                  <span>{{ ctxB }}</span>
                </div>
                @if (isArray(result[section.key])) {
                  @for (item of result[section.key]; track $index) {
                    <div class="diff-row">
                      <span class="diff-cell">{{ item.a || '—' }}</span>
                      <span class="diff-cell">{{ item.b || '—' }}</span>
                      @if (item.a !== item.b) {
                        <p-tag value="drift" severity="warn" [rounded]="true" />
                      }
                    </div>
                  }
                } @else {
                  <pre class="diff-raw">{{ result[section.key] | json }}</pre>
                }
              </div>
            </div>
          }
        }
      </div>
    }
  `,
  styles: [`
    .page-header { margin-bottom: 24px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

    .compare-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
    }
    .vs { font-size: 12px; color: var(--text-muted); font-weight: 600; }

    .compare-grid { display: flex; flex-direction: column; gap: 16px; }
    .compare-section {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px 20px;
    }
    .compare-section h3 { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
    .diff-header {
      display: grid;
      grid-template-columns: 1fr 1fr auto;
      gap: 8px;
      padding: 8px 12px;
      background: var(--bg-elevated);
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 8px;
    }
    .diff-row {
      display: grid;
      grid-template-columns: 1fr 1fr auto;
      gap: 8px;
      padding: 8px 12px;
      border-bottom: 1px solid var(--border);
      font-size: 12px;
      align-items: center;
    }
    .diff-row:last-child { border-bottom: none; }
    .diff-cell { font-family: 'JetBrains Mono', monospace; font-size: 11px; }
    .diff-raw {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      background: var(--bg-elevated);
      padding: 12px;
      border-radius: 6px;
      white-space: pre-wrap;
      max-height: 200px;
      overflow-y: auto;
    }
  `],
})
export class CompareComponent implements OnInit {
  private http = inject(HttpClient);
  contexts: string[] = [];
  ctxA = '';
  ctxB = '';
  result: any = null;

  sections = [
    { key: 'pods', label: 'Pods' },
    { key: 'deployments', label: 'Deployments' },
    { key: 'services', label: 'Services' },
    { key: 'configmaps', label: 'ConfigMaps' },
  ];

  ngOnInit() {
    this.http.get<any>('http://localhost:8000/api/contexts').subscribe(res => {
      this.contexts = (res.contexts || []).map((c: any) => c.name);
    });
  }

  compare() {
    this.http.post<any>('http://localhost:8000/api/compare', {
      ctx_a: this.ctxA, ctx_b: this.ctxB,
    }).subscribe(res => { this.result = res; });
  }

  isArray(val: any): boolean { return Array.isArray(val); }
}
