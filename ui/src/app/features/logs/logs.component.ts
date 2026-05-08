import { Component, inject, OnInit, ViewEncapsulation } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [ButtonModule, SelectModule, ToggleSwitchModule, FormsModule],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="logs-page">
      <div class="page-header">
        <div>
          <h1>Logs</h1>
          <p class="subtitle">View pod output</p>
        </div>
        <div class="controls">
          <p-select [options]="podNames" [(ngModel)]="selectedPod" placeholder="Select pod"
                    [style]="{ width: '250px' }" [filter]="true" />
          <label class="errors-toggle">
            <p-toggleSwitch [(ngModel)]="errorsOnly" />
            <span>Errors only</span>
          </label>
          <button pButton label="Fetch" icon="pi pi-download" class="p-button-sm"
                  (click)="fetchLogs()" [disabled]="!selectedPod"></button>
        </div>
      </div>

      <div class="log-card">
        @if (lines.length > 0) {
          <div class="log-viewer">
            @for (line of lines; track $index) {
              <div class="log-line" [class.error-line]="isError(line)">
                <span class="line-num">{{ $index + 1 }}</span>
                <span class="line-text">{{ line }}</span>
              </div>
            }
          </div>
        } @else if (selectedPod && fetched) {
          <div class="log-empty">No log lines found</div>
        } @else {
          <div class="log-empty">
            <i class="pi pi-terminal"></i>
            <span>Select a pod and click Fetch</span>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .logs-page .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 24px;
    }
    .logs-page .page-header h1 {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.03em;
      color: var(--text);
    }
    .logs-page .subtitle {
      font-size: 13px;
      color: var(--text-muted);
      margin-top: 4px;
    }
    .logs-page .controls {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logs-page .errors-toggle {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: var(--text-secondary);
    }
    .logs-page .log-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
    }
    .logs-page .log-viewer {
      max-height: 600px;
      overflow-y: auto;
      padding: 12px 0;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      line-height: 1.7;
      background: var(--bg-card);
    }
    .logs-page .log-line {
      display: flex;
      gap: 12px;
      padding: 1px 16px;
    }
    .logs-page .log-line:hover {
      background: var(--bg-hover);
    }
    .logs-page .error-line {
      background: var(--danger-subtle);
    }
    .logs-page .line-num {
      color: var(--text-muted);
      min-width: 36px;
      text-align: right;
      user-select: none;
    }
    .logs-page .line-text {
      white-space: pre-wrap;
      word-break: break-all;
      color: var(--text-secondary);
    }
    .logs-page .log-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      text-align: center;
      padding: 48px;
      color: var(--text-muted);
      font-size: 13px;
    }
    .logs-page .log-empty i {
      font-size: 24px;
      opacity: 0.4;
    }

    /* Force dark on PrimeNG components inside logs page */
    .logs-page .p-select,
    .logs-page .p-select-panel {
      background: var(--bg-elevated) !important;
      color: var(--text) !important;
      border-color: var(--border) !important;
    }
    .logs-page .p-select-label {
      color: var(--text) !important;
    }
    .logs-page .p-select-item {
      color: var(--text) !important;
    }
    .logs-page .p-select-item:hover {
      background: var(--bg-hover) !important;
    }
    .logs-page .p-toggleswitch-slider {
      background: var(--bg-elevated) !important;
      border-color: var(--border) !important;
    }
    .logs-page .p-toggleswitch.p-toggleswitch-checked .p-toggleswitch-slider {
      background: var(--accent) !important;
    }
  `],
})
export class LogsComponent implements OnInit {
  private api = inject(ApiService);
  podNames: string[] = [];
  selectedPod = '';
  errorsOnly = false;
  lines: string[] = [];
  fetched = false;

  ngOnInit() {
    this.api.getPods().subscribe(res => {
      this.podNames = res.pods.map(p => p.name);
    });
  }

  fetchLogs() {
    if (!this.selectedPod) return;
    this.api.getLogs(this.selectedPod, 200, this.errorsOnly).subscribe(res => {
      this.lines = res.lines;
      this.fetched = true;
    });
  }

  isError(line: string): boolean {
    const lower = line.toLowerCase();
    return lower.includes('error') || lower.includes('fatal') || lower.includes('panic');
  }
}
