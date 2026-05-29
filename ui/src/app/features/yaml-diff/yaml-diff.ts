import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { SpotlightComponent } from '../../shared/components/spotlight.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';


@Component({
  selector: 'app-yaml-diff',
  standalone: true,
  imports: [FormsModule, Select, ButtonModule, SpotlightComponent, PageHeaderComponent],
  templateUrl: './yaml-diff.html',
  styleUrl: './yaml-diff.scss',
})
export class YamlDiffComponent implements OnInit {
  private http = inject(HttpClient);
  deployments: string[] = [];
  selected = '';
  data: any = null;
  loading = false;

  ngOnInit() {
    this.http.get<any>('/api/deployments').subscribe(res => {
      this.deployments = (res.deployments || []).map((d: any) => d.name);
    });
  }

  compare() {
    if (!this.selected) return;
    this.loading = true;
    this.data = null;
    this.http.get<any>(`/api/yaml-diff/${this.selected}`).subscribe({
      next: (res) => { this.data = res; this.loading = false; },
      error: () => { this.data = { available: false, reason: 'Failed to fetch diff' }; this.loading = false; },
    });
  }
}
