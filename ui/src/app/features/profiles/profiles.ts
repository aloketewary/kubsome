import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { IntelHeaderComponent } from '../../shared/components/futuristic/intel-header.component';
import { MetricTileComponent } from '../../shared/components/futuristic/metric-tile.component';
import { DataRowComponent } from '../../shared/components/futuristic/data-row.component';
import { ActionIconComponent } from '../../shared/components/futuristic/action-icon.component';

@Component({
  selector: 'app-profiles',
  standalone: true,
  imports: [TagModule, TooltipModule, IntelHeaderComponent, MetricTileComponent, DataRowComponent, ActionIconComponent],
  templateUrl: './profiles.html',
  styleUrl: './profiles.scss',
})
export class ProfilesComponent implements OnInit {
  private http = inject(HttpClient);
  profiles: any[] = [];
  active: string | null = null;
  loading = false;

  ngOnInit() { this.refresh(); }

  refresh() {
    this.loading = true;
    this.http.get<any>('/api/profiles').subscribe({
      next: (res) => { this.profiles = res.profiles || []; this.active = res.active || null; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  activate(name: string) {
    this.http.post<any>('/api/profiles/activate', { name }).subscribe({ next: () => { this.active = name; } });
  }

  reset() {
    this.http.post<any>('/api/profiles/deactivate', {}).subscribe({ next: () => { this.active = null; } });
  }

  profileMeta(p: any): string {
    const parts: string[] = [];
    if (p.context) parts.push(`ctx: ${p.context}`);
    if (p.namespace) parts.push(`ns: ${p.namespace}`);
    if (p.theme) parts.push(`theme: ${p.theme}`);
    return parts.join(' · ');
  }
}
