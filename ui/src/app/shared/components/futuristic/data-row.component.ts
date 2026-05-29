import { Component, Input, Output, EventEmitter } from '@angular/core';
import { StatusBeaconComponent } from './status-beacon.component';

@Component({
  selector: 'app-data-row',
  standalone: true,
  imports: [StatusBeaconComponent],
  template: `
    <div class="dr" [class.dr-sel]="selected" [class.dr-alert]="status === 'critical'"
         (click)="rowClick.emit()" tabindex="0" role="button"
         (keydown.enter)="rowClick.emit()" (keydown.space)="$event.preventDefault(); rowClick.emit()">
      <app-status-beacon [status]="status" [pulse]="status === 'critical'" size="sm" />
      <div class="dr-text">
        <span class="dr-primary">{{ primary }}</span>
        @if (secondary) { <span class="dr-secondary">{{ secondary }}</span> }
      </div>
      <div class="dr-meta"><ng-content select="[meta]" /></div>
      <div class="dr-actions"><ng-content /></div>
    </div>
  `,
  styles: [`
    .dr {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 7px 10px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s;
      outline: none;
      border: 1px solid transparent;
    }
    .dr:hover {
      background: rgba(94, 84, 75, 0.04);
      border-color: rgba(94, 84, 75, 0.08);
      transform: translateX(2px);
    }
    .dr:hover .dr-actions { opacity: 1; }
    .dr:focus-visible { box-shadow: inset 0 0 0 1px rgba(208, 156, 96, 0.3); }

    .dr-sel {
      background: rgba(208, 156, 96, 0.03);
      border-color: rgba(208, 156, 96, 0.1);
    }
    .dr-alert {
      background: rgba(244, 63, 94, 0.02);
      border-color: rgba(244, 63, 94, 0.08);
    }

    .dr-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .dr-primary {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 500;
      color: rgba(245, 240, 235, 0.8);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .dr-secondary { font-size: 9px; color: rgba(168, 158, 148, 0.35); }
    .dr-meta { display: flex; align-items: center; gap: 5px; flex-shrink: 0; }
    .dr-actions {
      display: flex; align-items: center; gap: 1px;
      opacity: 0; transition: opacity 0.12s;
    }
    @media (hover: none) { .dr-actions { opacity: 1; } }
  `],
})
export class DataRowComponent {
  @Input() status: 'ok' | 'warning' | 'critical' | 'idle' | 'info' = 'idle';
  @Input() primary = '';
  @Input() secondary = '';
  @Input() selected = false;
  @Output() rowClick = new EventEmitter<void>();
}
