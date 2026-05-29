import { Component, inject, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TooltipModule } from 'primeng/tooltip';
import { IntelHeaderComponent } from '../../shared/components/futuristic/intel-header.component';

interface TermLine {
  type: 'input' | 'output' | 'error' | 'system';
  text: string;
}

@Component({
  selector: 'app-terminal',
  standalone: true,
  imports: [FormsModule, TooltipModule, IntelHeaderComponent],
  templateUrl: './terminal.html',
  styleUrl: './terminal.scss',
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

  constructor() { this.refreshContext(); }

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

  runQuick(cmd: string) { this.currentCmd = cmd; this.execute(); }

  onInputChange(value: string) {
    if (value.trim().length > 0) { this.fetchCompletions(value); }
    else { this.showCompletions = false; this.completions = []; }
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
      if (this.historyIndex < this.history.length - 1) { this.historyIndex++; this.currentCmd = this.history[this.historyIndex]; }
      else { this.historyIndex = this.history.length; this.currentCmd = ''; }
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
    if (words.length >= 2) { words[words.length - 1] = value; this.currentCmd = words.join(' ') + ' '; }
    else { this.currentCmd = value + ' '; }
    this.showCompletions = false;
    this.completionIndex = -1;
    this.cmdInput?.nativeElement?.focus();
  }

  private debounceTimer: any = null;

  private fetchCompletions(query: string) {
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

  clear(event: Event) { event.stopPropagation(); this.lines = []; }
  focusInput() { this.cmdInput?.nativeElement?.focus(); }
  private scrollToBottom() { const el = this.termBody?.nativeElement; if (el) el.scrollTop = el.scrollHeight; }
}
