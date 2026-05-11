import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-spotlight',
  standalone: true,
  template: `
    @if (visible) {
      <div class="spotlight" [class.spotlight-compact]="compact">
        <div class="sp-icon"><i [class]="icon"></i></div>
        <div class="sp-body">
          <div class="sp-header">
            <h4>{{ title }}</h4>
            <button class="sp-dismiss" (click)="dismiss()" aria-label="Dismiss">
              <i class="pi pi-times"></i>
            </button>
          </div>
          <p class="sp-desc">{{ description }}</p>
          @if (capabilities.length > 0) {
            <div class="sp-caps">
              @for (cap of capabilities; track cap) {
                <span class="sp-cap"><i class="pi pi-check-circle"></i> {{ cap }}</span>
              }
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .spotlight {
      display: flex; gap: 14px; padding: 16px 20px; margin-bottom: 16px;
      background: linear-gradient(135deg, rgba(59,130,246,0.06), rgba(59,130,246,0.02));
      border: 1px solid rgba(59,130,246,0.2); border-radius: var(--radius);
      animation: spotIn 0.3s ease-out;
    }
    @keyframes spotIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
    .spotlight-compact { padding: 12px 16px; }
    .sp-icon {
      width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
      background: var(--accent-subtle); color: var(--accent);
      display: flex; align-items: center; justify-content: center; font-size: 16px;
    }
    .sp-body { flex: 1; min-width: 0; }
    .sp-header { display: flex; align-items: flex-start; justify-content: space-between; }
    .sp-header h4 { font-size: 13px; font-weight: 600; margin: 0 0 4px; }
    .sp-dismiss {
      background: none; border: none; color: var(--text-muted); cursor: pointer;
      padding: 2px; border-radius: 4px; font-size: 11px;
    }
    .sp-dismiss:hover { color: var(--text); background: var(--bg-hover); }
    .sp-desc { font-size: 12px; color: var(--text-secondary); margin: 0 0 8px; line-height: 1.5; }
    .sp-caps { display: flex; flex-wrap: wrap; gap: 6px; }
    .sp-cap {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 10px; color: var(--text-muted); padding: 3px 8px;
      background: var(--bg-elevated); border-radius: 4px; border: 1px solid var(--border);
    }
    .sp-cap i { font-size: 10px; color: var(--accent); }
  `],
})
export class SpotlightComponent implements OnInit {
  @Input() id = '';
  @Input() title = '';
  @Input() description = '';
  @Input() icon = 'pi pi-info-circle';
  @Input() capabilities: string[] = [];
  @Input() compact = false;
  visible = false;

  ngOnInit() {
    const key = `kubsome_spotlight_${this.id}`;
    this.visible = !localStorage.getItem(key);
  }

  dismiss() {
    this.visible = false;
    localStorage.setItem(`kubsome_spotlight_${this.id}`, '1');
  }
}
