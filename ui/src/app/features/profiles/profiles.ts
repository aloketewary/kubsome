import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { PageInfoComponent } from '../../shared/components/page-info.component';
import { SpotlightComponent } from '../../shared/components/spotlight.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { RelatedPagesComponent } from '../../shared/components/related-pages.component';


@Component({
  selector: 'app-profiles',
  standalone: true,
  imports: [ButtonModule, TagModule, PageInfoComponent, SpotlightComponent, RelatedPagesComponent, PageHeaderComponent],
  templateUrl: './profiles.html',
  styleUrl: './profiles.scss',
})
export class ProfilesComponent implements OnInit {
  private http = inject(HttpClient);
  profiles: any[] = [];
  active: string | null = null;
  loading = false;

  relatedPages = [
    { path: '/settings', icon: 'pi pi-cog', label: 'Settings', description: 'Global configuration options' },
    { path: '/integrations', icon: 'pi pi-plug', label: 'Integrations', description: 'Connected external tools' },
    { path: '/compare', icon: 'pi pi-arrows-h', label: 'Compare', description: 'Multi-cluster drift detection' },
  ];

  ngOnInit() { this.refresh(); }

  refresh() {
    this.loading = true;
    this.http.get<any>('/api/profiles').subscribe({
      next: (res) => {
        this.profiles = res.profiles || [];
        this.active = res.active || null;
        this.loading = false;
      },
      error: () => { this.profiles = []; this.loading = false; },
    });
  }

  activate(name: string) {
    this.http.post<any>('/api/profiles/activate', { name }).subscribe({
      next: () => { this.active = name; },
    });
  }

  reset() {
    this.http.post<any>('/api/profiles/deactivate', {}).subscribe({
      next: () => { this.active = null; },
    });
  }
}
