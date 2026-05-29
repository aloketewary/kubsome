import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { HoloCardComponent } from '../../shared/components/futuristic/holo-card.component';
import { MetricTileComponent } from '../../shared/components/futuristic/metric-tile.component';
import { ActionIconComponent } from '../../shared/components/futuristic/action-icon.component';
import { ConfirmService } from '../../shared/services/confirm.service';

@Component({
  selector: 'app-pins',
  standalone: true,
  imports: [FormsModule, HoloCardComponent, MetricTileComponent, ActionIconComponent],
  templateUrl: './pins.html',
  styleUrl: './pins.scss',
})
export class PinsComponent implements OnInit {
  private http = inject(HttpClient);
  private confirmService = inject(ConfirmService);
  pins: any[] = [];
  newName = '';
  newQuery = '';

  ngOnInit() { this.refresh(); }
  refresh() { this.http.get<any>('/api/saved-queries').subscribe(res => { this.pins = res.queries || []; }); }
  addPin() { if (!this.newName || !this.newQuery) return; this.http.post<any>('/api/saved-queries', { name: this.newName, query: this.newQuery, interval: 300 }).subscribe(() => { this.newName = ''; this.newQuery = ''; this.refresh(); }); }
  removePin(name: string) { this.confirmService.confirm({ title: 'Remove Pin', message: `Delete "${name}"?`, confirmLabel: 'Delete', severity: 'danger' }).then(ok => { if (ok) this.http.delete(`/api/saved-queries/${name}`).subscribe(() => this.refresh()); }); }
  runPin(pin: any) { this.http.post<any>('/api/ai', { query: pin.query }).subscribe(res => { pin.last_result = res.answer || JSON.stringify(res); pin.last_run = new Date().toISOString(); }); }
  formatTime(iso: string): string { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
}
