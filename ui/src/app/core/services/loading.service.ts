import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private activeRequests = 0;
  loading = signal(false);

  start() {
    this.activeRequests++;
    this.loading.set(true);
  }

  stop() {
    this.activeRequests--;
    if (this.activeRequests <= 0) {
      this.activeRequests = 0;
      this.loading.set(false);
    }
  }
}
