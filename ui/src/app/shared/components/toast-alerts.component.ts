import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { WsService } from '../../core/services/ws.service';
import { Pod } from '../../core/models';
import { StatusBeaconComponent } from './futuristic/status-beacon.component';

interface Toast {
  id: number;
  severity: 'info' | 'warn' | 'danger' | 'success';
  title: string;
  message: string;
  time: number;
}

@Component({
  selector: 'app-toast-alerts',
  standalone: true,
  imports: [StatusBeaconComponent],
  template: `
    <div class="toast-container" aria-live="polite" aria-label="Pod status notifications">
      @for (toast of toasts; track toast.id) {
        <div class="toast" [class]="'toast-' + toast.severity" role="status" (click)="dismiss(toast.id)">
          <app-status-beacon [status]="toastStatus(toast.severity)" size="sm" />
          <div class="toast-body">
            <span class="toast-kicker">POD SIGNAL / {{ toast.severity }}</span>
            <span class="toast-title">{{ toast.title }}</span>
            <span class="toast-message">{{ toast.message }}</span>
          </div>
          <button type="button" class="toast-dismiss" (click)="$event.stopPropagation(); dismiss(toast.id)" [attr.aria-label]="'Dismiss ' + toast.title">
            <i class="pi pi-times" aria-hidden="true"></i>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 64px;
      right: 16px;
      z-index: 8000;
      display: flex;
      width: min(380px, calc(100vw - 24px));
      flex-direction: column;
      gap: 8px;
    }
    .toast {
      --toast-accent: var(--info);
      --toast-accent-rgb: var(--info-rgb);
      position: relative;
      display: flex;
      align-items: flex-start;
      gap: 9px;
      min-width: 0;
      padding: 12px 13px;
      overflow: hidden;
      border: 1px solid rgba(var(--toast-accent-rgb), .28);
      border-radius: var(--radius-sm);
      background: var(--surface-card);
      box-shadow: var(--shadow-lg), 0 0 0 1px rgba(var(--toast-accent-rgb), .04);
      cursor: pointer;
      animation: slideIn 0.25s var(--transition-smooth) both;
    }
    .toast::before {
      position: absolute;
      inset: 0 auto 0 0;
      width: 3px;
      background: var(--toast-accent);
      box-shadow: 0 0 14px rgba(var(--toast-accent-rgb), .3);
      content: '';
    }
    .toast-danger { --toast-accent: var(--danger); --toast-accent-rgb: var(--danger-rgb); }
    .toast-warn { --toast-accent: var(--warning); --toast-accent-rgb: var(--warning-rgb); }
    .toast-info { --toast-accent: var(--info); --toast-accent-rgb: var(--info-rgb); }
    .toast-success { --toast-accent: var(--success); --toast-accent-rgb: var(--success-rgb); }
    .toast:hover { background: rgba(var(--toast-accent-rgb), .06); }
    @keyframes slideIn {
      from { opacity: 0; transform: translateX(20px); }
      to { opacity: 1; transform: translateX(0); }
    }
    .toast > app-status-beacon { margin-top: 4px; }
    .toast-body { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 3px; }
    .toast-kicker { color: var(--toast-accent); font: 700 8px var(--font-mono); letter-spacing: .12em; text-transform: uppercase; }
    .toast-title { color: var(--text); font-size: 12px; font-weight: 650; }
    .toast-message { overflow-wrap: anywhere; color: var(--text-secondary); font: 11px/1.4 var(--font-mono); }
    .toast-dismiss {
      align-self: flex-start;
      padding: 3px;
      border: 1px solid transparent;
      border-radius: 3px;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      opacity: .75;
    }
    .toast-dismiss:hover, .toast-dismiss:focus-visible { border-color: rgba(var(--toast-accent-rgb), .3); color: var(--toast-accent); opacity: 1; }
    @media (max-width: 640px) {
      .toast-container { top: 58px; right: 12px; left: 12px; width: auto; }
    }
    @media (prefers-reduced-motion: reduce) {
      .toast { animation: none; }
    }
  `],
})
export class ToastAlertsComponent implements OnInit, OnDestroy {
  private ws = inject(WsService);
  private sub: Subscription | null = null;
  private closeWs: (() => void) | null = null;
  private previousPods: Map<string, string> = new Map();
  private idCounter = 0;

  toasts: Toast[] = [];

  ngOnInit() {
    this.requestNotificationPermission();
    const conn = this.ws.connect('/ws/pods');
    this.closeWs = conn.close;
    this.sub = conn.messages$.subscribe(data => {
      const pods: Pod[] = JSON.parse(data);
      this.checkForChanges(pods);
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.closeWs?.();
  }

  private checkForChanges(pods: Pod[]) {
    for (const pod of pods) {
      const prev = this.previousPods.get(pod.name);

      if (prev && prev !== pod.status) {
        // Status changed
        if (pod.status === 'CrashLoopBackOff' || pod.status === 'Error' || pod.status === 'Failed') {
          this.addToast('danger', 'Pod Crashed', `${pod.name} → ${pod.status}`);
        } else if (pod.status === 'Running' && prev !== 'Running') {
          this.addToast('success', 'Pod Recovered', `${pod.name} is now Running`);
        } else if (pod.status === 'Pending') {
          this.addToast('warn', 'Pod Pending', `${pod.name} is stuck in Pending`);
        }
      }

      this.previousPods.set(pod.name, pod.status);
    }
  }

  toastStatus(severity: Toast['severity']): 'critical' | 'warning' | 'info' | 'ok' {
    if (severity === 'danger') return 'critical';
    if (severity === 'warn') return 'warning';
    if (severity === 'success') return 'ok';
    return 'info';
  }

  private addToast(severity: Toast['severity'], title: string, message: string) {
    const toast: Toast = { id: ++this.idCounter, severity, title, message, time: Date.now() };
    this.toasts.push(toast);

    // OS-level notification
    this.sendOsNotification(title, message, severity);

    // Auto-dismiss after 8 seconds
    setTimeout(() => this.dismiss(toast.id), 8000);

    // Max 5 visible
    if (this.toasts.length > 5) {
      this.toasts.shift();
    }
  }

  private requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  private sendOsNotification(title: string, body: string, severity: string) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const notification = new Notification(`Kubsome / ${title}`, {
      body,
      icon: '/favicon.ico',
      tag: title, // prevents duplicate notifications
      silent: false,
    });

    // Auto-close after 6s
    setTimeout(() => notification.close(), 6000);

    // Click notification to focus the app
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }

  dismiss(id: number) {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }
}
