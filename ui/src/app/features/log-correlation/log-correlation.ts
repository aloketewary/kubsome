import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { MultiSelect } from 'primeng/multiselect';
import { TooltipModule } from 'primeng/tooltip';
import { SpotlightComponent } from '../../shared/components/spotlight.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';


@Component({
  selector: 'app-log-correlation',
  standalone: true,
  imports: [FormsModule, ButtonModule, MultiSelect, TooltipModule, SpotlightComponent, PageHeaderComponent],
  templateUrl: './log-correlation.html',
  styleUrl: './log-correlation.scss',
})
export class LogCorrelationComponent implements OnInit {
  private http = inject(HttpClient);
  podOptions: { label: string; value: string }[] = [];
  selectedPods: string[] = [];
  data: any = null;
  loading = false;

  private colors = ['#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ef4444', '#06b6d4', '#f97316', '#ec4899'];

  ngOnInit() {
    this.http.get<any>('/api/pods').subscribe(res => {
      this.podOptions = (res.pods || []).map((p: any) => ({ label: p.name, value: p.name }));
    });
  }

  correlate() {
    if (this.selectedPods.length < 2) return;
    this.loading = true;
    this.data = null;
    this.http.post<any>('/api/correlate-logs', {
      pods: this.selectedPods, tail: 100,
    }).subscribe({
      next: (res) => { this.data = res; this.loading = false; },
      error: () => { this.data = { entries: [], pods: [], total: 0 }; this.loading = false; },
    });
  }

  podColor(pod: string): string {
    const idx = this.data?.pods?.indexOf(
      this.data.pods.find((p: string) => pod === p.split('-').slice(0, -2).join('-') || p.includes(pod))
    ) ?? 0;
    return this.colors[Math.abs(idx) % this.colors.length];
  }

  copyAll() {
    if (!this.data?.entries) return;
    const text = this.data.entries.map((e: any) => `${e.timestamp || ''} [${e.pod}] ${e.message}`).join('\n');
    navigator.clipboard.writeText(text);
  }
}
