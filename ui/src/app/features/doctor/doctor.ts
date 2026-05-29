import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TooltipModule } from 'primeng/tooltip';
import { IntelHeaderComponent, HoloCardComponent, MetricTileComponent, StatusBeaconComponent } from '../../shared/components/futuristic';

@Component({
  selector: 'app-doctor',
  standalone: true,
  imports: [TooltipModule, IntelHeaderComponent, HoloCardComponent, MetricTileComponent, StatusBeaconComponent],
  templateUrl: './doctor.html',
  styleUrl: './doctor.scss',
})
export class DoctorComponent implements OnInit {
  private http = inject(HttpClient);
  checks: any[] = [];
  loading = false;
  loadError = false;
  allOk = true;
  lastChecked = '';

  get passCount() { return this.checks.filter(c => c.status === 'ok').length; }
  get warnCount() { return this.checks.filter(c => c.status === 'warn').length; }
  get failCount() { return this.checks.filter(c => c.status === 'fail').length; }

  checkBeacon(status: string): 'ok' | 'warning' | 'critical' {
    if (status === 'ok') return 'ok';
    if (status === 'warn') return 'warning';
    return 'critical';
  }

  ngOnInit() { this.load(); }

  load() {
    this.loading = true; this.loadError = false;
    this.http.get<any>('/api/doctor').subscribe({
      next: (res) => { this.checks = res.checks || []; this.allOk = this.checks.every(c => c.status === 'ok'); this.loading = false; this.lastChecked = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); },
      error: () => { this.loading = false; this.loadError = true; },
    });
  }
}
