import { Injectable, signal } from '@angular/core';

export interface TerminalSession {
  podName: string;
  openedAt: number;
}

export type TerminalDockStatus = 'connecting' | 'live' | 'disconnected' | 'error';

@Injectable({ providedIn: 'root' })
export class TerminalDockService {
  session = signal<TerminalSession | null>(null);
  minimized = signal(false);
  status = signal<TerminalDockStatus>('connecting');

  open(podName: string): void {
    if (!podName) return;

    const current = this.session();
    if (current?.podName !== podName) {
      this.session.set({ podName, openedAt: Date.now() });
    }
    this.status.set('connecting');
    this.minimized.set(false);
  }

  setStatus(status: TerminalDockStatus): void {
    if (this.session()) this.status.set(status);
  }

  toggleMinimized(): void {
    this.minimized.update(value => !value);
  }

  end(): void {
    this.session.set(null);
    this.status.set('disconnected');
    this.minimized.set(false);
  }
}
