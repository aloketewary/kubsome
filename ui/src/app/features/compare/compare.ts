import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { HoloCardComponent } from '../../shared/components/futuristic/holo-card.component';
import { MetricTileComponent } from '../../shared/components/futuristic/metric-tile.component';
import { StatusBeaconComponent } from '../../shared/components/futuristic/status-beacon.component';
import { IntelHeaderComponent } from '../../shared/components/futuristic/intel-header.component';

@Component({
  selector: 'app-compare',
  standalone: true,
  imports: [IntelHeaderComponent, FormsModule, Select, TagModule, HoloCardComponent, MetricTileComponent, StatusBeaconComponent],
  templateUrl: './compare.html',
  styleUrl: './compare.scss',
})
export class CompareComponent implements OnInit {
  private http = inject(HttpClient);
  contexts: string[] = [];
  ctxA = ''; ctxB = '';
  nsA: string[] = []; nsB: string[] = [];
  selectedNsA = ''; selectedNsB = '';
  result: any = null;
  loading = false;
  error = '';

  ngOnInit() { this.http.get<any>('/api/contexts').subscribe(res => { this.contexts = (res.contexts || []).map((c: any) => c.name); }); }

  loadNamespaces(side: 'a' | 'b') {
    const ctx = side === 'a' ? this.ctxA : this.ctxB;
    if (!ctx) return;
    this.http.get<any>(`/api/namespaces/${ctx}`).subscribe({ next: (res) => { if (side === 'a') { this.nsA = res.namespaces || []; this.selectedNsA = ''; } else { this.nsB = res.namespaces || []; this.selectedNsB = ''; } } });
  }

  compare() {
    this.loading = true; this.error = ''; this.result = null;
    this.http.post<any>('/api/compare', { ctx_a: this.ctxA, ctx_b: this.ctxB, ns_a: this.selectedNsA, ns_b: this.selectedNsB }).subscribe({
      next: (res) => { this.result = res; this.loading = false; },
      error: (err) => { this.error = err.error?.detail || 'Compare failed'; this.loading = false; },
    });
  }
}
