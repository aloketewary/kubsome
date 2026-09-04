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
    <section class="ai-page" aria-label="AI Assistant">
      <app-intel-header title="AI Assistant" icon="pi pi-sparkles"
        subtitle="Natural language cluster intelligence">
        @if (messages.length > 0) {
          <button class="ctrl-btn ctrl-btn-wide" type="button" (click)="clearHistory()" aria-label="Clear conversation" pTooltip="Clear">
            <i class="pi pi-trash" aria-hidden="true"></i> Clear
          </button>
        }
      </app-intel-header>

      <div class="ai-overview" aria-label="AI session overview">
        <div class="ai-deck">
          <span class="deck-kicker"><i class="pi pi-sparkles" aria-hidden="true"></i> Cluster intelligence</span>
          <h2>Ask questions in operator language.</h2>
          <p>Diagnose failures, summarize health, and investigate changes with context from your active cluster.</p>
        </div>
        <div class="ai-readout">
          <span class="readout-kicker">Session state</span>
          <strong>{{ loading ? 'Processing request' : messages.length ? 'Conversation active' : 'Ready for a query' }}</strong>
          <div class="readout-meta">
            <span><i class="pi pi-comments" aria-hidden="true"></i> {{ messages.length }} messages</span>
            <span><i class="pi pi-keyboard" aria-hidden="true"></i> Enter to send</span>
          </div>
        </div>
      </div>

      <main class="chat-layout">
        <div class="messages-area" #messagesEl role="log" aria-live="polite" aria-label="AI conversation">
          @if (messages.length === 0 && !loading) {
            <div class="welcome">
              <div class="welcome-icon"><i class="pi pi-sparkles" aria-hidden="true"></i></div>
              <span class="welcome-kicker">Operator assistant</span>
              <h3>What can I help you with?</h3>
              <p>I can analyze your cluster, diagnose issues, and explain Kubernetes concepts.</p>

              <div class="suggestion-categories" aria-label="Suggested queries">
                <div class="sug-category">
                  <span class="sug-cat-label"><i class="pi pi-exclamation-triangle" aria-hidden="true"></i> Diagnose</span>
                  <div class="sug-items">
                    @for (s of diagnoseSuggestions; track s) {
                      <button class="sug-btn" type="button" (click)="query = s; ask()">{{ s }}</button>
                    }
                  </div>
                </div>
                <div class="sug-category">
                  <span class="sug-cat-label"><i class="pi pi-chart-bar" aria-hidden="true"></i> Analyze</span>
                  <div class="sug-items">
                    @for (s of analyzeSuggestions; track s) {
                      <button class="sug-btn" type="button" (click)="query = s; ask()">{{ s }}</button>
                    }
                  </div>
                </div>
                <div class="sug-category">
                  <span class="sug-cat-label"><i class="pi pi-history" aria-hidden="true"></i> Investigate</span>
                  <div class="sug-items">
                    @for (s of investigateSuggestions; track s) {
                      <button class="sug-btn" type="button" (click)="query = s; ask()">{{ s }}</button>
                    }
                  </div>
                </div>
              </div>
            </div>
          }

          @for (msg of messages; track $index) {
            <div class="msg-row" [class.msg-row-user]="msg.role === 'user'">
              <div class="msg-avatar" [class]="'avatar-' + msg.role" aria-hidden="true">
                <i class="pi" [class]="msg.role === 'user' ? 'pi-user' : 'pi-sparkles'"></i>
              </div>
              <div class="msg-bubble" [class]="'bubble-' + msg.role">
                <button class="copy-btn" type="button" [class.copied]="msg.copied" (click)="copyMessage(msg)" [attr.aria-label]="msg.copied ? 'Copied response' : 'Copy response'" [pTooltip]="msg.copied ? 'Copied!' : 'Copy'" tooltipPosition="top">
                  <i class="pi" [class]="msg.copied ? 'pi-check' : 'pi-copy'" aria-hidden="true"></i>
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
                  <div class="msg-options" aria-label="Clarification options">
                    @for (opt of msg.options; track opt) {
                      <button class="opt-btn" type="button" (click)="selectOption(opt, msg)">{{ opt }}</button>
                    }
                  </div>
                }
                @if (msg.followUps && msg.followUps.length > 0) {
                  <div class="msg-followups" aria-label="Follow-up queries">
                    <span class="followup-label">Follow up:</span>
                    @for (fu of msg.followUps; track fu) {
                      <button class="followup-btn" type="button" (click)="query = fu; ask()">{{ fu }}</button>
                    }
                  </div>
                }
              </div>
            </div>
          }

          @if (loading) {
            <div class="msg-row" role="status" aria-label="AI is processing">
              <div class="msg-avatar avatar-ai" aria-hidden="true"><i class="pi pi-sparkles"></i></div>
              <div class="msg-bubble bubble-ai">
                <div class="typing-indicator" aria-hidden="true">
                  <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
                </div>
              </div>
            </div>
          }
        </div>

        <div class="input-area">
          <div class="input-label"><span>Query console</span><span>Cluster context enabled</span></div>
          <div class="input-container">
            <label class="sr-only" for="ai-query">Ask about your cluster</label>
            <input id="ai-query" [(ngModel)]="query" placeholder="Ask about your cluster..."
                   (keyup.enter)="ask()" [disabled]="loading" />
            <button class="send-btn" type="button" (click)="ask()" [disabled]="!query.trim() || loading" aria-label="Send query">
              <i class="pi pi-send" aria-hidden="true"></i>
            </button>
          </div>
          <span class="input-hint">Press Enter to send · Try "why is X failing" or "summarize health"</span>
        </div>
      </main>
    </section>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .ai-page {
      max-width: 1520px;
      margin: 0 auto;
      padding: 0 22px 30px;
    }

    .ctrl-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 30px;
      gap: 6px;
      padding: 0 10px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      background: var(--surface-elevated);
      cursor: pointer;
      font: 10px var(--font-mono);
      letter-spacing: 0.05em;
      text-transform: uppercase;
      transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease, transform 0.15s ease;
    }

    .ctrl-btn-wide {
      color: var(--surface-card);
      background: var(--accent);
      border-color: var(--accent);
      font-weight: 700;
    }

    .ctrl-btn:hover,
    .ctrl-btn:focus-visible {
      border-color: var(--info);
      color: var(--info);
      outline: none;
    }

    .ctrl-btn-wide:hover,
    .ctrl-btn-wide:focus-visible {
      color: var(--surface-card);
      background: var(--info);
      border-color: var(--info);
    }

    .ctrl-btn:active,
    .send-btn:active,
    .sug-btn:active,
    .opt-btn:active,
    .followup-btn:active {
      transform: translateY(1px);
    }

    .ai-overview {
      display: grid;
      grid-template-columns: minmax(0, 1.5fr) minmax(280px, 0.8fr);
      gap: 1px;
      margin-top: 18px;
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--border);
    }

    .ai-deck,
    .ai-readout {
      min-width: 0;
      background: var(--surface-card);
    }

    .ai-deck {
      position: relative;
      padding: 24px 30px 21px;
      background:
        linear-gradient(120deg, rgba(139, 92, 246, 0.08), transparent 47%),
        var(--surface-card);
    }

    .ai-deck::after {
      position: absolute;
      right: 24px;
      bottom: 19px;
      width: 105px;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--info));
      content: '';
      opacity: 0.7;
    }

    .deck-kicker,
    .readout-kicker,
    .welcome-kicker {
      display: block;
      color: var(--info);
      font-size: 9px;
      font-family: var(--font-mono);
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    .deck-kicker i {
      margin-right: 6px;
    }

    .ai-deck h2 {
      max-width: 650px;
      margin: 11px 0 8px;
      color: var(--text);
      font-size: clamp(23px, 3vw, 37px);
      font-weight: 600;
      letter-spacing: -0.045em;
      line-height: 1.04;
    }

    .ai-deck p {
      max-width: 620px;
      margin: 0;
      color: var(--text-secondary);
      font-size: 12px;
      line-height: 1.6;
    }

    .ai-readout {
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-height: 150px;
      padding: 22px 24px;
      background: var(--surface-elevated);
    }

    .ai-readout > strong {
      margin-top: 8px;
      color: var(--text);
      font-size: 14px;
      font-weight: 600;
    }

    .readout-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 14px;
      margin-top: 20px;
      padding-top: 12px;
      border-top: 1px solid var(--border-subtle);
      color: var(--text-muted);
      font-size: 10px;
      font-family: var(--font-mono);
    }

    .readout-meta span {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .readout-meta i {
      color: var(--accent);
    }

    .chat-layout {
      display: flex;
      height: clamp(560px, calc(100dvh - 330px), 780px);
      min-height: 560px;
      flex-direction: column;
      margin-top: 14px;
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface-card);
    }

    .messages-area {
      display: flex;
      flex: 1 1 auto;
      min-height: 0;
      flex-direction: column;
      gap: 16px;
      overflow-y: auto;
      padding: 24px;
      background:
        linear-gradient(rgba(127, 145, 160, 0.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(127, 145, 160, 0.025) 1px, transparent 1px),
        var(--surface-card);
      background-size: 28px 28px;
    }

    .welcome {
      display: flex;
      max-width: 760px;
      flex-direction: column;
      align-items: center;
      margin: auto;
      padding: 22px 20px;
      text-align: center;
    }

    .welcome-icon {
      display: grid;
      place-items: center;
      width: 52px;
      height: 52px;
      margin-bottom: 14px;
      border: 1px solid color-mix(in srgb, var(--info) 35%, var(--border));
      border-radius: var(--radius);
      color: var(--info);
      background: color-mix(in srgb, var(--info) 8%, var(--surface-elevated));
      font-size: 20px;
    }

    .welcome-kicker {
      margin-bottom: 8px;
    }

    .welcome h3 {
      margin: 0 0 8px;
      color: var(--text);
      font-size: 18px;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    .welcome p {
      max-width: 430px;
      margin: 0 0 24px;
      color: var(--text-muted);
      font-size: 12px;
      line-height: 1.6;
    }

    .suggestion-categories {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      width: 100%;
      max-width: 760px;
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface-elevated);
      text-align: left;
    }

    .sug-category {
      display: flex;
      min-width: 0;
      flex-direction: column;
      gap: 5px;
      padding: 13px;
      border-right: 1px solid var(--border-subtle);
    }

    .sug-category:last-child {
      border-right: 0;
    }

    .sug-cat-label {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
      color: var(--text-muted);
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .sug-cat-label i {
      color: var(--accent);
      font-size: 10px;
    }

    .sug-items {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .sug-btn {
      padding: 7px 8px;
      border: 1px solid transparent;
      border-bottom-color: var(--border-subtle);
      color: var(--text-secondary);
      background: transparent;
      cursor: pointer;
      font: 10px var(--font-sans);
      line-height: 1.35;
      text-align: left;
      transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease, transform 0.15s ease;
    }

    .sug-btn:last-child {
      border-bottom-color: transparent;
    }

    .sug-btn:hover,
    .sug-btn:focus-visible {
      border-color: color-mix(in srgb, var(--info) 30%, var(--border));
      color: var(--info);
      background: color-mix(in srgb, var(--info) 5%, var(--surface-card));
      outline: none;
    }

    .msg-row {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      width: min(100%, 940px);
      margin: 0 auto;
    }

    .msg-row-user {
      flex-direction: row-reverse;
    }

    .msg-avatar {
      display: grid;
      place-items: center;
      width: 26px;
      height: 26px;
      flex: 0 0 26px;
      border: 1px solid var(--border);
      border-radius: 50%;
      color: var(--accent);
      background: var(--surface-elevated);
      font-size: 10px;
    }

    .bubble-user .msg-avatar,
    .avatar-user {
      color: var(--accent);
    }

    .msg-bubble {
      position: relative;
      max-width: min(86%, 760px);
      min-width: 0;
      padding: 13px 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface-elevated);
    }

    .bubble-user {
      border-color: color-mix(in srgb, var(--accent) 32%, var(--border));
      background: color-mix(in srgb, var(--accent) 5%, var(--surface-card));
    }

    .bubble-ai {
      border-left: 2px solid var(--info);
    }

    .copy-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      display: grid;
      place-items: center;
      width: 24px;
      height: 24px;
      border: 1px solid transparent;
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      background: transparent;
      cursor: pointer;
      font-size: 10px;
      opacity: 0;
      transition: opacity 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }

    .msg-bubble:hover .copy-btn,
    .copy-btn:focus-visible,
    .copy-btn.copied {
      opacity: 1;
    }

    .copy-btn:hover,
    .copy-btn:focus-visible {
      border-color: var(--border);
      color: var(--info);
      outline: none;
    }

    .copy-btn.copied {
      color: var(--success);
    }

    .msg-header {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 6px;
      padding-right: 26px;
    }

    .msg-name {
      color: var(--text-muted);
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .msg-time {
      color: var(--text-muted);
      font-size: 9px;
      font-family: var(--font-mono);
      opacity: 0.65;
    }

    .msg-title {
      margin: 5px 0 9px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border-subtle);
      color: var(--text);
      font-size: 13px;
      font-weight: 600;
    }

    .severity-badge {
      padding: 2px 6px;
      border: 1px solid;
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .sev-critical { border-color: color-mix(in srgb, var(--danger) 35%, transparent); color: var(--danger); }
    .sev-warning { border-color: color-mix(in srgb, var(--warning) 35%, transparent); color: var(--warning); }
    .sev-healthy { border-color: color-mix(in srgb, var(--success) 35%, transparent); color: var(--success); }

    .msg-content {
      color: var(--text-secondary);
      font-size: 12px;
      line-height: 1.7;
      overflow-wrap: anywhere;
    }

    .msg-content :is(.clr-red) { color: var(--danger); }
    .msg-content :is(.clr-green) { color: var(--success); }
    .msg-content :is(.clr-yellow) { color: var(--warning); }
    .msg-content :is(.clr-cyan) { color: var(--accent); font-family: var(--font-mono); font-size: 11px; }
    .msg-content :is(.clr-dim) { opacity: 0.55; font-size: 11px; }

    .msg-options,
    .msg-followups {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 5px;
      margin-top: 11px;
      padding-top: 10px;
      border-top: 1px solid var(--border-subtle);
    }

    .followup-label {
      color: var(--text-muted);
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
    }

    .opt-btn,
    .followup-btn {
      max-width: 100%;
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      cursor: pointer;
      text-overflow: ellipsis;
      white-space: nowrap;
      transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease, transform 0.15s ease;
    }

    .opt-btn {
      padding: 5px 9px;
      color: var(--accent);
      background: transparent;
      font: 10px var(--font-mono);
    }

    .followup-btn {
      padding: 4px 8px;
      color: var(--text-muted);
      background: transparent;
      font: 10px var(--font-sans);
    }

    .opt-btn:hover,
    .opt-btn:focus-visible,
    .followup-btn:hover,
    .followup-btn:focus-visible {
      border-color: var(--info);
      color: var(--info);
      background: color-mix(in srgb, var(--info) 5%, var(--surface-card));
      outline: none;
    }

    .typing-indicator {
      display: flex;
      gap: 4px;
      padding: 3px 0;
    }

    .typing-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--info);
      animation: typingBounce 1.4s infinite;
    }

    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }

    @keyframes typingBounce {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.3; }
      30% { transform: translateY(-3px); opacity: 1; }
    }

    .input-area {
      flex: 0 0 auto;
      padding: 14px 20px 16px;
      border-top: 1px solid var(--border);
      background: var(--surface-elevated);
    }

    .input-label {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 7px;
      color: var(--text-muted);
      font-size: 9px;
      font-family: var(--font-mono);
      letter-spacing: 0.07em;
      text-transform: uppercase;
    }

    .input-label span:last-child {
      color: var(--success);
    }

    .input-container {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .input-container input {
      min-width: 0;
      flex: 1 1 auto;
      padding: 11px 13px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text);
      background: var(--surface-card) !important;
      outline: none;
      font-size: 12px;
      font-family: var(--font-mono);
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .input-container input:focus {
      border-color: var(--info) !important;
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--info) 18%, transparent) !important;
    }

    .input-container input::placeholder {
      color: var(--text-muted);
      opacity: 0.75;
    }

    .send-btn {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      flex: 0 0 36px;
      border: 1px solid var(--accent);
      border-radius: var(--radius-sm);
      color: var(--accent);
      background: transparent;
      cursor: pointer;
      font-size: 13px;
      transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease, transform 0.15s ease;
    }

    .send-btn:hover,
    .send-btn:focus-visible {
      color: var(--surface-card);
      background: var(--accent);
      outline: none;
    }

    .send-btn:disabled {
      cursor: not-allowed;
      opacity: 0.35;
    }

    .input-hint {
      display: block;
      margin-top: 7px;
      color: var(--text-muted);
      font-size: 9px;
      text-align: center;
      opacity: 0.7;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    @media (max-width: 900px) {
      .ai-overview {
        grid-template-columns: 1fr;
      }

      .ai-readout {
        min-height: 0;
      }

      .chat-layout {
        height: clamp(540px, calc(100dvh - 390px), 700px);
        min-height: 540px;
      }
    }

    @media (max-width: 768px) {
      .ai-page {
        padding-right: 15px;
        padding-left: 15px;
      }

      .ai-deck {
        padding: 22px;
      }

      .ai-deck h2 {
        font-size: clamp(23px, 7vw, 32px);
      }

      .ai-readout {
        padding: 18px 22px;
      }

      .suggestion-categories {
        grid-template-columns: 1fr;
      }

      .sug-category {
        border-right: 0;
        border-bottom: 1px solid var(--border-subtle);
      }

      .sug-category:last-child {
        border-bottom: 0;
      }

      .messages-area {
        padding: 18px 14px;
      }

      .msg-bubble {
        max-width: 90%;
      }
    }

    @media (max-width: 640px) {
      .ai-deck,
      .ai-readout {
        padding: 18px;
      }

      .chat-layout {
        min-height: 500px;
        height: 68dvh;
      }

      .input-area {
        padding: 12px 13px 14px;
      }

      .input-label {
        align-items: flex-start;
        flex-direction: column;
        gap: 4px;
      }

      .input-hint {
        text-align: left;
      }

      .msg-row {
        width: 100%;
      }

      .msg-bubble {
        max-width: calc(100% - 36px);
        padding: 12px 13px;
      }
    }

    @media (max-width: 520px) {
      .readout-meta {
        display: grid;
        gap: 8px;
      }

      .welcome {
        padding: 14px 4px;
      }

      .chat-layout {
        min-height: 470px;
        height: 66dvh;
      }
    }

    :host-context([data-theme='light']) {
      .ai-deck {
        background:
          linear-gradient(120deg, rgba(20, 116, 143, 0.07), transparent 47%),
          var(--surface-card);
      }

      .messages-area {
        background:
          linear-gradient(rgba(44, 62, 80, 0.035) 1px, transparent 1px),
          linear-gradient(90deg, rgba(44, 62, 80, 0.035) 1px, transparent 1px),
          var(--surface-card);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        scroll-behavior: auto !important;
        transition-duration: 0.01ms !important;
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
      }
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
