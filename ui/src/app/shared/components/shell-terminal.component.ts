import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WsService } from '../../core/services/ws.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-shell-terminal',
  standalone: true,
  template: `<div class="shell-container" #shellContainer></div>`,
  styles: [`
    .shell-container {
      width: 100%; height: 100%; min-height: 400px;
      background: #0a0a0b; border-radius: 8px; padding: 4px;
    }
    .xterm-viewport { background-color: transparent !important; }
  `],
  encapsulation: ViewEncapsulation.None
})
export class ShellTerminalComponent implements OnInit, OnDestroy {
  @ViewChild('shellContainer', { static: true }) container!: ElementRef;
  @Input() podName!: string;

  private terminal!: Terminal;
  private fitAddon!: FitAddon;
  private subscription: Subscription | null = null;
  private wsConn: any = null;
  private resizeListener = () => this.fitAddon?.fit();

  constructor(private ws: WsService) {}

  ngOnInit() {
    this.terminal = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#0a0a0b',
        foreground: '#e4e4e7',
        cursor: '#22c55e',
        selectionBackground: 'rgba(34, 197, 94, 0.3)',
      },
      fontSize: 13,
      fontFamily: "'JetBrains Mono', monospace",
      convertEol: true,
      scrollback: 3000,
    });

    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);
    this.terminal.open(this.container.nativeElement);
    this.fitAddon.fit();
    window.addEventListener('resize', this.resizeListener);

    this.connectShell();
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
    this.wsConn?.close();
    window.removeEventListener('resize', this.resizeListener);
    this.terminal?.dispose();
  }

  private connectShell() {
    this.terminal.writeln(`\x1b[32m● Connected to ${this.podName}\x1b[0m`);
    this.terminal.writeln('');

    const conn = this.ws.connect(`/ws/shell/${this.podName}`);
    this.wsConn = conn;
    this.subscription = conn.messages$.subscribe((data: string) => {
      this.terminal.write(data);
    });

    let lineBuffer = '';
    this.terminal.onData((input: string) => {
      // Handle Enter key
      if (input === '\r') {
        conn.send(lineBuffer);
        lineBuffer = '';
        this.terminal.write('\r\n');
      } else if (input === '\x7f') {
        // Backspace
        if (lineBuffer.length > 0) {
          lineBuffer = lineBuffer.slice(0, -1);
          this.terminal.write('\b \b');
        }
      } else {
        lineBuffer += input;
        this.terminal.write(input);
      }
    });
  }
}
