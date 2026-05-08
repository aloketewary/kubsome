import { Component, inject, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface TermLine {
  type: 'input' | 'output' | 'error' | 'system';
  text: string;
}

@Component({
  selector: 'app-terminal',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="terminal" (click)="focusInput()">
      <div class="terminal-header">
        <div class="terminal-dots">
          <span class="dot red"></span>
          <span class="dot yellow"></span>
          <span class="dot green"></span>
        </div>
        <span class="terminal-title">kubeasy — {{ context }} / {{ namespace }}</span>
      </div>

      <div class="terminal-body" #termBody>
        <div class="welcome">
          <span class="ascii">◆ KubeEasy Terminal</span>
          <span class="hint">Type any CLI command. Try: pods, overview, events, top pods, diagnose &lt;pod&gt;</span>
        </div>

        @for (line of lines; track $index) {
          <div class="term-line" [class]="'line-' + line.type">
            @if (line.type === 'input') {
              <span class="prompt">❯</span>
            }
            <pre class="line-content">{{ line.text }}</pre>
          </div>
        }

        @if (loading) {
          <div class="term-line line-system">
            <span class="spinner">⠋</span> running...
          </div>
        }

        <div class="input-line">
          <span class="prompt">❯</span>
          <input #cmdInput
                 [(ngModel)]="currentCmd"
                 (keydown.enter)="execute()"
                 (keydown.arrowUp)="historyUp()"
                 (keydown.arrowDown)="historyDown()"
                 class="cmd-input"
                 spellcheck="false"
                 autocomplete="off"
                 placeholder="Enter command..." />
        </div>
      </div>
    </div>
  `,
  styles: [`
    .terminal {
      height: calc(100vh - 52px - 64px);
      display: flex;
      flex-direction: column;
      background: #0c0c0c;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
      cursor: text;
    }
    .terminal-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 16px;
      background: #1a1a1a;
      border-bottom: 1px solid #2a2a2a;
    }
    .terminal-dots {
      display: flex;
      gap: 6px;
    }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    .dot.red { background: #ff5f57; }
    .dot.yellow { background: #febc2e; }
    .dot.green { background: #28c840; }
    .terminal-title {
      font-size: 12px;
      color: #666;
      font-family: 'JetBrains Mono', monospace;
    }
    .terminal-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      line-height: 1.6;
    }
    .welcome {
      margin-bottom: 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .ascii {
      color: var(--accent);
      font-weight: 600;
      font-size: 14px;
    }
    .hint {
      color: #555;
      font-size: 12px;
    }
    .term-line {
      display: flex;
      gap: 8px;
      margin-bottom: 2px;
    }
    .line-input {
      color: #e0e0e0;
    }
    .line-input .prompt {
      color: var(--accent);
      font-weight: 600;
    }
    .line-output {
      color: #b0b0b0;
    }
    .line-error {
      color: #ef4444;
    }
    .line-system {
      color: #666;
      font-style: italic;
    }
    .line-content {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-all;
      font-family: inherit;
      font-size: inherit;
    }
    .prompt {
      color: var(--accent);
      font-weight: 600;
      flex-shrink: 0;
    }
    .spinner {
      animation: spin-char 0.6s steps(6) infinite;
    }
    @keyframes spin-char {
      0% { content: '⠋'; }
      16% { content: '⠙'; }
      33% { content: '⠹'; }
      50% { content: '⠸'; }
      66% { content: '⠼'; }
      83% { content: '⠴'; }
    }
    .input-line {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
    }
    .cmd-input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: #e0e0e0;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      caret-color: var(--accent);
    }
    .cmd-input::placeholder {
      color: #333;
    }
  `],
})
export class TerminalComponent implements AfterViewChecked {
  private http = inject(HttpClient);

  @ViewChild('termBody') termBody!: ElementRef;
  @ViewChild('cmdInput') cmdInput!: ElementRef;

  lines: TermLine[] = [];
  currentCmd = '';
  loading = false;
  context = '...';
  namespace = '...';

  history: string[] = [];
  historyIndex = -1;

  private shouldScroll = false;

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  constructor() {
    this.http = inject(HttpClient);
    this.http.get<any>('http://localhost:8000/api/contexts').subscribe(res => {
      this.context = res.current ?? 'none';
      this.namespace = res.namespace;
    });
  }

  execute() {
    const cmd = this.currentCmd.trim();
    if (!cmd || this.loading) return;

    this.lines.push({ type: 'input', text: cmd });
    this.history.push(cmd);
    this.historyIndex = this.history.length;
    this.currentCmd = '';
    this.loading = true;
    this.shouldScroll = true;

    if (cmd === 'clear') {
      this.lines = [];
      this.loading = false;
      return;
    }

    this.http.post<any>('http://localhost:8000/api/exec', { command: cmd }).subscribe({
      next: (res) => {
        if (res.output) {
          this.lines.push({
            type: res.exit_code === 0 ? 'output' : 'error',
            text: res.output,
          });
        }
        this.loading = false;
        this.shouldScroll = true;
      },
      error: () => {
        this.lines.push({ type: 'error', text: 'Connection error — is the API running?' });
        this.loading = false;
        this.shouldScroll = true;
      },
    });
  }

  historyUp() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.currentCmd = this.history[this.historyIndex];
    }
  }

  historyDown() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.currentCmd = this.history[this.historyIndex];
    } else {
      this.historyIndex = this.history.length;
      this.currentCmd = '';
    }
  }

  focusInput() {
    this.cmdInput?.nativeElement?.focus();
  }

  private scrollToBottom() {
    const el = this.termBody?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }
}
