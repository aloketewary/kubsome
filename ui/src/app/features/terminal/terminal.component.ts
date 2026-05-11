import { Component, inject, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { SpotlightComponent } from '../../shared/components/spotlight.component';

interface TermLine {
  type: 'input' | 'output' | 'error' | 'system';
  text: string;
}

@Component({
  selector: 'app-terminal',
  standalone: true,
  imports: [FormsModule, ButtonModule, TooltipModule, SpotlightComponent],
  template: `
    <app-spotlight id="terminal" title="Terminal" icon="pi pi-terminal"
      description="Interactive shell into pods directly from the browser."
      [capabilities]="['In-browser shell', 'Pod exec', 'Auto shell detection']" [compact]="true" />

        <div class="terminal" (click)="focusInput()">
      <!-- Terminal Toolbar -->
      <div class="term-toolbar">
        <div class="toolbar-left">
          <div class="traffic-lights">
            <span class="tl red"></span>
            <span class="tl yellow"></span>
            <span class="tl green"></span>
          </div>
          <span class="term-title">kubsome</span>
          <span class="term-scope">{{ context }} / {{ namespace }}</span>
        </div>
        <div class="toolbar-right">
          <span class="cmd-count">{{ history.length }} commands</span>
          <button pButton icon="pi pi-copy" class="p-button-text p-button-sm p-button-rounded" pTooltip="Copy output" (click)="copyOutput($event)"></button>
          <button pButton icon="pi pi-trash" class="p-button-text p-button-sm p-button-rounded" pTooltip="Clear" (click)="clear($event)"></button>
        </div>
      </div>

      <!-- Quick Commands -->
      <div class="quick-cmds">
        @for (cmd of quickCommands; track cmd.label) {
          <button class="qcmd" (click)="runQuick(cmd.command)" [title]="cmd.command">{{ cmd.label }}</button>
        }
      </div>

      <!-- Terminal Body -->
      <div class="term-body" #termBody>
        @if (lines.length === 0) {
          <div class="welcome-block">
            <div class="welcome-header">
              <span class="welcome-logo">◆</span>
              <span class="welcome-title">Kubsome Terminal</span>
            </div>
            <div class="welcome-info">
              <span>Connected to <strong>{{ context }}</strong> · namespace <strong>{{ namespace }}</strong></span>
            </div>
            <div class="welcome-cmds">
              <span class="wc-label">Available commands:</span>
              <div class="wc-grid">
                <span>pods</span><span>events</span><span>overview</span><span>top pods</span>
                <span>logs &lt;pod&gt;</span><span>diagnose &lt;pod&gt;</span><span>inspect &lt;pod&gt;</span><span>kubectl ...</span>
              </div>
            </div>
            <span class="welcome-hint">↑↓ history · type "help" for all commands · "clear" to reset</span>
          </div>
        }

        @for (line of lines; track $index) {
          <div class="tl-row" [class]="'tl-' + line.type">
            @if (line.type === 'input') {
              <span class="tl-prompt">❯</span>
            } @else if (line.type === 'error') {
              <span class="tl-err-icon">✗</span>
            }
            <pre class="tl-text">{{ line.text }}</pre>
          </div>
        }

        @if (loading) {
          <div class="tl-row tl-loading">
            <span class="loading-dots">
              <span></span><span></span><span></span>
            </span>
            <span class="loading-label">executing...</span>
          </div>
        }

        <!-- Selection UI -->
        @if (selectionChoices.length > 0) {
          <div class="selection-block">
            <span class="sel-prompt">{{ selectionPrompt }}</span>
            <div class="sel-choices">
              @for (choice of selectionChoices; track choice) {
                <button class="sel-btn" (click)="selectChoice(choice)">{{ choice }}</button>
              }
            </div>
          </div>
        }

        <!-- Completions -->
        @if (showCompletions && completions.length > 0) {
          <div class="completions-popup">
            @for (c of completions; track c; let i = $index) {
              <div class="comp-item" [class.comp-active]="i === completionIndex" (click)="acceptCompletion(c)">{{ c }}</div>
            }
          </div>
        }

        <!-- Input Line -->
        <div class="input-row">
          <span class="tl-prompt">❯</span>
          <input #cmdInput
                 [(ngModel)]="currentCmd"
                 (ngModelChange)="onInputChange($event)"
                 (keydown.enter)="onEnter($event)"
                 (keydown.arrowUp)="onArrowUp($event)"
                 (keydown.arrowDown)="onArrowDown($event)"
                 (keydown.tab)="onTab($event)"
                 (keydown.escape)="showCompletions = false"
                 class="term-input"
                 spellcheck="false"
                 autocomplete="off"
                 placeholder="" />
        </div>
      </div>
    </div>
  `,
  styles: [`
    .terminal {
      height: calc(100vh - 48px - 80px);
      display: flex;
      flex-direction: column;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
      cursor: text;
    }

    /* Toolbar */
    .term-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 14px;
      background: var(--bg-elevated);
      border-bottom: 1px solid var(--border);
    }
    .toolbar-left { display: flex; align-items: center; gap: 10px; }
    .toolbar-right { display: flex; align-items: center; gap: 6px; }
    .traffic-lights { display: flex; gap: 5px; }
    .tl { width: 10px; height: 10px; border-radius: 50%; }
    .tl.red { background: #ff5f57; }
    .tl.yellow { background: #febc2e; }
    .tl.green { background: #28c840; }
    .term-title { font-size: 12px; font-weight: 600; color: var(--text-secondary); font-family: 'JetBrains Mono', monospace; }
    .term-scope { font-size: 11px; color: var(--text-muted); font-family: 'JetBrains Mono', monospace; }
    .cmd-count { font-size: 10px; color: var(--text-muted); margin-right: 4px; }

    /* Quick Commands */
    .quick-cmds {
      display: flex;
      gap: 4px;
      padding: 6px 14px;
      background: var(--bg-card);
      border-bottom: 1px solid var(--border);
      overflow-x: auto;
    }
    .qcmd {
      padding: 3px 10px;
      border-radius: 4px;
      border: 1px solid var(--border);
      background: var(--bg-card);
      color: var(--text-secondary);
      font-size: 10px;
      font-family: 'JetBrains Mono', monospace;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.1s;
    }
    .qcmd:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-subtle); }

    /* Body */
    .term-body {
      flex: 1;
      overflow-y: auto;
      padding: 14px 16px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      line-height: 1.7;
    }

    /* Welcome */
    .welcome-block { margin-bottom: 16px; }
    .welcome-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .welcome-logo { font-size: 16px; color: var(--accent); }
    .welcome-title { font-size: 14px; font-weight: 700; color: var(--text); }
    .welcome-info { font-size: 11px; color: var(--text-muted); margin-bottom: 12px; }
    .welcome-info strong { color: var(--text-secondary); }
    .welcome-cmds { margin-bottom: 10px; }
    .wc-label { font-size: 10px; color: var(--text-muted); display: block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.04em; }
    .wc-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 4px;
    }
    .wc-grid span {
      font-size: 11px;
      color: var(--text-muted);
      padding: 3px 8px;
      background: var(--bg-elevated);
      border-radius: 3px;
      border: 1px solid var(--border);
    }
    .welcome-hint { font-size: 10px; color: var(--text-muted); display: block; margin-top: 8px; }

    /* Lines */
    .tl-row { display: flex; gap: 8px; margin-bottom: 1px; padding: 1px 0; }
    .tl-input { color: var(--text); }
    .tl-output { color: var(--text-secondary); }
    .tl-error { color: #ef4444; }
    .tl-system { color: var(--text-muted); font-style: italic; }
    .tl-prompt { color: var(--accent); font-weight: 700; flex-shrink: 0; }
    .tl-err-icon { color: #ef4444; flex-shrink: 0; }
    .tl-text { margin: 0; white-space: pre-wrap; word-break: break-all; font-family: inherit; font-size: inherit; }

    /* Loading */
    .tl-loading { align-items: center; gap: 8px; color: var(--text-muted); }
    .loading-dots { display: flex; gap: 3px; }
    .loading-dots span {
      width: 5px; height: 5px; border-radius: 50%; background: var(--accent);
      animation: dotPulse 1.2s infinite;
    }
    .loading-dots span:nth-child(2) { animation-delay: 0.2s; }
    .loading-dots span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes dotPulse { 0%,100% { opacity: 0.2; } 50% { opacity: 1; } }
    .loading-label { font-size: 11px; }

    /* Input */
    /* Selection UI */
    .selection-block {
      margin: 8px 0;
      padding: 10px 12px;
      background: var(--bg-elevated);
      border: 1px solid var(--accent);
      border-radius: 8px;
    }
    .sel-prompt { font-size: 11px; color: var(--accent); display: block; margin-bottom: 8px; }
    .sel-choices { display: flex; flex-direction: column; gap: 3px; }
    .sel-btn {
      text-align: left;
      padding: 6px 10px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 5px;
      color: var(--text);
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.1s;
    }
    .sel-btn:hover { border-color: var(--accent); background: var(--accent-subtle); color: var(--accent); }

    /* Completions Popup */
    .completions-popup {
      margin: 4px 0;
      padding: 4px;
      background: var(--bg-card);
      border: 1px solid var(--accent);
      border-radius: 6px;
      max-height: 160px;
      overflow-y: auto;
    }
    .comp-item {
      padding: 4px 10px;
      font-size: 11px;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.08s;
      font-family: 'JetBrains Mono', monospace;
    }
    .comp-item:hover, .comp-item.comp-active {
      background: var(--accent-subtle);
      color: var(--accent);
    }

    .input-row { display: flex; align-items: center; gap: 8px; margin-top: 4px; padding: 6px 0; border-top: 1px solid var(--border); }
    .term-input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: var(--text);
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      caret-color: var(--accent);
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
  selectionChoices: string[] = [];
  selectionPrompt = '';
  pendingCommand = '';
  completions: string[] = [];
  showCompletions = false;
  completionIndex = -1;
  historyIndex = -1;
  private shouldScroll = false;

  quickCommands = [
    { label: 'pods', command: 'pods' },
    { label: 'events', command: 'events' },
    { label: 'overview', command: 'overview' },
    { label: 'top pods', command: 'top pods' },
    { label: 'top nodes', command: 'top nodes' },
    { label: 'kubectl get svc', command: 'kubectl get svc' },
    { label: 'kubectl get deploy', command: 'kubectl get deploy' },
  ];

  ngAfterViewChecked() {
    if (this.shouldScroll) { this.scrollToBottom(); this.shouldScroll = false; }
  }

  constructor() {
    this.refreshContext();
  }

  private refreshContext() {
    this.http.get<any>('/api/contexts').subscribe({
      next: res => { this.context = res.current ?? 'none'; this.namespace = res.namespace; },
      error: () => { this.context = 'unreachable'; this.namespace = '—'; },
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
    this.selectionChoices = [];

    if (cmd === 'clear') { this.lines = []; this.loading = false; return; }

    this.runCommand(cmd);
  }

  private runCommand(cmd: string, selection?: string) {
    const body: any = { command: cmd };
    if (selection) body.selection = selection;

    this.http.post<any>('/api/exec', body).subscribe({
      next: (res) => {
        if (res.needs_selection) {
          // Show selection UI
          this.selectionChoices = res.choices || [];
          this.selectionPrompt = res.selection_prompt || 'Select:';
          this.pendingCommand = res.original_command || cmd;
          this.loading = false;
          this.shouldScroll = true;
        } else {
          if (res.output) { this.lines.push({ type: res.exit_code === 0 ? 'output' : 'error', text: res.output }); }
          this.loading = false;
          this.shouldScroll = true;
          this.refreshContext();
        }
      },
      error: () => {
        this.lines.push({ type: 'error', text: 'Connection error — is the API running?' });
        this.loading = false;
        this.shouldScroll = true;
      },
    });
  }

  selectChoice(choice: string) {
    this.lines.push({ type: 'system', text: `→ ${choice}` });
    this.selectionChoices = [];
    this.loading = true;
    this.shouldScroll = true;
    this.runCommand(this.pendingCommand, choice);
  }

  runQuick(cmd: string) {
    this.currentCmd = cmd;
    this.execute();
  }

  onInputChange(value: string) {
    if (value.trim().length > 0) {
      this.fetchCompletions(value);
    } else {
      this.showCompletions = false;
      this.completions = [];
    }
  }

  onEnter(event: Event) {
    if (this.showCompletions && this.completionIndex >= 0) {
      event.preventDefault();
      this.acceptCompletion(this.completions[this.completionIndex]);
    } else {
      this.showCompletions = false;
      this.execute();
    }
  }

  onArrowUp(event: Event) {
    if (this.showCompletions && this.completions.length > 0) {
      event.preventDefault();
      this.completionIndex = Math.max(0, this.completionIndex - 1);
    } else {
      if (this.historyIndex > 0) { this.historyIndex--; this.currentCmd = this.history[this.historyIndex]; }
    }
  }

  onArrowDown(event: Event) {
    if (this.showCompletions && this.completions.length > 0) {
      event.preventDefault();
      this.completionIndex = Math.min(this.completions.length - 1, this.completionIndex + 1);
    } else {
      if (this.historyIndex < this.history.length - 1) { this.historyIndex++; this.currentCmd = this.history[this.historyIndex]; } else { this.historyIndex = this.history.length; this.currentCmd = ''; }
    }
  }

  onTab(event: Event) {
    event.preventDefault();
    if (this.completions.length > 0) {
      this.acceptCompletion(this.completions[this.completionIndex >= 0 ? this.completionIndex : 0]);
    }
  }

  acceptCompletion(value: string) {
    const words = this.currentCmd.trim().split(' ');
    if (words.length >= 2) {
      // Replace only the last word (the partial query)
      words[words.length - 1] = value;
      this.currentCmd = words.join(' ') + ' ';
    } else {
      // Top-level command
      this.currentCmd = value + ' ';
    }
    this.showCompletions = false;
    this.completionIndex = -1;
    this.cmdInput?.nativeElement?.focus();
  }

  private debounceTimer: any = null;

  private fetchCompletions(query: string) {
    // Debounce: wait 200ms after last keystroke
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.http.get<any>(`/api/completions?q=${encodeURIComponent(query)}`).subscribe({
        next: (res) => {
          this.completions = res.completions || [];
          this.showCompletions = this.completions.length > 0 && this.currentCmd.trim().length > 0;
          this.completionIndex = -1;
        },
        error: () => { this.showCompletions = false; }
      });
    }, 200);
  }

  copyOutput(event: Event) {
    event.stopPropagation();
    const output = this.lines.filter(l => l.type === 'output' || l.type === 'error').map(l => l.text).join('\n');
    navigator.clipboard.writeText(output);
  }

  clear(event: Event) {
    event.stopPropagation();
    this.lines = [];
  }

  focusInput() { this.cmdInput?.nativeElement?.focus(); }
  private scrollToBottom() { const el = this.termBody?.nativeElement; if (el) el.scrollTop = el.scrollHeight; }
}
