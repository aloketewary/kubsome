import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';

@Component({
  selector: 'app-ai-insight-drawer',
  standalone: true,
  imports: [TagModule, ButtonModule, DrawerModule],
  template: `
    <p-drawer [(visible)]="visible" position="right" [appendTo]="'body'" [modal]="true" [style]="{ width: '450px' }" (onHide)="closed.emit()">
      <ng-template pTemplate="header">
        <div class="drawer-header">
          <i class="pi pi-sparkles ai-icon"></i>
          <div class="header-text">
            <h3>AI Diagnosis</h3>
            <p>{{ resourceName }}</p>
          </div>
        </div>
      </ng-template>

      <div class="drawer-content">
        @if (loading) {
          <div class="ai-loading">
            <div class="ai-pulse"></div>
            <p>Analyzing resource events and logs...</p>
          </div>
        } @else {
          <div class="insight-section">
            <div class="section-label">Summary</div>
            <div class="insight-card glass">
              <p>{{ summary }}</p>
            </div>
          </div>

          <div class="insight-section">
            <div class="section-label">Findings</div>
            @for (f of findings; track $index) {
              <div class="finding-item" [class]="'severity-' + f.severity">
                <div class="finding-top">
                  <p-tag [value]="f.severity" [severity]="f.severity === 'critical' ? 'danger' : 'warn'" [rounded]="true" />
                  <span class="finding-title">{{ f.title }}</span>
                </div>
                <p class="finding-detail">{{ f.detail }}</p>
                <div class="finding-action">
                  <span class="action-label">Recommendation:</span>
                  <span class="action-text">{{ f.action }}</span>
                </div>
              </div>
            }
            @if (findings.length === 0) {
              <div class="empty-findings">
                <i class="pi pi-check-circle"></i>
                <p>No critical issues detected by AI.</p>
              </div>
            }
          </div>

          <div class="insight-section">
             <div class="section-label">AI Reasoning</div>
             <div class="reasoning-box">
                {{ reasoning }}
             </div>
          </div>
        }
      </div>

      <ng-template pTemplate="footer">
        <div class="drawer-footer">
          <button pButton label="Apply Automated Fix" icon="pi pi-bolt" class="p-button-sm p-button-primary w-full" [disabled]="findings.length === 0"></button>
        </div>
      </ng-template>
    </p-drawer>
  `,
  styles: [`
    .drawer-header { display: flex; align-items: center; gap: 12px; }
    .ai-icon { font-size: 20px; color: var(--accent); }
    .header-text h3 { margin: 0; font-size: 16px; font-weight: 700; }
    .header-text p { margin: 0; font-size: 11px; color: var(--text-muted); font-family: 'JetBrains Mono', monospace; }

    .drawer-content { padding: 4px 16px 24px; display: flex; flex-direction: column; gap: 24px; }
    .section-label { font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }

    .insight-card { padding: 16px; border-radius: 12px; font-size: 13px; line-height: 1.6; color: var(--text-secondary); }
    .glass { background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border); }

    .finding-item { padding: 14px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg-elevated); margin-bottom: 10px; border-left: 4px solid var(--border); }
    .severity-critical { border-left-color: var(--danger); }
    .severity-warning { border-left-color: var(--warning); }
    .finding-top { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
    .finding-title { font-size: 13px; font-weight: 600; }
    .finding-detail { font-size: 12px; color: var(--text-secondary); margin-bottom: 10px; }
    .finding-action { font-size: 11px; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 6px; }
    .action-label { font-weight: 700; color: var(--accent); margin-right: 6px; }

    .reasoning-box { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-muted); background: var(--bg); padding: 12px; border-radius: 8px; border: 1px solid var(--border); white-space: pre-wrap; }

    .ai-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 0; gap: 16px; color: var(--text-muted); font-size: 13px; }
    .ai-pulse { width: 40px; height: 40px; background: var(--accent); border-radius: 50%; animation: pulse 1.5s infinite ease-in-out; opacity: 0.5; }
    @keyframes pulse { 0% { transform: scale(0.8); opacity: 0.5; } 50% { transform: scale(1.2); opacity: 0.2; } 100% { transform: scale(0.8); opacity: 0.5; } }

    .empty-findings { text-align: center; padding: 20px; color: var(--text-muted); }
    .empty-findings i { font-size: 24px; color: var(--success); margin-bottom: 8px; }

    .drawer-footer { padding: 16px; border-top: 1px solid var(--border); }
    .w-full { width: 100%; }
  `]
})
export class AiInsightDrawerComponent {
  @Input() visible = false;
  @Input() loading = false;
  @Input() resourceName = '';
  @Input() summary = '';
  @Input() findings: any[] = [];
  @Input() reasoning = '';
  @Output() closed = new EventEmitter<void>();
}
