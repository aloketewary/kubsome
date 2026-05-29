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
      color: rgba(255, 255, 255, 0.3);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
      font-size: 11px;
    }
    .ai:hover {
      color: #00d4ff;
      background: rgba(0, 212, 255, 0.08);
      box-shadow: 0 0 6px -2px rgba(0, 212, 255, 0.3);
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
      color: #10b981;
      background: rgba(16, 185, 129, 0.08);
      box-shadow: 0 0 6px -2px rgba(16, 185, 129, 0.3);
    }
    [data-accent="purple"]:hover {
      color: #8b5cf6;
      background: rgba(139, 92, 246, 0.08);
      box-shadow: 0 0 6px -2px rgba(139, 92, 246, 0.3);
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
