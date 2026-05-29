import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TagModule } from 'primeng/tag';
import { HoloCardComponent } from '../../shared/components/futuristic/holo-card.component';
import { MetricTileComponent } from '../../shared/components/futuristic/metric-tile.component';
import { StatusBeaconComponent } from '../../shared/components/futuristic/status-beacon.component';
import { IntelHeaderComponent } from '../../shared/components/futuristic/intel-header.component';

@Component({
  selector: 'app-policy',
  standalone: true,
  imports: [IntelHeaderComponent, TagModule, HoloCardComponent, MetricTileComponent, StatusBeaconComponent],
  templateUrl: './policy.html',
  styleUrl: './policy.scss',
})
export class PolicyComponent implements OnInit {
  private http = inject(HttpClient);
  data: any = null;
  loading = false;
  lastChecked = '';

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.http.get<any>('/api/policy-check').subscribe({
      next: (res) => { this.data = res; this.loading = false; this.lastChecked = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); },
      error: () => { this.loading = false; },
    });
  }

  isViolated(policyName: string): boolean {
    return (this.data?.violations || []).some((v: any) => v.policy === policyName);
  }
}
