import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  severity?: 'danger' | 'warning' | 'info';
  productionGuard?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private http = inject(HttpClient);
  private _confirm$ = new Subject<ConfirmOptions & { resolve: (v: boolean) => void }>();
  confirm$ = this._confirm$.asObservable();

  private cachedEnv: { environment: string; is_production: boolean } | null = null;

  confirm(options: ConfirmOptions): Promise<boolean> {
    if (options.productionGuard) {
      return this.checkEnvThenConfirm(options);
    }
    return this.showDialog(options);
  }

  private checkEnvThenConfirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise(resolve => {
      const show = (env: { environment: string; is_production: boolean }) => {
        if (env.is_production) {
          this._confirm$.next({
            ...options,
            title: `⚠️ PRODUCTION — ${options.title}`,
            message: `${options.message}\n\nYou are operating on a PRODUCTION cluster. This action may cause service disruption.`,
            severity: 'danger',
            confirmLabel: options.confirmLabel || 'I understand, proceed',
            resolve,
          });
        } else {
          this._confirm$.next({ ...options, resolve });
        }
      };

      if (this.cachedEnv) {
        show(this.cachedEnv);
      } else {
        this.http.get<any>('/api/context-info').subscribe({
          next: (res) => { this.cachedEnv = res; show(res); },
          error: () => { this._confirm$.next({ ...options, resolve }); },
        });
      }
    });
  }

  private showDialog(options: ConfirmOptions): Promise<boolean> {
    return new Promise(resolve => {
      this._confirm$.next({ ...options, resolve });
    });
  }

  invalidateCache() {
    this.cachedEnv = null;
  }
}
