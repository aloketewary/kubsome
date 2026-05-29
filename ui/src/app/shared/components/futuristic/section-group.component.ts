import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-section-group',
  standalone: true,
  template: `
    <div class="sg" [class.sg-alert]="unhealthy > 0">
      <div class="sg-head" (click)="toggle.emit()" tabindex="0" role="button"
           (keydown.enter)="toggle.emit()" (keydown.space)="$event.preventDefault(); toggle.emit()">
        <i class="pi" [class.pi-chevron-down]="expanded" [class.pi-chevron-right]="!expanded"></i>
        <span class="sg-name">{{ title }}</span>
        <div class="sg-bar">
          <div class="sg-bar-fill" [class.sg-bar-ok]="unhealthy === 0" [class.sg-bar-bad]="unhealthy > 0"
               [style.width.%]="healthPct"></div>
        </div>
        <span class="sg-ratio">{{ total - unhealthy }}<span class="sg-sep">/</span>{{ total }}</span>
        @if (unhealthy > 0) {
          <span class="sg-warn-badge">{{ unhealthy }}</span>
        }
        <div class="sg-slot" (click)="$event.stopPropagation()">
          <ng-content select="[group-actions]" />
        </div>
      </div>
      @if (expanded) {
        <div class="sg-body"><ng-content /></div>
      }
    </div>
  `,
  styles: [`
    .sg {
      position: relative;
      background: linear-gradient(180deg, transparent 0%, transparent 100%);
      border: 1px solid rgba(94, 84, 75, 0.08);
      border-radius: 12px;
      margin-bottom: 6px;
      overflow: hidden;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .sg::after {
      content: '';
      position: absolute;
      top: 0; left: 16px; right: 16px;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(94, 84, 75, 0.12), transparent);
      pointer-events: none;
    }
    .sg:hover {
      border-color: rgba(255, 255, 255, 0.07);
      box-shadow: 0 4px 20px -6px rgba(0, 0, 0, 0.5);
    }
    .sg-alert {
      border-left: 2px solid rgba(244, 63, 94, 0.5);
    }
    .sg-alert::after {
      background: linear-gradient(90deg, transparent, rgba(244, 63, 94, 0.2), transparent);
    }

    .sg-head {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      cursor: pointer;
      outline: none;
      transition: background 0.12s;
    }
    .sg-head:hover { background: rgba(94, 84, 75, 0.03); }
    .sg-head:focus-visible { box-shadow: inset 0 0 0 1px rgba(208, 156, 96, 0.4); }
    .sg-head > i { color: rgba(168, 158, 148, 0.4); font-size: 9px; width: 10px; }

    .sg-name {
      font-size: 12px;
      font-weight: 600;
      color: rgba(245, 240, 235, 0.85);
      letter-spacing: -0.01em;
    }

    .sg-bar {
      width: 40px; height: 2px; border-radius: 1px;
      background: rgba(94, 84, 75, 0.1); overflow: hidden;
    }
    .sg-bar-fill { height: 100%; border-radius: 1px; transition: width 0.4s; }
    .sg-bar-ok { background: #4ade80; box-shadow: 0 0 3px rgba(74, 222, 128, 0.5); }
    .sg-bar-bad { background: #f43f5e; box-shadow: 0 0 3px rgba(244, 63, 94, 0.5); }

    .sg-ratio {
      font-size: 10px;
      font-family: 'JetBrains Mono', monospace;
      color: rgba(168, 158, 148, 0.5);
    }
    .sg-sep { opacity: 0.3; margin: 0 1px; }

    .sg-warn-badge {
      font-size: 9px;
      font-weight: 700;
      width: 18px; height: 18px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      background: rgba(244, 63, 94, 0.15);
      color: #f43f5e;
      font-family: 'JetBrains Mono', monospace;
    }

    .sg-slot { margin-left: auto; }

    .sg-body {
      border-top: 1px solid rgba(255, 255, 255, 0.025);
      padding: 2px 6px 6px;
    }
  `],
})
export class SectionGroupComponent {
  @Input() title = '';
  @Input() healthPct = 100;
  @Input() total = 0;
  @Input() unhealthy = 0;
  @Input() expanded = true;
  @Output() toggle = new EventEmitter<void>();
}
