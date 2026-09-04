import { Component, ElementRef, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild, ViewEncapsulation } from '@angular/core';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WsService } from '../../core/services/ws.service';
import { TerminalDockService } from '../../core/services/terminal-dock.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-shell-terminal',
  standalone: true,
  template: `<div class="shell-container" #shellContainer></div>`,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      min-height: 0;
    }
    .shell-container {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 0;
      padding: 8px 12px;
      overflow: hidden;
      background:
        linear-gradient(90deg, rgba(208, 156, 96, 0.035), transparent 18%, transparent 82%, rgba(208, 156, 96, 0.02)),
        var(--bg, #0b0908);
      border-top: 1px solid rgba(208, 156, 96, 0.06);
    }
    .shell-container::after {
      position: absolute;
      inset: 0;
      z-index: 2;
      background: repeating-linear-gradient(180deg, transparent 0, transparent 3px, rgba(208, 156, 96, 0.018) 4px);
      content: '';
      pointer-events: none;
    }
    .xterm { position: relative; z-index: 1; }
    .xterm-viewport { background-color: transparent !important; }
  `],
  encapsulation: ViewEncapsulation.None,
})
export class ShellTerminalComponent implements OnChanges, OnInit, OnDestroy {
  @ViewChild('shellContainer', { static: true }) container!: ElementRef<HTMLDivElement>;
  @Input() podName!: string;

  private terminal!: Terminal;
  private fitAddon!: FitAddon;
  private subscription: Subscription | null = null;
  private wsConn: { messages$: any; send: (msg: string) => void; close: () => void } | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private inputDisposable: { dispose: () => void } | null = null;
  private lineBuffer = '';
  private initialized = false;

  constructor(private ws: WsService, private terminalDock: TerminalDockService) {}

  ngOnInit() {
    this.terminal = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#0b0908',
        foreground: '#e4e4e7',
        cursor: '#d09c60',
        selectionBackground: 'rgba(208, 156, 96, 0.3)',
      },
      fontSize: 13,
      fontFamily: "'JetBrains Mono', monospace",
      convertEol: true,
      scrollback: 3000,
    });

    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);
    this.terminal.open(this.container.nativeElement);
    this.inputDisposable = this.terminal.onData(input => this.handleInput(input));
    this.resizeObserver = new ResizeObserver(() => this.fit());
    this.resizeObserver.observe(this.container.nativeElement);
    this.initialized = true;
    requestAnimationFrame(() => this.fit());
    this.connectShell();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!this.initialized || !changes['podName'] || changes['podName'].firstChange) return;

    this.disconnectShell();
    this.terminal.clear();
    this.fit();
    this.connectShell();
  }

  ngOnDestroy() {
    this.disconnectShell();
    this.resizeObserver?.disconnect();
    this.inputDisposable?.dispose();
    this.terminal?.dispose();
  }

  private fit() {
    if (!this.fitAddon || !this.container.nativeElement.offsetWidth) return;
    requestAnimationFrame(() => this.fitAddon.fit());
  }

  private connectShell() {
    this.terminalDock.setStatus('connecting');
    this.terminal.writeln(`\x1b[33m● Connecting to ${this.podName}...\x1b[0m`);
    this.terminal.writeln('');

    const conn = this.ws.connect(`/ws/shell/${encodeURIComponent(this.podName)}`);
    this.wsConn = conn;
    this.subscription = conn.messages$.subscribe({
      next: (data: string) => {
        this.terminalDock.setStatus('live');
        this.terminal.write(data);
      },
      error: (error: unknown) => {
        this.terminalDock.setStatus('error');
        const message = error instanceof Error ? error.message : 'WebSocket connection failed';
        this.terminal.writeln(`\r\n\x1b[31m● ${message}\x1b[0m`);
      },
      complete: () => {
        this.terminalDock.setStatus('disconnected');
        this.terminal.writeln('\r\n\x1b[31m● Shell disconnected\x1b[0m');
      },
    });
  }

  private disconnectShell() {
    this.subscription?.unsubscribe();
    this.subscription = null;
    this.wsConn?.close();
    this.wsConn = null;
    this.lineBuffer = '';
  }

  private handleInput(input: string) {
    const conn = this.wsConn;
    if (!conn) return;

    if (input === '\r') {
      conn.send(this.lineBuffer);
      this.lineBuffer = '';
      this.terminal.write('\r\n');
    } else if (input === '\x7f') {
      if (this.lineBuffer.length > 0) {
        this.lineBuffer = this.lineBuffer.slice(0, -1);
        this.terminal.write('\b \b');
      }
    } else {
      this.lineBuffer += input;
      this.terminal.write(input);
    }
  }
}
