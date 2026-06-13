import { Component, inject, ViewChild, ElementRef, AfterViewChecked, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TooltipModule } from 'primeng/tooltip';
import { IntelHeaderComponent } from '../../shared/components/futuristic/intel-header.component';

interface TermLine {
  type: 'input' | 'output' | 'error' | 'system';
  text: string;
  pinned?: boolean;
  ts?: number;
}

interface PaletteItem {
  label: string;
  command: string;
  category: string;
}

interface RecentResource {
  kind: string;
  name: string;
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
  @ViewChild('paletteInput') paletteInput!: ElementRef;

  lines: TermLine[] = [];
  pinnedLines: TermLine[] = [];
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

  // Palette
  showPalette = false;
  paletteQuery = '';
  paletteIndex = 0;

  paletteItems: PaletteItem[] = [
    { label: 'View Pods', command: 'pods', category: 'observe' },
    { label: 'View Events', command: 'events', category: 'observe' },
    { label: 'Cluster Overview', command: 'overview', category: 'observe' },
    { label: 'Top Pods', command: 'top pods', category: 'observe' },
    { label: 'Top Nodes', command: 'top nodes', category: 'observe' },
    { label: 'Scorecard', command: 'scorecard', category: 'observe' },
    { label: 'View Logs', command: 'logs ', category: 'operate' },
    { label: 'Describe Pod', command: 'describe pod ', category: 'operate' },
    { label: 'Restart Deployment', command: 'restart ', category: 'operate' },
    { label: 'Scale Deployment', command: 'scale ', category: 'operate' },
    { label: 'Rollout Status', command: 'rollout ', category: 'operate' },
    { label: 'Diagnose Pod', command: 'diagnose ', category: 'diagnose' },
    { label: 'Inspect Pod', command: 'inspect ', category: 'diagnose' },
    { label: 'Security Scan', command: 'security', category: 'diagnose' },
  ];

  // Templates — inline shortcuts
  templates = [
    { label: 'Pods', cmd: 'pods', key: '1' },
    { label: 'Logs', cmd: 'logs ', key: '2' },
    { label: 'Describe', cmd: 'describe pod ', key: '3' },
    { label: 'Restart', cmd: 'restart ', key: '4' },
    { label: 'Scale', cmd: 'scale ', key: '5' },
    { label: 'Events', cmd: 'events', key: '6' },
  ];

  favorites: string[] = [];
  recentResources: RecentResource[] = [];
  activeResourceIdx = -1;

  // Danger
  private dangerPatterns = ['delete', 'drain', 'scale 0', 'rollout undo'];
  showDangerConfirm = false;
  dangerCommand = '';

  get filteredPalette(): PaletteItem[] {
    if (!this.paletteQuery.trim()) return this.paletteItems;
    const q = this.paletteQuery.toLowerCase();
    return this.paletteItems.filter(i =>
      i.label.toLowerCase().includes(q) || i.command.toLowerCase().includes(q)
    );
  }

  get isDangerContext(): boolean {
    return this.context.includes('prod') || this.context.includes('prd');
  }

  ngAfterViewChecked() {
    if (this.shouldScroll) { this.scrollToBottom(); this.shouldScroll = false; }
  }

  constructor() {
    this.refreshContext();
    this.loadFavorites();
  }

