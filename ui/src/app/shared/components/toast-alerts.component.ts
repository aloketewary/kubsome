import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { WsService } from '../../core/services/ws.service';
import { Pod } from '../../core/models';

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
  template: `
    <div class="toast-container">
      @for (toast of toasts; track toast.id) {
        <div class="toast" [class]="'toast-' + toast.severity" (click)="dismiss(toast.id)">
          <div class="toast-icon">
            <i class="pi" [class.pi-exclamation-triangle]="toast.severity === 'danger'"
               [class.pi-info-circle]="toast.severity === 'info'"
               [class.pi-check-circle]="toast.severity === 'success'"
               [class.pi-exclamation-circle]="toast.severity === 'warn'"></i>
          </div>
          <div class="toast-body">
            <span class="toast-title">{{ toast.title }}</span>
            <span class="toast-message">{{ toast.message }}</span>
          </div>
          <button class="toast-dismiss"><i class="pi pi-times"></i></button>
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
      flex-direction: column;
      gap: 8px;
      max-width: 360px;
    }
    .toast {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 14px;
      border-radius: 10px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
      cursor: pointer;
      animation: slideIn 0.25s ease-out;
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateX(20px); }
      to { opacity: 1; transform: translateX(0); }
    }
    .toast-danger { border-left: 3px solid var(--danger); }
    .toast-warn { border-left: 3px solid var(--warning); }
    .toast-info { border-left: 3px solid var(--accent); }
    .toast-success { border-left: 3px solid var(--success); }
    .toast-icon i { font-size: 16px; }
    .toast-danger .toast-icon i { color: var(--danger); }
    .toast-warn .toast-icon i { color: var(--warning); }
    .toast-info .toast-icon i { color: var(--accent); }
    .toast-success .toast-icon i { color: var(--success); }
    .toast-body { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .toast-title { font-size: 12px; font-weight: 600; }
    .toast-message { font-size: 11px; color: var(--text-secondary); }
    .toast-dismiss {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 2px;
      font-size: 11px;
    }
    .toast-dismiss:hover { color: var(--text); }
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

    const icon = severity === 'danger' ? '🔴' : severity === 'warn' ? '🟡' : '🟢';
    const notification = new Notification(`${icon} Kubsome: ${title}`, {
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
