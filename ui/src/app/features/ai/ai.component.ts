import { Component, inject, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

interface Message {
  role: 'user' | 'ai';
  text: string;
  time: string;
  options?: string[];
  originalQuery?: string;
}

@Component({
  selector: 'app-ai',
  standalone: true,
  imports: [ButtonModule, TooltipModule, FormsModule],
  template: `
    <div class="page-header">
      <div>
        <h1>AI Assistant</h1>
        <p class="subtitle">Natural language cluster intelligence</p>
      </div>
      @if (messages.length > 0) {
        <button pButton icon="pi pi-trash" label="Clear" class="p-button-text p-button-sm" (click)="clearHistory()" pTooltip="Clear conversation"></button>
      }
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
              <div class="msg-header">
                <span class="msg-name">{{ msg.role === 'user' ? 'You' : 'Kubsome AI' }}</span>
                <span class="msg-time">{{ msg.time }}</span>
              </div>
              <div class="msg-content">{{ msg.text }}</div>
              @if (msg.options && msg.options.length > 0) {
                <div class="msg-options">
                  @for (opt of msg.options; track opt) {
                    <button class="opt-btn" (click)="selectOption(opt, msg)">{{ opt }}</button>
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
      transition: all 0.12s;
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
    .avatar-ai { background: linear-gradient(135deg, var(--accent-subtle), rgba(168,85,247,0.15)); color: var(--accent); }

    .msg-bubble {
      max-width: 80%;
      padding: 10px 14px;
      border-radius: 12px;
      overflow: visible;
    }
    .bubble-user {
      background: var(--accent);
      color: #fff;
      border-bottom-right-radius: 4px;
    }
    .bubble-ai {
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-bottom-left-radius: 4px;
      max-width: 90%;
    }
    .msg-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .msg-name { font-size: 10px; font-weight: 600; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.03em; }
    .msg-time { font-size: 9px; opacity: 0.5; }
    .msg-content {
      font-size: 13px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .msg-options {
      display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px;
      padding-top: 10px; border-top: 1px solid var(--border);
    }
    .opt-btn {
      padding: 6px 12px; border-radius: 8px;
      background: var(--bg); border: 1px solid var(--accent);
      color: var(--accent); font-size: 11px;
      font-family: 'JetBrains Mono', monospace;
      cursor: pointer; transition: all 0.12s;
      white-space: nowrap; overflow: hidden;
      text-overflow: ellipsis; max-width: 100%;
    }
    .opt-btn:hover {
      background: var(--accent); color: #fff;
    }

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
      padding: 12px 16px;
      border-top: 1px solid var(--border);
      background: var(--bg-elevated);
    }
    .input-container {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .input-container input {
      flex: 1;
      padding: 10px 14px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 10px;
      color: var(--text);
      font-size: 13px;
      outline: none;
      transition: border-color 0.15s;
    }
    .input-container input:focus { border-color: var(--accent); }
    .input-container input::placeholder { color: var(--text-muted); }
    .send-btn {
      width: 38px; height: 38px; border-radius: 10px;
      background: var(--accent); border: none; color: #fff;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: all 0.12s; font-size: 14px;
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
export class AiComponent implements AfterViewChecked {
  private api = inject(ApiService);
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
          this.messages.push({ role: 'ai', text, time: this.now() });
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
    const skip = new Set(['why', 'is', 'how', 'many', 'pod', 'pods', 'the', 'my', 'failing', 'crashing', 'running', 'consuming', 'cpu', 'memory', 'more', 'check', 'diagnose', 'inspect', 'logs', 'for', 'of', 'healthy', 'status', 'what', 'wrong', 'with']);
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

  private scrollToBottom() {
    const el = this.messagesEl?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  private now(): string {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