  @HostListener('document:keydown', ['$event'])
  onGlobalKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      this.togglePalette();
    }
    if (e.key === 'Escape') {
      if (this.showPalette) this.showPalette = false;
      if (this.showDangerConfirm) this.cancelDanger();
    }
  }

  togglePalette() {
    this.showPalette = !this.showPalette;
    this.paletteQuery = '';
    this.paletteIndex = 0;
    if (this.showPalette) {
      setTimeout(() => this.paletteInput?.nativeElement?.focus(), 40);
    }
  }

  onPaletteKey(e: KeyboardEvent) {
    const items = this.filteredPalette;
    if (e.key === 'ArrowDown') { e.preventDefault(); this.paletteIndex = Math.min(items.length - 1, this.paletteIndex + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.paletteIndex = Math.max(0, this.paletteIndex - 1); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[this.paletteIndex]) this.selectPaletteItem(items[this.paletteIndex]);
    }
  }

  selectPaletteItem(item: PaletteItem) {
    this.showPalette = false;
    this.currentCmd = item.command;
    if (!item.command.endsWith(' ')) { this.execute(); }
    else { setTimeout(() => this.cmdInput?.nativeElement?.focus(), 40); }
  }

  private refreshContext() {
    this.http.get<any>('/api/contexts').subscribe({
      next: res => { this.context = res.current ?? 'none'; this.namespace = res.namespace; },
      error: () => { this.context = 'unreachable'; this.namespace = '—'; },
    });
  }

  private isDangerCommand(cmd: string): boolean {
    const lower = cmd.toLowerCase().trim();
    return this.dangerPatterns.some(p => lower.includes(p));
  }

  execute() {
    const cmd = this.currentCmd.trim();
    if (!cmd || this.loading) return;

    if (this.isDangerCommand(cmd) && !this.showDangerConfirm) {
      this.dangerCommand = cmd;
      this.showDangerConfirm = true;
      return;
    }

    this.showDangerConfirm = false;
    this.dangerCommand = '';
    this.lines.push({ type: 'input', text: cmd, ts: Date.now() });
    this.history.push(cmd);
    this.historyIndex = this.history.length;
    this.currentCmd = '';
    this.loading = true;
    this.shouldScroll = true;
    this.selectionChoices = [];

    if (cmd === 'clear') { this.lines = []; this.loading = false; return; }
    this.runCommand(cmd);
  }

  confirmDanger() {
    this.currentCmd = this.dangerCommand;
    this.showDangerConfirm = false;
    this.execute();
  }

  cancelDanger() { this.showDangerConfirm = false; this.dangerCommand = ''; }

  private runCommand(cmd: string, selection?: string) {
    const body: any = { command: cmd };
    if (selection) body.selection = selection;

    this.http.post<any>('/api/exec', body).subscribe({
      next: (res) => {
        if (res.needs_selection) {
          this.selectionChoices = res.choices || [];
          this.selectionPrompt = res.selection_prompt || 'Select:';
          this.pendingCommand = res.original_command || cmd;
        } else {
          if (res.output) {
            this.lines.push({ type: res.exit_code === 0 ? 'output' : 'error', text: res.output, ts: Date.now() });
            this.extractResources(res.output);
          }
          this.refreshContext();
        }
        this.loading = false;
        this.shouldScroll = true;
      },
      error: () => {
        this.lines.push({ type: 'error', text: 'Connection error — is the API running?', ts: Date.now() });
        this.loading = false;
        this.shouldScroll = true;
      },
    });
  }

  private extractResources(output: string) {
    const regex = /(?:pod|po|deployment|deploy)\/([a-z0-9][\w.-]*)/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(output)) !== null) {
      const full = match[0];
      const [kindRaw, name] = full.split('/');
      const kind = kindRaw.toLowerCase().startsWith('dep') ? 'deployment' : 'pod';
      if (!this.recentResources.find(r => r.kind === kind && r.name === name)) {
        this.recentResources.unshift({ kind, name });
        if (this.recentResources.length > 6) this.recentResources.pop();
      }
    }
  }

  selectChoice(choice: string) {
    this.lines.push({ type: 'system', text: `→ ${choice}`, ts: Date.now() });
    this.selectionChoices = [];
    this.loading = true;
    this.shouldScroll = true;
    this.runCommand(this.pendingCommand, choice);
  }

  useTemplate(cmd: string) {
    this.currentCmd = cmd;
    if (!cmd.endsWith(' ')) this.execute();
    else setTimeout(() => this.cmdInput?.nativeElement?.focus(), 40);
  }

  // Favorites
  private loadFavorites() {
    const saved = localStorage.getItem('kubsome-terminal-favorites');
    this.favorites = saved ? JSON.parse(saved) : ['kubectl get pods -A', 'kubectl top nodes'];
  }

  private saveFavorites() {
    localStorage.setItem('kubsome-terminal-favorites', JSON.stringify(this.favorites));
  }

  toggleFavorite(cmd?: string) {
    const target = cmd || this.currentCmd.trim();
    if (!target) return;
    if (this.favorites.includes(target)) {
      this.favorites = this.favorites.filter(f => f !== target);
    } else {
      this.favorites.unshift(target);
      if (this.favorites.length > 10) this.favorites.pop();
    }
    this.saveFavorites();
  }

  isFavorite(cmd: string): boolean { return this.favorites.includes(cmd); }

  runFavorite(cmd: string) { this.currentCmd = cmd; this.execute(); }

  // Recent resource actions
  resourceAction(res: RecentResource, action: string) {
    this.activeResourceIdx = -1;
    const map: Record<string, string> = {
      describe: `describe ${res.kind} ${res.name}`,
      logs: `logs ${res.name}`,
      inspect: `inspect ${res.name}`,
    };
    this.currentCmd = map[action] || '';
    this.execute();
  }

  // Pinning
  pinLine(idx: number) {
    const line = this.lines[idx];
    if (line && !line.pinned) {
      line.pinned = true;
      this.pinnedLines.push({ ...line });
    }
  }

  unpinLine(idx: number) { this.pinnedLines.splice(idx, 1); }

  // Input
  onInputChange(value: string) {
    if (value.trim().length > 0) this.fetchCompletions(value);
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
    }, 180);
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
