import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class WsService {
  private wsBase = 'ws://localhost:8000';

  connect(path: string): { messages$: Observable<string>; send: (msg: string) => void; close: () => void } {
    const subject = new Subject<string>();
    const ws = new WebSocket(`${this.wsBase}${path}`);

    ws.onmessage = (event) => subject.next(event.data);
    ws.onerror = () => subject.error('WebSocket error');
    ws.onclose = () => subject.complete();

    return {
      messages$: subject.asObservable(),
      send: (msg: string) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(msg);
      },
      close: () => ws.close(),
    };
  }
}
