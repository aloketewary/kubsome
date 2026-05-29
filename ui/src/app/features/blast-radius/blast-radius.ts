import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { SpotlightComponent } from '../../shared/components/spotlight.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';


@Component({
  selector: 'app-blast-radius',
  standalone: true,
  imports: [ButtonModule, TagModule, TooltipModule, FormsModule, UpperCasePipe, SpotlightComponent, PageHeaderComponent, SkeletonComponent],
  templateUrl: './blast-radius.html',
  styleUrl: './blast-radius.scss',
})
export class BlastRadiusComponent {
  private http = inject(HttpClient);
  target = '';
  action = 'restart';
  result: any = null;
  loading = false;

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
