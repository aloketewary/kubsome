import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TitleCasePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TabsModule } from 'primeng/tabs';
import { IntelHeaderComponent } from '../../shared/components/futuristic/intel-header.component';


@Component({
  selector: 'app-mesh',
  standalone: true,
  imports: [ButtonModule, TagModule, TabsModule, TitleCasePipe, IntelHeaderComponent],
  templateUrl: './mesh.html',
  styleUrl: './mesh.scss',
})
export class MeshComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  data: any = null;
  loading = false;
  lastUpdated = '';
  activeTab = '0';
  private timer: any;

  ngOnInit() { this.refresh(); this.timer = setInterval(() => this.refresh(), 30000); }
  ngOnDestroy() { clearInterval(this.timer); }

  refresh() {
    this.loading = true;
    this.http.get<any>('/api/mesh/status').subscribe({
      next: (res) => { this.data = res; this.loading = false; this.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); },
      error: () => { this.data = { mesh: null }; this.loading = false; },
    });
  }
}
