import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { IntelHeaderComponent } from '../../shared/components/futuristic/intel-header.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';


@Component({
  selector: 'app-blast-radius',
  standalone: true,
  imports: [ButtonModule, TagModule, TooltipModule, FormsModule, Select, UpperCasePipe, IntelHeaderComponent, SkeletonComponent],
  templateUrl: './blast-radius.html',
  styleUrl: './blast-radius.scss',
})
export class BlastRadiusComponent implements OnInit {
  private http = inject(HttpClient);
  target = '';
  action = 'restart';
  result: any = null;
  loading = false;
  deployments: string[] = [];

  ngOnInit() {
    this.http.get<any>('/api/deployments').subscribe({
      next: (res) => { this.deployments = (res.deployments || []).map((d: any) => d.name); },
      error: () => {},
    });
  }

  analyze() {
    if (!this.target) return;
    this.loading = true;
    this.result = null;
    this.http.get<any>(`/api/analytics/blast-radius/${this.target}?action=${this.action}`).subscribe({
      next: (res) => { this.result = res; this.loading = false; },
      error: (err) => { this.result = { error: err.error?.detail || 'Analysis failed. Check deployment name.' }; this.loading = false; },
    });
  }

  sevTag(sev: string): "success" | "warn" | "danger" | "info" | "secondary" | "contrast" | undefined {
    if (sev === 'critical') return 'danger';
    if (sev === 'high') return 'danger';
    if (sev === 'medium') return 'warn';
    if (sev === 'low') return 'success';
    return 'info';
  }
}
