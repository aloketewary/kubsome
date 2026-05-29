import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface CommandPill {
  label: string;
  value: string;
  count?: number;
  color?: 'cyan' | 'green' | 'amber' | 'red' | 'purple' | 'default';
}

@Component({
  selector: 'app-command-bar',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="cb">
      <div class="cb-pills">
        @for (pill of pills; track pill.value) {
          <button class="cb-pill" [class.cb-on]="activePill === pill.value"
                  [attr.data-color]="pill.color || 'default'"
                  (click)="pillChange.emit(pill.value)">
            @if (pill.color && pill.color !== 'default') {
              <span class="cb-dot" [attr.data-color]="pill.color"></span>
            }
            <span class="cb-pill-lbl">{{ pill.label }}</span>
            @if (pill.count !== undefined) {
              <span class="cb-pill-num">{{ pill.count }}</span>
            }
          </button>
        }
      </div>
      <div class="cb-right">
        <ng-content />
        @if (showSearch) {
          <div class="cb-search">
            <svg class="cb-search-ico" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <input [ngModel]="search" (ngModelChange)="onSearchInput($event)" [placeholder]="placeholder" />
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .cb {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 8px 12px;
      background: linear-gradient(180deg, transparent 0%, transparent 100%);
      border: 1px solid rgba(94, 84, 75, 0.08);
      border-radius: 10px;
      margin-bottom: 12px;
    }
    .cb-pills { display: flex; gap: 3px; flex-wrap: wrap; }

    .cb-pill {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 5px 10px;
      border-radius: 6px;
      border: 1px solid rgba(94, 84, 75, 0.12);
      background: rgba(94, 84, 75, 0.04);
      color: rgba(255, 255, 255, 0.5);
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.12s;
    }
    /* Inactive tinted states — subtle color hint when not selected */
    .cb-pill[data-color="cyan"] { border-color: rgba(208, 156, 96, 0.08); color: rgba(208, 156, 96, 0.5); }
    .cb-pill[data-color="green"] { border-color: rgba(74, 222, 128, 0.08); color: rgba(74, 222, 128, 0.5); }
    .cb-pill[data-color="amber"] { border-color: rgba(245, 158, 11, 0.08); color: rgba(245, 158, 11, 0.5); }
    .cb-pill[data-color="red"] { border-color: rgba(244, 63, 94, 0.08); color: rgba(244, 63, 94, 0.5); }
    .cb-pill[data-color="purple"] { border-color: rgba(167, 139, 250, 0.08); color: rgba(167, 139, 250, 0.5); }

    .cb-pill:hover {
      background: rgba(94, 84, 75, 0.08);
      color: rgba(245, 240, 235, 0.8);
    }
    .cb-pill[data-color="cyan"]:hover { background: rgba(208, 156, 96, 0.04); color: rgba(208, 156, 96, 0.75); }
    .cb-pill[data-color="green"]:hover { background: rgba(74, 222, 128, 0.04); color: rgba(74, 222, 128, 0.75); }
    .cb-pill[data-color="amber"]:hover { background: rgba(245, 158, 11, 0.04); color: rgba(245, 158, 11, 0.75); }
    .cb-pill[data-color="red"]:hover { background: rgba(244, 63, 94, 0.04); color: rgba(244, 63, 94, 0.75); }
    .cb-pill[data-color="purple"]:hover { background: rgba(167, 139, 250, 0.04); color: rgba(167, 139, 250, 0.75); }

    /* Active states by color */
    .cb-pill.cb-on {
      background: rgba(208, 156, 96, 0.08);
      border-color: rgba(208, 156, 96, 0.2);
      color: #d09c60;
    }
    .cb-pill.cb-on[data-color="amber"] {
      background: rgba(245, 158, 11, 0.08);
      border-color: rgba(245, 158, 11, 0.2);
      color: #f59e0b;
    }
    .cb-pill.cb-on[data-color="red"] {
      background: rgba(244, 63, 94, 0.08);
      border-color: rgba(244, 63, 94, 0.2);
      color: #f43f5e;
    }
    .cb-pill.cb-on[data-color="green"] {
      background: rgba(74, 222, 128, 0.08);
      border-color: rgba(74, 222, 128, 0.2);
      color: #4ade80;
    }
    .cb-pill.cb-on[data-color="purple"] {
      background: rgba(167, 139, 250, 0.08);
      border-color: rgba(167, 139, 250, 0.2);
      color: #a78bfa;
    }

    .cb-pill-num {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      font-size: 10px;
    }

    .cb-dot {
      width: 5px; height: 5px; border-radius: 50%;
      flex-shrink: 0;
    }
    .cb-dot[data-color="cyan"] { background: #d09c60; box-shadow: 0 0 4px rgba(208, 156, 96, 0.4); }
    .cb-dot[data-color="green"] { background: #4ade80; box-shadow: 0 0 4px rgba(74, 222, 128, 0.4); }
    .cb-dot[data-color="amber"] { background: #f59e0b; box-shadow: 0 0 4px rgba(245, 158, 11, 0.4); }
    .cb-dot[data-color="red"] { background: #f43f5e; box-shadow: 0 0 4px rgba(244, 63, 94, 0.4); }
    .cb-dot[data-color="purple"] { background: #a78bfa; box-shadow: 0 0 4px rgba(167, 139, 250, 0.4); }

    .cb-right { display: flex; align-items: center; gap: 6px; }

    .cb-search {
      position: relative;
      display: flex;
      align-items: center;
    }
    .cb-search-ico {
      position: absolute;
      left: 9px;
      color: rgba(168, 158, 148, 0.35);
      pointer-events: none;
    }
    .cb-search input {
      padding: 6px 10px 6px 28px;
      width: 160px;
      background: rgba(94, 84, 75, 0.04);
      border: 1px solid rgba(94, 84, 75, 0.1);
      border-radius: 6px;
      color: var(--text);
      font-size: 11px;
      outline: none;
      transition: all 0.15s;
      font-family: 'Inter', sans-serif;
    }
    .cb-search input::placeholder { color: rgba(94, 84, 75, 0.2); }
    .cb-search input:focus {
      border-color: rgba(208, 156, 96, 0.3);
      background: rgba(208, 156, 96, 0.02);
      box-shadow: 0 0 8px -2px rgba(208, 156, 96, 0.15);
    }

    @media (max-width: 768px) {
      .cb { flex-direction: column; align-items: stretch; }
      .cb-right { justify-content: flex-end; }
    }

    /* Light Mode */
    :host-context([data-theme="light"]) .cb { border-color: rgba(0,0,0,0.05); background: transparent; }
    :host-context([data-theme="light"]) .pill { color: rgba(0,0,0,0.5); }
    :host-context([data-theme="light"]) .pill:hover { background: rgba(0,0,0,0.03); color: rgba(0,0,0,0.75); }
    :host-context([data-theme="light"]) .pill-active { background: rgba(154,81,41,0.06); color: #9a5129; }
    :host-context([data-theme="light"]) .pill-count { background: rgba(0,0,0,0.04); color: rgba(0,0,0,0.5); }
    :host-context([data-theme="light"]) .cb-search { border-color: rgba(0,0,0,0.06); background: transparent; color: var(--text); }
    :host-context([data-theme="light"]) .cb-search:focus { border-color: rgba(154,81,41,0.25); }
    :host-context([data-theme="light"]) .cb-search-icon { color: rgba(0,0,0,0.3); }
  `],
})
export class CommandBarComponent {
  @Input() pills: CommandPill[] = [];
  @Input() activePill = '';
  @Input() search = '';
  @Input() placeholder = 'Search...';
  @Input() showSearch = true;
  @Output() pillChange = new EventEmitter<string>();
  @Output() searchChange = new EventEmitter<string>();

  onSearchInput(value: string) {
    this.search = value;
    this.searchChange.emit(value);
  }
}
