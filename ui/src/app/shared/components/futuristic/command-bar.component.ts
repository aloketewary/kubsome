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
    <div class="cb" role="search">
      <div class="cb-pills" role="group" aria-label="Filter results">
        @for (pill of pills; track pill.value) {
          <button class="cb-pill" type="button" [class.cb-on]="activePill === pill.value"
            [attr.data-color]="pill.color || 'default'" [attr.aria-pressed]="activePill === pill.value"
            (click)="pillChange.emit(pill.value)">
            @if (pill.color && pill.color !== 'default') { <span class="cb-dot" [attr.data-color]="pill.color" aria-hidden="true"></span> }
            <span class="cb-pill-lbl">{{ pill.label }}</span>
            @if (pill.count !== undefined) { <span class="cb-pill-num">{{ pill.count }}</span> }
          </button>
        }
      </div>
      <div class="cb-right">
        <ng-content />
        @if (showSearch) {
          <label class="cb-search">
            <span class="sr-only">{{ placeholder }}</span>
            <svg class="cb-search-ico" aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <input [ngModel]="search" (ngModelChange)="onSearchInput($event)" [placeholder]="placeholder" [attr.aria-label]="placeholder" />
          </label>
        }
      </div>
    </div>
  `,
  styles: [`
    .cb {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-height: 48px;
      margin-bottom: 14px;
      padding: 7px 10px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
    }

    .cb-pills { display: flex; flex-wrap: wrap; gap: 4px; }

    .cb-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 30px;
      padding: 5px 9px;
      border: 1px solid transparent;
      border-radius: 6px;
      background: transparent;
      color: var(--text-muted);
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
    }

    .cb-pill:hover {
      border-color: var(--border-strong);
      background: var(--surface-hover);
      color: var(--text);
    }

    .cb-pill.cb-on {
      border-color: rgba(var(--accent-rgb), 0.42);
      background: var(--accent-subtle);
      color: var(--accent);
    }

    .cb-pill[data-color="green"].cb-on { border-color: rgba(var(--success-rgb), 0.4); background: var(--success-subtle); color: var(--success); }
    .cb-pill[data-color="amber"].cb-on { border-color: rgba(var(--warning-rgb), 0.4); background: var(--warning-subtle); color: var(--warning); }
    .cb-pill[data-color="red"].cb-on { border-color: rgba(var(--danger-rgb), 0.4); background: var(--danger-subtle); color: var(--danger); }

    .cb-pill-num {
      color: currentColor;
      font-family: var(--font-mono);
      font-size: 10px;
      opacity: 0.8;
    }

    .cb-dot {
      width: 6px;
      height: 6px;
      flex: 0 0 6px;
      border-radius: 50%;
      background: var(--text-muted);
    }

    .cb-dot[data-color="cyan"] { background: var(--info); }
    .cb-dot[data-color="green"] { background: var(--success); }
    .cb-dot[data-color="amber"] { background: var(--warning); }
    .cb-dot[data-color="red"] { background: var(--danger); }
    .cb-dot[data-color="purple"] { background: var(--purple); }

    .cb-right { display: flex; align-items: center; gap: 6px; }

    .cb-search {
      position: relative;
      display: flex;
      align-items: center;
    }

    .cb-search-ico {
      position: absolute;
      left: 10px;
      color: var(--text-muted);
      pointer-events: none;
    }

    .cb-search input {
      width: 190px;
      min-height: 32px;
      padding: 6px 10px 6px 30px;
      border: 1px solid var(--border-strong);
      border-radius: 6px;
      outline: none;
      background: var(--surface-elevated);
      color: var(--text);
      font-family: var(--font-sans);
      font-size: 11px;
      transition: border-color 120ms ease, background 120ms ease;
    }

    .cb-search input::placeholder { color: var(--text-muted); }
    .cb-search input:focus { border-color: var(--accent); background: var(--surface-hover); }

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

    @media (max-width: 768px) {
      .cb { align-items: stretch; flex-direction: column; }
      .cb-right { justify-content: stretch; }
      .cb-search,
      .cb-search input { width: 100%; }
    }
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
