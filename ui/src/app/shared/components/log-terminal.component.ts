import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WsService } from '../../core/services/ws.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-log-terminal',
  standalone: true,
  template: `
    <div class="terminal-container" #terminalContainer></div>
  `,
  styles: [`
    .terminal-container {
      width: 100%;
      height: 100%;
      background: #000;
      padding: 8px;
    }
    .xterm-viewport {
      background-color: transparent !important;
    }
  `],
  encapsulation: ViewEncapsulation.None
})
export class LogTerminalComponent implements OnInit, OnDestroy {
  @ViewChild('terminalContainer', { static: true }) terminalContainer!: ElementRef;
  @Input() podName!: string;

  private terminal!: Terminal;
  private fitAddon!: FitAddon;
  private subscription: Subscription | null = null;
  private wsConn: any = null;
  private resizeListener = () => this.fitAddon.fit();

  constructor(private ws: WsService) {}

  ngOnInit() {
    this.initTerminal();
    if (this.podName) {
      this.connectLogs();
    }
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
    this.wsConn?.close();
    window.removeEventListener('resize', this.resizeListener);
    this.terminal.dispose();
  }

  private initTerminal() {
    this.terminal = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#070708',
        foreground: '#e4e4e7',
        cursor: '#3b82f6',
        selectionBackground: 'rgba(59, 130, 246, 0.3)',
      },
      fontSize: 12,
      fontFamily: "'JetBrains Mono', monospace",
      convertEol: true,
      scrollback: 5000
    });

    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);
    this.terminal.open(this.terminalContainer.nativeElement);
    this.fitAddon.fit();

    window.addEventListener('resize', this.resizeListener);
  }

  private connectLogs() {
    this.wsConn = this.ws.connect(`/ws/logs/${this.podName}`);
    this.subscription = this.wsConn.messages$.subscribe((line: string) => {
      this.terminal.writeln(this.colorize(line));
    });
  }

  private colorize(line: string): string {
    // Simple regex-based colorization for logs
    let colored = line;
    if (line.toLowerCase().includes('error') || line.toLowerCase().includes('fatal')) {
      colored = `\x1b[31m${line}\x1b[0m`; // Red
    } else if (line.toLowerCase().includes('warn')) {
      colored = `\x1b[33m${line}\x1b[0m`; // Yellow
    } else if (line.toLowerCase().includes('info')) {
      colored = `\x1b[36m${line}\x1b[0m`; // Cyan
    }
    return colored;
  }
}
