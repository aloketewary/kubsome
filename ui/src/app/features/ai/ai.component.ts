import { Component, inject } from '@angular/core';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

interface Message {
  role: 'user' | 'ai';
  text: string;
}

@Component({
  selector: 'app-ai',
  standalone: true,
  imports: [InputTextModule, ButtonModule, FormsModule],
  template: `
    <div class="page-header">
      <h1>AI Assistant</h1>
      <p class="subtitle">Ask questions about your cluster</p>
    </div>

    <div class="chat-container">
      <div class="messages">
        @for (msg of messages; track $index) {
          <div class="msg" [class.msg-user]="msg.role === 'user'" [class.msg-ai]="msg.role === 'ai'">
            <div class="msg-label">{{ msg.role === 'user' ? 'You' : 'KubeEasy AI' }}</div>
            <div class="msg-text">{{ msg.text }}</div>
          </div>
        }
        @if (loading) {
          <div class="msg msg-ai">
            <div class="msg-label">KubeEasy AI</div>
            <div class="msg-text"><i class="pi pi-spin pi-spinner"></i> Analyzing...</div>
          </div>
        }
        @if (messages.length === 0 && !loading) {
          <div class="empty-chat">
            <i class="pi pi-sparkles"></i>
            <span>Ask me anything about your cluster</span>
          </div>
        }
      </div>

      <div class="input-row">
        <input pInputText [(ngModel)]="query" placeholder="e.g. why is payment-api failing?"
               (keyup.enter)="ask()" [disabled]="loading" />
        <button pButton icon="pi pi-send" (click)="ask()" [disabled]="!query.trim() || loading"></button>
      </div>
    </div>

    <div class="suggestions">
      @for (s of suggestions; track s) {
        <button pButton [label]="s" class="p-button-outlined p-button-sm p-button-secondary" (click)="query = s; ask()"></button>
      }
    </div>
  `,
  styles: [`
    .page-header { margin-bottom: 24px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .chat-container {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 20px;
    }
    .messages {
      max-height: 450px;
      overflow-y: auto;
      margin-bottom: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .msg {
      padding: 12px 16px;
      border-radius: 10px;
      max-width: 80%;
    }
    .msg-user {
      align-self: flex-end;
      background: var(--accent);
      color: #fff;
    }
    .msg-ai {
      align-self: flex-start;
      background: var(--bg-elevated);
      color: var(--text);
      border: 1px solid var(--border);
    }
    .msg-label {
      font-size: 10px;
      font-weight: 600;
      opacity: 0.6;
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .msg-text {
      font-size: 13px;
      line-height: 1.6;
      white-space: pre-wrap;
    }
    .empty-chat {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 48px;
      color: var(--text-muted);
      font-size: 13px;
    }
    .empty-chat i { font-size: 24px; }
    .input-row {
      display: flex;
      gap: 8px;
    }
    .input-row input { flex: 1; }
    .suggestions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 12px;
    }
  `],
})
export class AiComponent {
  private api = inject(ApiService);
  query = '';
  messages: Message[] = [];
  loading = false;

  suggestions = [
    'why is payment-api failing',
    'summarize cluster health',
    'which pods are unhealthy',
    'what changed recently',
  ];

  ask() {
    if (!this.query.trim() || this.loading) return;
    const q = this.query;
    this.messages.push({ role: 'user', text: q });
    this.query = '';
    this.loading = true;

    this.api.askAi(q).subscribe({
      next: (res) => {
        const text = res.answer || res.summary || JSON.stringify(res, null, 2);
        this.messages.push({ role: 'ai', text });
        this.loading = false;
      },
      error: () => {
        this.messages.push({ role: 'ai', text: 'Error: could not get response.' });
        this.loading = false;
      },
    });
  }
}
