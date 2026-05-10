import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  severity?: 'danger' | 'warning' | 'info';
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private _confirm$ = new Subject<ConfirmOptions & { resolve: (v: boolean) => void }>();
  confirm$ = this._confirm$.asObservable();

  confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise(resolve => {
      this._confirm$.next({ ...options, resolve });
    });
  }
}
