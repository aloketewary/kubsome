import { Component, Input, Output, EventEmitter } from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-action-icon',
  standalone: true,
  imports: [TooltipModule],
  template: `
    <button class="ai" type="button" [attr.data-accent]="accent" [pTooltip]="tooltip"
      (click)="onClick($event)" [attr.aria-label]="tooltip">
      <i [class]="icon" aria-hidden="true"></i>
    </button>
  `,
  styles: [`
    .ai {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border: 1px solid transparent;
      border-radius: 6px;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 12px;
      transition: border-color 120ms ease, background 120ms ease, color 120ms ease;
    }

    .ai:hover {
      border-color: var(--border-strong);
      background: var(--surface-hover);
      color: var(--accent);
    }

    .ai:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }

    [data-accent="amber"]:hover { color: var(--warning); }
    [data-accent="red"]:hover { color: var(--danger); }
    [data-accent="green"]:hover { color: var(--success); }
    [data-accent="purple"]:hover { color: var(--purple); }

    @media (prefers-reduced-motion: reduce) {
      .ai { transition: none; }
    }
  `],
})
export class ActionIconComponent {
  @Input() icon = 'pi pi-ellipsis-h';
  @Input() tooltip = '';
  @Input() accent: 'cyan' | 'amber' | 'red' | 'green' | 'purple' = 'cyan';
  @Output() clicked = new EventEmitter<void>();

  onClick(event: Event) {
    event.stopPropagation();
    this.clicked.emit();
  }
}
