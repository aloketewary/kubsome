import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

interface Message {
  role: 'user' | 'ai';
  text: string;
  options?: string[];
  originalQuery?: string;
}

@Component({
  selector: 'app-ai-float',
  standalone: true,
  imports: [FormsModule],
  template: `
    <!-- Floating trigger button -->
    @if (!open) {
      <button class="ai-fab" (click)="open = true" title="AI Assistant">
        <i class="pi pi-sparkles"></i>
      </button>
    }

    <!-- Chat panel -->
    @if (open) {
      <div class="ai-panel">
        <div class="panel-header">
          <span class="panel-title"><i class="pi pi-sparkles"></i> AI Assistant</span>
          <button class="panel-close" (click)="open = false"><i class="pi pi-minus"></i></button>
        </div>

        <div class="panel-messages">
          @for (msg of messages; track $index) {
            <div class="msg" [class.msg-user]="msg.role === 'user'" [class.msg-ai]="msg.role === 'ai'">
              <div class="msg-text">{{ msg.text }}</div>
              @if (msg.options && msg.options.length > 0) {
                <div class="msg-options">
                  @for (opt of msg.options; track opt) {
                    <button class="opt-btn" (click)="selectOption(opt, msg)">{{ opt }}</button>
                  }
                </div>
              }
            </div>
          }
          @if (loading) {
            <div class="msg msg-ai">
              <div class="msg-text"><i class="pi pi-spin pi-spinner"></i> Thinking...</div>
            </div>
          }
          @if (messages.length === 0 && !loading) {
            <div class="panel-empty">
              <p>Ask about your cluster:</p>
              <div class="suggestions">
                @for (s of suggestions; track s) {
                  <button class="suggestion" (click)="query = s; ask()">{{ s }}</button>
                }
              </div>
            </div>
          }
        </div>

        <div class="panel-input">
          <input [(ngModel)]="query" placeholder="Ask anything..."
                 (keyup.enter)="ask()" [disabled]="loading" />
          <button class="send-btn" (click)="ask()" [disabled]="!query.trim() || loading">
            <i class="pi pi-send"></i>
          </button>
        </div>
      </div>
    }
  `,
  styles: [`
    .ai-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: var(--accent);
      color: #fff;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4);
      transition: transform 0.2s, box-shadow 0.2s;
      z-index: 900;
    }
    .ai-fab:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 28px rgba(59, 130, 246, 0.5);
    }

    .ai-panel {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 380px;
      height: 480px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      box-shadow: 0 16px 60px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 900;
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      border-bottom: 1px solid var(--border);
    }
    .panel-title {
      font-size: 13px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .panel-title i { color: var(--accent); }
    .panel-close {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
    }
    .panel-close:hover { background: var(--bg-hover); color: var(--text); }

    .panel-messages {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .msg {
      max-width: 85%;
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 13px;
      line-height: 1.5;
      overflow: visible;
    }
    .msg-user {
      align-self: flex-end;
      background: var(--accent);
      color: #fff;
      border-bottom-right-radius: 4px;
    }
    .msg-ai {
      align-self: flex-start;
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-bottom-left-radius: 4px;
      max-width: 95%;
    }
    .msg-text { white-space: pre-wrap; }
    .msg-options {
      display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px;
      padding-top: 8px; border-top: 1px solid var(--border);
    }
    .opt-btn {
      padding: 6px 10px; border-radius: 6px;
      background: var(--bg); border: 1px solid var(--accent);
      color: var(--accent); font-size: 10px;
      font-family: 'JetBrains Mono', monospace;
      cursor: pointer; transition: all 0.12s;
      white-space: nowrap; overflow: hidden;
      text-overflow: ellipsis; max-width: 100%;
    }
    .opt-btn:hover {
      background: var(--accent); color: #fff;
    }

    .panel-empty {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: var(--text-muted);
      font-size: 13px;
    }
    .suggestions {
      display: flex;
      flex-direction: column;
      gap: 6px;
      width: 100%;
    }
    .suggestion {
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 12px;
      color: var(--text-secondary);
      cursor: pointer;
      text-align: left;
      transition: all 0.12s;
    }
    .suggestion:hover {
      border-color: var(--accent);
      color: var(--accent);
    }

    .panel-input {
      display: flex;
      gap: 8px;
      padding: 12px;
      border-top: 1px solid var(--border);
    }
    .panel-input input {
      flex: 1;
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 8px 12px;
      color: var(--text);
      font-size: 13px;
      outline: none;
    }
    .panel-input input:focus { border-color: var(--accent); }
    .send-btn {
      background: var(--accent);
      border: none;
      border-radius: 8px;
      color: #fff;
      width: 36px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 0.15s;
    }
    .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  `],
})
export class AiFloatComponent {
  private api = inject(ApiService);

  open = false;
  query = '';
  messages: Message[] = [];
  loading = false;

  suggestions = [
    'summarize cluster health',
    'which pods are unhealthy',
    'how many pods running',
    'what changed recently',
    'any anomalies detected',
  ];

  ask() {
    if (!this.query.trim() || this.loading) return;
    const q = this.query;
    this.messages.push({ role: 'user', text: q });
    this.query = '';
    this.loading = true;

    this.api.askAi(q).subscribe({
      next: (res: any) => {
        if (res.severity === 'clarify' && res.options) {
          this.messages.push({
            role: 'ai',
            text: res.answer,
            options: res.options,
            originalQuery: res.original_query || q,
          });
        } else {
          this.messages.push({ role: 'ai', text: res.answer || JSON.stringify(res) });
        }
        this.loading = false;
      },
      error: () => {
        this.messages.push({ role: 'ai', text: 'Error connecting to AI.' });
        this.loading = false;
      },
    });
  }

  selectOption(option: string, msg: Message) {
    msg.options = [];
    const original = msg.originalQuery || '';
    const skip = new Set(['why', 'is', 'how', 'many', 'pod', 'pods', 'the', 'my', 'failing', 'crashing', 'running', 'consuming', 'cpu', 'memory', 'more', 'check', 'diagnose', 'inspect', 'logs', 'for', 'of', 'healthy', 'status', 'what', 'wrong', 'with']);
    let replaced = false;
    const refined = original.split(' ').map(w => {
      if (!replaced && !skip.has(w.toLowerCase().replace('?', ''))) {
        replaced = true;
        return option;
      }
      return w;
    }).join(' ');
    this.query = replaced ? refined : `${original} ${option}`;
    this.ask();
  }
}
