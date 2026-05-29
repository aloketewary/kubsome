import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TagModule } from 'primeng/tag';
import { HoloCardComponent } from '../../shared/components/futuristic/holo-card.component';
import { MetricTileComponent } from '../../shared/components/futuristic/metric-tile.component';
import { StatusBeaconComponent } from '../../shared/components/futuristic/status-beacon.component';
import { ActionIconComponent } from '../../shared/components/futuristic/action-icon.component';

@Component({
  selector: 'app-profiles',
  standalone: true,
  imports: [TagModule, HoloCardComponent, MetricTileComponent, StatusBeaconComponent, ActionIconComponent],
  templateUrl: './profiles.html',
  styleUrl: './profiles.scss',
})
export class ProfilesComponent implements OnInit {
  private http = inject(HttpClient);
  profiles: any[] = [];
  active: string | null = null;
  loading = false;

  ngOnInit() { this.refresh(); }
  refresh() { this.loading = true; this.http.get<any>('/api/profiles').subscribe({ next: (res) => { this.profiles = res.profiles || []; this.active = res.active || null; this.loading = false; }, error: () => { this.loading = false; } }); }
  activate(name: string) { this.http.post<any>('/api/profiles/activate', { name }).subscribe({ next: () => { this.active = name; } }); }
  reset() { this.http.post<any>('/api/profiles/deactivate', {}).subscribe({ next: () => { this.active = null; } }); }
}
