import { Component, inject, ViewChild, ElementRef, AfterViewChecked, Pipe, PipeTransform, OnInit } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { PageInfoComponent } from '../../shared/components/page-info.component';
import { SpotlightComponent } from '../../shared/components/spotlight.component';

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
  imports: [ButtonModule, TooltipModule, FormsModule, PageInfoComponent, SafeHtmlPipe, SpotlightComponent],
  template: `
    <app-spotlight id="ai" title="AI Assistant" icon="pi pi-sparkles"
      description="Ask natural language questions about your cluster. Get explanations, suggestions, and generated manifests."
      [capabilities]="['Natural language queries', 'Root cause explanations', 'YAML generation', 'Command suggestions']" [compact]="true" />

        <div class="page-header">
      <div>
        <h1>AI Assistant</h1>
        <p class="subtitle">Natural language cluster intelligence</p>
      </div>
      <div class="header-actions">
        @if (messages.length > 0) {
          <button pButton icon="pi pi-trash" label="Clear" class="p-button-text p-button-sm" (click)="clearHistory()" pTooltip="Clear conversation"></button>
        }
        <app-page-info title="AI Assistant" description="Ask natural language questions about your cluster. AI analyzes pods, events, metrics, and logs to answer."
          [tips]="['Type naturally: why is payment failing?', 'When multiple pods match, click to select one', 'AI correlates logs + events + metrics for diagnosis', 'Works offline — no external API needed']"
          [commands]="['why is <pod> failing', 'how many <name> pods running', 'summarize cluster health', 'is it safe to restart <dep>']" />
      </div>
    </div>

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
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

    /* Layout */
    .chat-layout {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 220px);
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
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
      width: 56px; height: 56px; border-radius: 16px;
      background: linear-gradient(135deg, var(--accent-subtle), rgba(168,85,247,0.1));
      display: flex; align-items: center; justify-content: center;
      font-size: 24px; color: var(--accent); margin-bottom: 16px;
    }
    .welcome h2 { font-size: 20px; font-weight: 700; margin: 0 0 8px; }
    .welcome p { font-size: 13px; color: var(--text-secondary); margin: 0 0 28px; max-width: 400px; }

    .suggestion-categories {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      width: 100%;
      max-width: 600px;
    }
    .sug-category {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .sug-cat-label {
      font-size: 10px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 2px;
    }
    .sug-cat-label i { font-size: 11px; }
    .sug-items { display: flex; flex-direction: column; gap: 4px; }
    .sug-btn {
      padding: 8px 12px;
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text-secondary);
      font-size: 12px;
      text-align: left;
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
    }
    .sug-btn:hover {
      border-color: var(--accent);
      color: var(--accent);
      background: var(--accent-subtle);
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
      width: 28px; height: 28px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; flex-shrink: 0;
    }
    .avatar-user { background: var(--accent); color: #fff; }
    .avatar-ai {
      background: linear-gradient(135deg, var(--accent), var(--purple));
      color: #fff;
      box-shadow: 0 0 10px rgba(59, 130, 246, 0.4);
    }

    .msg-bubble {
      max-width: 80%;
      padding: 14px 18px;
      border-radius: 18px;
      overflow: visible;
      box-shadow: var(--shadow);
      position: relative;
    }
    .copy-btn {
      position: absolute;
      top: 8px;
      right: 10px;
      width: 26px; height: 26px;
      border-radius: 6px;
      border: none;
      background: transparent;
      color: var(--text-muted);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      font-size: 12px;
      opacity: 0;
      transition: all 0.2s ease;
    }
    .msg-bubble:hover .copy-btn { opacity: 1; }
    .copy-btn:hover {
      background: var(--bg-elevated);
      color: var(--text);
    }
    .copy-btn.copied {
      opacity: 1;
      color: var(--success, #22c55e);
    }
    .bubble-user .copy-btn { color: rgba(255,255,255,0.6); }
    .bubble-user .copy-btn:hover { background: rgba(255,255,255,0.15); color: #fff; }
    .bubble-user .copy-btn.copied { color: #bbf7d0; }
    .bubble-user {
      background: var(--accent);
      color: #fff;
      border-bottom-right-radius: 4px;
    }
    .bubble-ai {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-bottom-left-radius: 4px;
      max-width: 90%;
      position: relative;
    }
    .bubble-ai::after {
      content: '';
      position: absolute;
      inset: -1px;
      border-radius: inherit;
      padding: 1px;
      background: linear-gradient(135deg, var(--accent-subtle), transparent 40%, transparent 60%, var(--success-subtle));
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      pointer-events: none;
    }
    .msg-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .msg-name { font-size: 10px; font-weight: 600; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.03em; }
    .msg-time { font-size: 9px; opacity: 0.5; }
    .msg-title {
      font-size: 14px;
      font-weight: 700;
      margin: 4px 0 8px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
    }
    .severity-badge {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .sev-critical { background: rgba(239,68,68,0.15); color: #ef4444; }
    .sev-warning { background: rgba(234,179,8,0.15); color: #eab308; }
    .sev-healthy { background: rgba(34,197,94,0.15); color: #22c55e; }
    .msg-content {
      font-size: 13px;
      line-height: 1.7;
      word-break: break-word;
    }
    .msg-content :is(.clr-red) { color: var(--danger, #ef4444); }
    .msg-content :is(.clr-green) { color: var(--success, #22c55e); }
    .msg-content :is(.clr-yellow) { color: var(--warning, #eab308); }
    .msg-content :is(.clr-cyan) { color: var(--accent, #06b6d4); font-family: 'JetBrains Mono', monospace; font-size: 12px; }
    .msg-content :is(.clr-dim) { opacity: 0.6; font-size: 12px; }
    .msg-options {
      display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px;
      padding-top: 10px; border-top: 1px solid var(--border);
    }
    .opt-btn {
      padding: 6px 12px; border-radius: 8px;
      background: var(--bg); border: 1px solid var(--accent);
      color: var(--accent); font-size: 11px;
      font-family: 'JetBrains Mono', monospace;
      cursor: pointer; transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
      white-space: nowrap; overflow: hidden;
      text-overflow: ellipsis; max-width: 100%;
    }
    .opt-btn:hover {
      background: var(--accent); color: #fff;
    }

    /* Follow-ups */
    .msg-followups {
      display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
      margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border);
    }
    .followup-label { font-size: 10px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; }
    .followup-btn {
      padding: 5px 10px; border-radius: 6px;
      background: var(--bg-elevated); border: 1px solid var(--border);
      color: var(--text-secondary); font-size: 11px;
      cursor: pointer; transition: all 0.2s;
    }
    .followup-btn:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-subtle); }

    /* Typing Indicator */
    .typing-indicator {
      display: flex;
      gap: 4px;
      padding: 4px 0;
    }
    .typing-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--text-muted);
      animation: typingBounce 1.4s infinite;
    }
    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes typingBounce {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
      30% { transform: translateY(-4px); opacity: 1; }
    }

    /* Input */
    .input-area {
      padding: 20px 24px;
      border-top: 1px solid var(--border);
      background: var(--bg-card);
    }
    .input-container {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .input-container input {
      flex: 1;
      padding: 14px 18px;
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: 14px;
      color: var(--text);
      font-size: 14px;
      outline: none;
      transition: all 0.2s ease;
    }
    .input-container input:focus {
      border-color: var(--accent);
      background: var(--bg-hover);
      box-shadow: 0 0 0 4px var(--accent-subtle);
    }
    .input-container input:focus { border-color: var(--accent); }
    .input-container input::placeholder { color: var(--text-muted); }
    .send-btn {
      width: 38px; height: 38px; border-radius: 10px;
      background: var(--accent); border: none; color: #fff;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1); font-size: 14px;
    }
    .send-btn:hover { background: var(--accent-hover); }
    .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .input-hint {
      display: block;
      font-size: 10px;
      color: var(--text-muted);
      margin-top: 6px;
      text-align: center;
    }
  `],
})
export class AiComponent implements AfterViewChecked, OnInit {
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

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['q']) {
        this.query = params['q'];
        this.ask();
      }
    });
  }

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
}
