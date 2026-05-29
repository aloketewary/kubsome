import { Component, inject, ViewChild, ElementRef, AfterViewChecked, Pipe, PipeTransform, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { IntelHeaderComponent } from '../../shared/components/futuristic/intel-header.component';

@Pipe({ name: 'safeHtml', standalone: true })
export class SafeHtmlPipe implements PipeTransform {
  private sanitizer = inject(DomSanitizer);
  transform(value: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(value);
  }
}

interface Message {
  role: 'user' | 'ai';
  text: string;
  html?: string;
  time: string;
  severity?: string;
  title?: string;
  options?: string[];
  originalQuery?: string;
  copied?: boolean;
  followUps?: string[];
}

@Component({
  selector: 'app-ai',
  standalone: true,
  imports: [ButtonModule, TooltipModule, FormsModule, IntelHeaderComponent, SafeHtmlPipe],
  template: `
    <app-intel-header title="AI Assistant" icon="pi pi-sparkles"
      subtitle="Natural language cluster intelligence">
      @if (messages.length > 0) {
        <button class="ctrl-btn ctrl-btn-wide" (click)="clearHistory()" pTooltip="Clear"><i class="pi pi-trash"></i> Clear</button>
      }
    </app-intel-header>

    <div class="chat-layout">
      <!-- Messages Area -->
      <div class="messages-area" #messagesEl>
        @if (messages.length === 0 && !loading) {
          <!-- Rich Empty State -->
          <div class="welcome">
            <div class="welcome-icon">
              <i class="pi pi-sparkles"></i>
            </div>
            <h2>What can I help you with?</h2>
            <p>I can analyze your cluster, diagnose issues, and explain Kubernetes concepts.</p>

            <div class="suggestion-categories">
              <div class="sug-category">
                <span class="sug-cat-label"><i class="pi pi-exclamation-triangle"></i> Diagnose</span>
                <div class="sug-items">
                  @for (s of diagnoseSuggestions; track s) {
                    <button class="sug-btn" (click)="query = s; ask()">{{ s }}</button>
                  }
                </div>
              </div>
              <div class="sug-category">
                <span class="sug-cat-label"><i class="pi pi-chart-bar"></i> Analyze</span>
                <div class="sug-items">
                  @for (s of analyzeSuggestions; track s) {
                    <button class="sug-btn" (click)="query = s; ask()">{{ s }}</button>
                  }
                </div>
              </div>
              <div class="sug-category">
                <span class="sug-cat-label"><i class="pi pi-history"></i> Investigate</span>
                <div class="sug-items">
                  @for (s of investigateSuggestions; track s) {
                    <button class="sug-btn" (click)="query = s; ask()">{{ s }}</button>
                  }
                </div>
              </div>
            </div>
          </div>
        }

        <!-- Messages -->
        @for (msg of messages; track $index) {
          <div class="msg-row" [class.msg-row-user]="msg.role === 'user'">
            <div class="msg-avatar" [class]="'avatar-' + msg.role">
              <i class="pi" [class]="msg.role === 'user' ? 'pi-user' : 'pi-sparkles'"></i>
            </div>
            <div class="msg-bubble" [class]="'bubble-' + msg.role">
              <button class="copy-btn" [class.copied]="msg.copied" (click)="copyMessage(msg)" [pTooltip]="msg.copied ? 'Copied!' : 'Copy'" tooltipPosition="top">
                <i class="pi" [class]="msg.copied ? 'pi-check' : 'pi-copy'"></i>
              </button>
              <div class="msg-header">
                <span class="msg-name">{{ msg.role === 'user' ? 'You' : 'Kubsome AI' }}</span>
                @if (msg.role === 'ai' && msg.severity && msg.severity !== 'info') {
                  <span class="severity-badge" [class]="'sev-' + msg.severity">{{ msg.severity }}</span>
                }
                <span class="msg-time">{{ msg.time }}</span>
              </div>
              @if (msg.role === 'ai' && msg.title) {
                <div class="msg-title">{{ msg.title }}</div>
              }
              @if (msg.html) {
                <div class="msg-content" [innerHTML]="msg.html | safeHtml"></div>
              } @else {
                <div class="msg-content">{{ msg.text }}</div>
              }
              @if (msg.options && msg.options.length > 0) {
                <div class="msg-options">
                  @for (opt of msg.options; track opt) {
                    <button class="opt-btn" (click)="selectOption(opt, msg)">{{ opt }}</button>
                  }
                </div>
              }
              @if (msg.followUps && msg.followUps.length > 0) {
                <div class="msg-followups">
                  <span class="followup-label">Follow up:</span>
                  @for (fu of msg.followUps; track fu) {
                    <button class="followup-btn" (click)="query = fu; ask()">{{ fu }}</button>
                  }
                </div>
              }
            </div>
          </div>
        }

        <!-- Typing Indicator -->
        @if (loading) {
          <div class="msg-row">
            <div class="msg-avatar avatar-ai"><i class="pi pi-sparkles"></i></div>
            <div class="msg-bubble bubble-ai">
              <div class="typing-indicator">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
              </div>
            </div>
          </div>
        }
      </div>

      <!-- Input Area -->
      <div class="input-area">
        <div class="input-container">
          <input [(ngModel)]="query" placeholder="Ask about your cluster..."
                 (keyup.enter)="ask()" [disabled]="loading" />
          <button class="send-btn" (click)="ask()" [disabled]="!query.trim() || loading">
            <i class="pi pi-send"></i>
          </button>
        </div>
        <span class="input-hint">Press Enter to send · Try "why is X failing" or "summarize health"</span>
      </div>
    </div>
  `,
  styles: [`
    /* Layout */
    .chat-layout {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 200px);
      background: transparent;
      border: none;
      border-top: 1px solid rgba(94, 84, 75, 0.08);
      overflow: hidden;
    }

    /* Messages */
    .messages-area {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* Welcome */
    .welcome {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 32px 20px;
    }
    .welcome-icon {
      width: 48px; height: 48px; border-radius: 50%;
      border: 1px solid rgba(208, 156, 96, 0.2);
      background: transparent;
      display: flex; align-items: center; justify-content: center;
      font-size: 20px; color: var(--accent); margin-bottom: 16px;
    }
    .welcome h2 { font-size: 18px; font-weight: 300; margin: 0 0 8px; color: var(--text); }
    .welcome p { font-size: 12px; color: var(--text-muted); margin: 0 0 28px; max-width: 400px; }

    .suggestion-categories {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0;
      width: 100%;
      max-width: 600px;
    }
    .sug-category {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 12px;
      border-right: 1px solid rgba(94, 84, 75, 0.06);
    }
    .sug-category:last-child { border-right: none; }
    .sug-cat-label {
      font-size: 9px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 4px;
    }
    .sug-cat-label i { font-size: 10px; }
    .sug-items { display: flex; flex-direction: column; gap: 3px; }
    .sug-btn {
      padding: 7px 10px;
      background: transparent;
      border: none;
      border-bottom: 1px solid rgba(94, 84, 75, 0.04);
      color: var(--text-secondary);
      font-size: 11px;
      text-align: left;
      cursor: pointer;
      transition: all 0.12s;
    }
    .sug-btn:hover {
      color: var(--accent);
      background: rgba(208, 156, 96, 0.02);
    }

    /* Message Rows */
    .msg-row {
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }
    .msg-row-user {
      flex-direction: row-reverse;
    }
    .msg-avatar {
      width: 24px; height: 24px;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; flex-shrink: 0;
    }
    .avatar-user { color: var(--accent); }
    .avatar-ai { color: var(--accent); }

    .msg-bubble {
      max-width: 80%;
      padding: 12px 16px;
      overflow: visible;
      position: relative;
    }
    .copy-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 22px; height: 22px;
      border: none;
      background: transparent;
      color: var(--text-muted);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      font-size: 11px;
      opacity: 0;
      transition: opacity 0.12s;
    }
    .msg-bubble:hover .copy-btn { opacity: 1; }
    .copy-btn:hover { color: var(--text); }
    .copy-btn.copied { opacity: 1; color: var(--success); }
    .bubble-user .copy-btn { color: rgba(245, 240, 235, 0.5); }
    .bubble-user .copy-btn.copied { color: var(--success); }
    .bubble-user {
      background: transparent;
      border-left: 2px solid var(--accent);
      color: var(--text);
    }
    .bubble-ai {
      background: transparent;
      border-left: 2px solid rgba(94, 84, 75, 0.15);
      max-width: 90%;
    }
    .bubble-ai::after { display: none; }
    .msg-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .msg-name { font-size: 9px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; }
    .msg-time { font-size: 9px; color: var(--text-muted); opacity: 0.5; font-family: 'JetBrains Mono', monospace; }
    .msg-title {
      font-size: 13px;
      font-weight: 600;
      margin: 4px 0 8px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(94, 84, 75, 0.06);
      color: var(--text);
    }
    .severity-badge {
      font-size: 8px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 2px 6px;
      border: 1px solid;
    }
    .sev-critical { border-color: rgba(244, 63, 94, 0.25); color: var(--danger); }
    .sev-warning { border-color: rgba(245, 158, 11, 0.25); color: var(--warning); }
    .sev-healthy { border-color: rgba(74, 222, 128, 0.25); color: var(--success); }
    .msg-content {
      font-size: 12px;
      line-height: 1.7;
      word-break: break-word;
      color: var(--text-secondary);
    }
    .msg-content :is(.clr-red) { color: var(--danger); }
    .msg-content :is(.clr-green) { color: var(--success); }
    .msg-content :is(.clr-yellow) { color: var(--warning); }
    .msg-content :is(.clr-cyan) { color: var(--accent); font-family: 'JetBrains Mono', monospace; font-size: 11px; }
    .msg-content :is(.clr-dim) { opacity: 0.5; font-size: 11px; }
    .msg-options {
      display: flex; flex-wrap: wrap; gap: 4px; margin-top: 10px;
      padding-top: 10px; border-top: 1px solid rgba(94, 84, 75, 0.06);
    }
    .opt-btn {
      padding: 5px 10px;
      background: transparent; border: 1px solid rgba(208, 156, 96, 0.2);
      color: var(--accent); font-size: 10px;
      font-family: 'JetBrains Mono', monospace;
      cursor: pointer; transition: all 0.12s;
      white-space: nowrap; overflow: hidden;
      text-overflow: ellipsis; max-width: 100%;
    }
    .opt-btn:hover { border-color: var(--accent); background: rgba(208, 156, 96, 0.04); }

    /* Follow-ups */
    .msg-followups {
      display: flex; flex-wrap: wrap; gap: 4px; align-items: center;
      margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(94, 84, 75, 0.06);
    }
    .followup-label { font-size: 9px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
    .followup-btn {
      padding: 4px 8px;
      background: transparent; border: 1px solid rgba(94, 84, 75, 0.12);
      color: var(--text-muted); font-size: 10px;
      cursor: pointer; transition: all 0.12s;
    }
    .followup-btn:hover { border-color: var(--accent); color: var(--accent); }

    /* Typing Indicator */
    .typing-indicator { display: flex; gap: 4px; padding: 4px 0; }
    .typing-dot {
      width: 5px; height: 5px; border-radius: 50%;
      background: var(--text-muted);
      animation: typingBounce 1.4s infinite;
    }
    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes typingBounce {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.3; }
      30% { transform: translateY(-3px); opacity: 1; }
    }

    /* Input */
    .input-area {
      padding: 16px 24px;
      border-top: 1px solid rgba(94, 84, 75, 0.08);
    }
    .input-container {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .input-container input {
      flex: 1;
      padding: 12px 16px;
      background: transparent !important;
      border: 1px solid rgba(94, 84, 75, 0.15) !important;
      border-bottom: 1px solid rgba(94, 84, 75, 0.15) !important;
      color: var(--text);
      font-size: 13px;
      font-family: 'JetBrains Mono', monospace;
      outline: none;
      transition: border-color 0.15s;
    }
    .input-container input:focus {
      border-color: var(--accent) !important;
      box-shadow: none !important;
    }
    .input-container input::placeholder { color: var(--text-muted); opacity: 0.5; }
    .send-btn {
      width: 36px; height: 36px;
      background: transparent; border: 1px solid var(--accent);
      color: var(--accent);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: all 0.12s; font-size: 13px;
    }
    .send-btn:hover { background: var(--accent); color: #0B0908; }
    .send-btn:disabled { opacity: 0.3; cursor: not-allowed; }
    .input-hint {
      display: block;
      font-size: 9px;
      color: var(--text-muted);
      margin-top: 6px;
      text-align: center;
      opacity: 0.5;
    }

    /* Light Mode */
    :host-context([data-theme="light"]) .chat-layout { border-top-color: rgba(0, 0, 0, 0.06); }
    :host-context([data-theme="light"]) .welcome-icon { border-color: rgba(154, 81, 41, 0.15); color: #9a5129; }
    :host-context([data-theme="light"]) .sug-category { border-right-color: rgba(0, 0, 0, 0.04); }
    :host-context([data-theme="light"]) .sug-btn { border-bottom-color: rgba(0, 0, 0, 0.03); }
    :host-context([data-theme="light"]) .sug-btn:hover { color: #9a5129; background: rgba(0, 0, 0, 0.015); }
    :host-context([data-theme="light"]) .bubble-user { border-left-color: #9a5129; }
    :host-context([data-theme="light"]) .bubble-ai { border-left-color: rgba(0, 0, 0, 0.08); }
    :host-context([data-theme="light"]) .opt-btn { border-color: rgba(154, 81, 41, 0.15); color: #9a5129; }
    :host-context([data-theme="light"]) .opt-btn:hover { border-color: #9a5129; }
    :host-context([data-theme="light"]) .followup-btn { border-color: rgba(0, 0, 0, 0.06); }
    :host-context([data-theme="light"]) .followup-btn:hover { border-color: #9a5129; color: #9a5129; }
    :host-context([data-theme="light"]) .input-area { border-top-color: rgba(0, 0, 0, 0.06); }
    :host-context([data-theme="light"]) .input-container input { border-color: rgba(0, 0, 0, 0.1) !important; }
    :host-context([data-theme="light"]) .input-container input:focus { border-color: #9a5129 !important; }
    :host-context([data-theme="light"]) .send-btn { border-color: #9a5129; color: #9a5129; }
    :host-context([data-theme="light"]) .send-btn:hover { background: #9a5129; color: #fff; }
    :host-context([data-theme="light"]) .msg-title { border-bottom-color: rgba(0, 0, 0, 0.04); }
    :host-context([data-theme="light"]) .msg-options { border-top-color: rgba(0, 0, 0, 0.04); }
    :host-context([data-theme="light"]) .msg-followups { border-top-color: rgba(0, 0, 0, 0.04); }

    @media (max-width: 768px) {
      .suggestion-categories { grid-template-columns: 1fr; }
      .sug-category { border-right: none; border-bottom: 1px solid rgba(94, 84, 75, 0.04); }
    }
  `],
})
export class AiComponent implements OnInit, AfterViewChecked {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  @ViewChild('messagesEl') messagesEl!: ElementRef;

  query = '';
  messages: Message[] = [];
  loading = false;
  private shouldScroll = false;

  diagnoseSuggestions = [
    'why is payment-api failing',
    'diagnose high restart pods',
    'which pods are unhealthy',
    'what\'s wrong with billing',
  ];
  analyzeSuggestions = [
    'summarize cluster health',
    'how many pods running',
    'top resource consumers',
    'is billing-api healthy',
  ];
  investigateSuggestions = [
    'what changed recently',
    'show warning events',
    'any anomalies detected',
    'count customer pods',
  ];

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  ask() {
    if (!this.query.trim() || this.loading) return;
    const q = this.query;
    this.messages.push({ role: 'user', text: q, time: this.now() });
    this.query = '';
    this.loading = true;
    this.shouldScroll = true;

    this.api.askAi(q).subscribe({
      next: (res: any) => {
        if (res.severity === 'clarify' && res.options) {
          this.messages.push({
            role: 'ai',
            text: res.answer,
            time: this.now(),
            options: res.options,
            originalQuery: res.original_query || q,
          });
        } else {
          const text = res.answer || res.summary || JSON.stringify(res, null, 2);
          this.messages.push({
            role: 'ai',
            text,
            html: res.html || undefined,
            title: res.title || undefined,
            severity: res.severity || 'info',
            time: this.now(),
            followUps: res.follow_ups || undefined,
          });
        }
        this.loading = false;
        this.shouldScroll = true;
      },
      error: () => {
        this.messages.push({ role: 'ai', text: 'Error: could not get response.', time: this.now() });
        this.loading = false;
        this.shouldScroll = true;
      },
    });
  }

  clearHistory() {
    this.messages = [];
  }

  selectOption(option: string, msg: Message) {
    // Clear options so they can't be clicked again
    msg.options = [];

    // Re-ask with the specific pod name in the original query
    const original = msg.originalQuery || '';
    // Replace the ambiguous target with the selected option
    const words = original.split(' ');
    // Find and replace the fuzzy target
    const skip = new Set(['why', 'is', 'how', 'many', 'pod', 'pods', 'the', 'my', 'failing', 'crashing', 'running', 'consuming', 'cpu', 'memory', 'more', 'check', 'diagnose', 'inspect', 'logs', 'for', 'of', 'healthy', 'status', 'what', "what's", 'whats', 'wrong', 'with', 'show', 'me', 'get', 'describe', 'trace', 'debug', 'troubleshoot', 'analyze', 'investigate']);
    let replaced = false;
    const refined = words.map(w => {
      if (!replaced && !skip.has(w.toLowerCase().replace('?', ''))) {
        replaced = true;
        return option;
      }
      return w;
    }).join(' ');

    this.query = replaced ? refined : `${original} ${option}`;
    this.ask();
  }

  copyMessage(msg: Message) {
    const text = msg.text || '';
    navigator.clipboard.writeText(text).then(() => {
      msg.copied = true;
      setTimeout(() => msg.copied = false, 2000);
    });
  }

  private scrollToBottom() {
    const el = this.messagesEl?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  private now(): string {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const q = params['q'];
      if (q) {
        this.query = q;
        this.ask();
      }
    });
  }
}
