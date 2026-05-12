import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { ConfirmService, ConfirmOptions } from '../services/confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  template: `
    @if (visible) {
      <div class="confirm-overlay" (click)="onCancel()">
        <div class="confirm-dialog" [class.dialog-danger]="options?.severity === 'danger'" (click)="$event.stopPropagation()">
          @if (options?.severity === 'danger' && isProdWarning) {
            <div class="prod-banner">
              <i class="pi pi-shield"></i>
              <span>PRODUCTION ENVIRONMENT</span>
            </div>
          }
          <div class="confirm-icon" [class]="'icon-' + (options?.severity || 'warning')">
            <i class="pi" [class.pi-exclamation-triangle]="options?.severity !== 'danger'" [class.pi-trash]="options?.severity === 'danger'"></i>
          </div>
          <h3 class="confirm-title">{{ options?.title }}</h3>
          <p class="confirm-message">{{ options?.message }}</p>
          <div class="confirm-actions">
            <button class="btn-cancel" (click)="onCancel()">{{ options?.cancelLabel || 'Cancel' }}</button>
            <button class="btn-confirm" [class]="'btn-' + (options?.severity || 'warning')" (click)="onConfirm()">{{ options?.confirmLabel || 'Confirm' }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .confirm-overlay {
      position: fixed; inset: 0; z-index: 99999;
      background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      animation: fadeIn 0.15s ease-out;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .confirm-dialog {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 20px; padding: 32px; width: 380px; max-width: 90vw;
      display: flex; flex-direction: column; align-items: center; gap: 12px;
      box-shadow: 0 24px 80px rgba(0,0,0,0.5);
      animation: slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1);
      overflow: hidden;
    }
    .dialog-danger { border-color: var(--danger); }
    @keyframes slideUp { from { opacity: 0; transform: translateY(16px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }

    .prod-banner {
      position: absolute; top: 0; left: 0; right: 0;
      display: flex; align-items: center; justify-content: center; gap: 6px;
      padding: 6px; background: var(--danger); color: #fff;
      font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .prod-banner i { font-size: 11px; }
    .dialog-danger .confirm-icon { margin-top: 20px; }

    .confirm-icon {
      width: 48px; height: 48px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 20px; margin-bottom: 4px;
    }
    .icon-warning { background: var(--warning-subtle); color: var(--warning); }
    .icon-danger { background: var(--danger-subtle); color: var(--danger); }
    .icon-info { background: var(--accent-subtle); color: var(--accent); }

    .confirm-title { font-size: 16px; font-weight: 700; margin: 0; text-align: center; }
    .confirm-message { font-size: 13px; color: var(--text-muted); margin: 0; text-align: center; line-height: 1.5; }

    .confirm-actions { display: flex; gap: 10px; margin-top: 8px; width: 100%; }
    .confirm-actions button {
      flex: 1; padding: 10px 16px; border-radius: 12px; font-size: 13px;
      font-weight: 600; cursor: pointer; transition: all 0.2s cubic-bezier(0.34,1.56,0.64,1);
    }
    .btn-cancel {
      background: var(--bg-elevated); border: 1px solid var(--border); color: var(--text-secondary);
    }
    .btn-cancel:hover { border-color: var(--border-hover); color: var(--text); }
    .btn-confirm { border: none; color: #fff; }
    .btn-warning { background: var(--warning); }
    .btn-warning:hover { background: #d97706; transform: translateY(-1px); }
    .btn-danger { background: var(--danger); }
    .btn-danger:hover { background: #dc2626; transform: translateY(-1px); }
    .btn-info { background: var(--accent); }
    .btn-info:hover { background: #2563eb; transform: translateY(-1px); }
  `],
})
export class ConfirmDialogComponent implements OnInit, OnDestroy {
  private confirmService = inject(ConfirmService);
  private sub!: Subscription;

  visible = false;
  options: ConfirmOptions | null = null;
  isProdWarning = false;
  private resolve: ((v: boolean) => void) | null = null;

  ngOnInit() {
    this.sub = this.confirmService.confirm$.subscribe(data => {
      this.options = data;
      this.resolve = data.resolve;
      this.isProdWarning = (data.title || '').includes('PRODUCTION');
      this.visible = true;
    });
  }

  ngOnDestroy() { this.sub.unsubscribe(); }

  onConfirm() {
    this.resolve?.(true);
    this.visible = false;
  }

  onCancel() {
    this.resolve?.(false);
    this.visible = false;
  }
}
