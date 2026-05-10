import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-pins',
  standalone: true,
  imports: [FormsModule, ButtonModule, InputTextModule, TooltipModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Pinned Queries</h1>
        <p class="subtitle">Saved commands for quick access & monitoring</p>
      </div>
    </div>

    <!-- Add New -->
    <div class="add-bar">
      <input pInputText [(ngModel)]="newName" placeholder="Name..." class="input-name" />
      <input pInputText [(ngModel)]="newQuery" placeholder="Query (e.g. how many pods running)..." class="input-query" />
      <button pButton icon="pi pi-plus" label="Pin" class="p-button-sm" (click)="addPin()" [disabled]="!newName || !newQuery"></button>
    </div>

    <!-- Pins List -->
    @if (pins.length > 0) {
      <div class="pins-grid">
        @for (pin of pins; track pin.name) {
          <div class="pin-card">
            <div class="pin-header">
              <span class="pin-name">{{ pin.name }}</span>
              <button pButton icon="pi pi-trash" class="p-button-sm p-button-text p-button-danger p-button-rounded" pTooltip="Remove" (click)="removePin(pin.name)"></button>
            </div>
            <div class="pin-query">{{ pin.query }}</div>
            @if (pin.last_result) {
              <div class="pin-result">{{ pin.last_result }}</div>
            }
            <div class="pin-footer">
              @if (pin.last_run) {
                <span class="pin-time">Last: {{ formatTime(pin.last_run) }}</span>
              }
              <button pButton icon="pi pi-play" class="p-button-sm p-button-text p-button-rounded" pTooltip="Run now" (click)="runPin(pin)"></button>
            </div>
          </div>
        }
      </div>
    } @else {
      <div class="empty">
        <i class="pi pi-bookmark"></i>
        <p>No pinned queries yet</p>
        <span class="empty-hint">Pin frequently used queries for quick monitoring</span>
      </div>
    }
  `,
  styles: [`
    .page-header { margin-bottom: 16px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

    .add-bar {
      display: flex; align-items: center; gap: 10px; margin-bottom: 20px;
      padding: 12px 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-sm);
    }
    .input-name { width: 140px; }
    .input-query { flex: 1; }

    .pins-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
    .pin-card {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 16px; display: flex; flex-direction: column; gap: 8px; transition: border-color 0.12s;
    }
    .pin-card:hover { border-color: var(--border-hover); }
    .pin-header { display: flex; align-items: center; justify-content: space-between; }
    .pin-name { font-size: 14px; font-weight: 600; }
    .pin-query { font-size: 12px; color: var(--accent); font-family: 'JetBrains Mono', monospace; padding: 6px 10px; background: var(--bg-elevated); border-radius: 6px; }
    .pin-result { font-size: 11px; color: var(--text-secondary); padding: 8px 10px; background: var(--bg-elevated); border-radius: 6px; white-space: pre-wrap; max-height: 80px; overflow-y: auto; }
    .pin-footer { display: flex; align-items: center; justify-content: space-between; }
    .pin-time { font-size: 10px; color: var(--text-muted); }

    .empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 60px; color: var(--text-muted); font-size: 14px; }
    .empty i { font-size: 28px; opacity: 0.3; }
    .empty-hint { font-size: 12px; }
  `],
})
export class PinsComponent implements OnInit {
  private http = inject(HttpClient);
  pins: any[] = [];
  newName = '';
  newQuery = '';

  ngOnInit() { this.refresh(); }

  refresh() {
    this.http.get<any>('http://localhost:8000/api/saved-queries').subscribe(res => {
      this.pins = res.queries || [];
    });
  }

  addPin() {
    if (!this.newName || !this.newQuery) return;
    this.http.post<any>('http://localhost:8000/api/saved-queries', {
      name: this.newName, query: this.newQuery, interval: 300,
    }).subscribe(() => {
      this.newName = '';
      this.newQuery = '';
      this.refresh();
    });
  }

  removePin(name: string) {
    this.http.delete(`http://localhost:8000/api/saved-queries/${name}`).subscribe(() => this.refresh());
  }

  runPin(pin: any) {
    this.http.post<any>('http://localhost:8000/api/ai', { query: pin.query }).subscribe(res => {
      pin.last_result = res.answer || JSON.stringify(res);
      pin.last_run = new Date().toISOString();
    });
  }

  formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
