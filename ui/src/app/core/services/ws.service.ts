import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class WsService {
  private wsBase = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
  private tokenPromise: Promise<string> | null = null;

  private fetchToken(): Promise<string> {
    if (this.tokenPromise) return this.tokenPromise;

    this.tokenPromise = fetch('/api/token', { credentials: 'same-origin' })
      .then(response => {
        if (!response.ok) throw new Error('Unable to obtain API token');
        return response.json();
      })
      .then(data => data.token || '')
      .finally(() => {
        this.tokenPromise = null;
      });

    return this.tokenPromise;
  }

  connect(path: string): { messages$: Observable<string>; send: (msg: string) => void; close: () => void } {
    const subject = new Subject<string>();
    const pending: string[] = [];
    let ws: WebSocket | null = null;
    let closed = false;

    this.fetchToken()
      .then(token => {
        if (closed || !token) throw new Error('WebSocket authentication unavailable');

        const url = new URL(`${this.wsBase}${path}`);
        const context = sessionStorage.getItem('kubsome_context');
        const namespace = sessionStorage.getItem('kubsome_namespace');
        if (context) url.searchParams.set('context', context);
        if (namespace) url.searchParams.set('namespace', namespace);

        // /api/token establishes an HttpOnly cookie. Browser WebSocket
        // handshakes send that cookie without exposing it in the URL.
        ws = new WebSocket(url.toString());
        ws.onopen = () => {
          while (pending.length && ws?.readyState === WebSocket.OPEN) {
            ws.send(pending.shift()!);
          }
        };
        ws.onmessage = (event) => subject.next(event.data);
        ws.onerror = () => subject.error('WebSocket error');
        ws.onclose = () => subject.complete();
      })
      .catch(error => subject.error(error));

    return {
      messages$: subject.asObservable(),
      send: (msg: string) => {
        if (ws?.readyState === WebSocket.OPEN) ws.send(msg);
        else if (!closed) pending.push(msg);
      },
      close: () => {
        closed = true;
        pending.length = 0;
        ws?.close();
      },
    };
  }
}
