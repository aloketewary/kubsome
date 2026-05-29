import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TagModule } from 'primeng/tag';
import { HoloCardComponent } from '../../shared/components/futuristic/holo-card.component';
import { MetricTileComponent } from '../../shared/components/futuristic/metric-tile.component';
import { ActionIconComponent } from '../../shared/components/futuristic/action-icon.component';

@Component({
  selector: 'app-schedule',
  standalone: true,
  imports: [FormsModule, TagModule, HoloCardComponent, MetricTileComponent, ActionIconComponent],
  templateUrl: './schedule.html',
  styleUrl: './schedule.scss',
})
export class ScheduleComponent implements OnInit {
  private http = inject(HttpClient);
  schedules: any[] = [];
  showForm = false;
  newName = '';
  newCron = '';
  newCommands = '';
  presets = [{ label: 'Every 30min', cron: '*/30 * * * *' }, { label: 'Hourly', cron: '0 * * * *' }, { label: 'Daily 8am', cron: '0 8 * * *' }, { label: 'Every 6h', cron: '0 */6 * * *' }];

  ngOnInit() { this.load(); }
  load() { this.http.get<any>('/api/schedules').subscribe({ next: (res) => { this.schedules = res.schedules || []; } }); }
  addSchedule() { const commands = this.newCommands.split(',').map(c => c.trim()).filter(Boolean); this.http.post<any>('/api/schedules', { name: this.newName.trim(), cron: this.newCron.trim(), commands, notify: true }).subscribe({ next: () => { this.newName = ''; this.newCron = ''; this.newCommands = ''; this.showForm = false; this.load(); } }); }
  removeSchedule(name: string) { this.http.delete<any>(`/api/schedules/${name}`).subscribe({ next: () => this.load() }); }
}
