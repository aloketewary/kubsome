import { Injectable, signal } from '@angular/core';

export interface AppError {
  id: number;
  message: string;
  status?: number;
  time: number;
}

@Injectable({ providedIn: 'root' })
export class ErrorService {
  errors = signal<AppError[]>([]);
  private counter = 0;
  private lastMessage = '';
  private lastTime = 0;

  show(message: string, status?: number) {
    // Deduplicate rapid-fire same errors
    if (message === this.lastMessage && Date.now() - this.lastTime < 3000) return;
    this.lastMessage = message;
    this.lastTime = Date.now();

    const error: AppError = { id: ++this.counter, message, status, time: Date.now() };
    this.errors.update(list => [...list, error].slice(-3));

    // Auto-dismiss after 6s
    setTimeout(() => this.dismiss(error.id), 6000);
  }

  dismiss(id: number) {
    this.errors.update(list => list.filter(e => e.id !== id));
  }
}
