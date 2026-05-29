import { Component, Input, Output, EventEmitter } from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-action-icon',
  standalone: true,
  imports: [TooltipModule],
  template: `
    <button class="ai" [attr.data-accent]="accent" [pTooltip]="tooltip"
            (click)="onClick($event)" [attr.aria-label]="tooltip">
      <i [class]="icon"></i>
    </button>
  `,
  styles: [`
    .ai {
      width: 24px; height: 24px;
      border-radius: 6px;
      border: none;
      background: transparent;
      color: rgba(168, 158, 148, 0.4);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
      font-size: 11px;
    }
    .ai:hover {
      color: #d09c60;
      background: rgba(208, 156, 96, 0.08);
      box-shadow: 0 0 6px -2px rgba(208, 156, 96, 0.3);
      transform: scale(1.1);
    }
    [data-accent="amber"]:hover {
      color: #f59e0b;
      background: rgba(245, 158, 11, 0.08);
      box-shadow: 0 0 6px -2px rgba(245, 158, 11, 0.3);
    }
    [data-accent="red"]:hover {
      color: #f43f5e;
      background: rgba(244, 63, 94, 0.08);
      box-shadow: 0 0 6px -2px rgba(244, 63, 94, 0.3);
    }
    [data-accent="green"]:hover {
      color: #4ade80;
      background: rgba(74, 222, 128, 0.08);
      box-shadow: 0 0 6px -2px rgba(74, 222, 128, 0.3);
    }
    [data-accent="purple"]:hover {
      color: #a78bfa;
      background: rgba(167, 139, 250, 0.08);
      box-shadow: 0 0 6px -2px rgba(167, 139, 250, 0.3);
    }

    /* Light Mode */
    :host-context([data-theme="light"]) .ai { color: rgba(0,0,0,0.35); }
    :host-context([data-theme="light"]) .ai:hover { background: rgba(0,0,0,0.04); color: rgba(0,0,0,0.7); box-shadow: none; }
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
