import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { HoloCardComponent } from '../../shared/components/futuristic/holo-card.component';
import { MetricTileComponent } from '../../shared/components/futuristic/metric-tile.component';
import { IntelHeaderComponent } from '../../shared/components/futuristic/intel-header.component';

@Component({
  selector: 'app-resource-ops',
  standalone: true,
  imports: [IntelHeaderComponent, FormsModule, TagModule, ButtonModule, TooltipModule, HoloCardComponent, MetricTileComponent],
  templateUrl: './resource-ops.html',
  styleUrl: './resource-ops.scss',
})
export class ResourceOpsComponent {
  private http = inject(HttpClient);

  // Patch form
  patchResource = 'deployment';
  patchName = '';
  patchType = 'strategic';
  patchData = '';
  patchResult = '';
  patchSuccess = false;

  // Annotate form
  annotateResource = 'deployment';
  annotateName = '';
  annotateKV = '';
  annotateRemove = false;
  annotateResult = '';
  annotateSuccess = false;

  // Set Image form
  imageDeployment = '';
  imageContainer = '';
  imageTag = '';
  imageResult = '';
  imageSuccess = false;

  // History
  history: { action: string; target: string; success: boolean; time: string }[] = [];

  submitPatch() {
    if (!this.patchName || !this.patchData) return;
    this.patchResult = '';
    let parsed: any;
    try { parsed = JSON.parse(this.patchData); } catch { this.patchResult = 'Invalid JSON'; this.patchSuccess = false; return; }
    this.http.post<any>('/api/resource-ops/patch', {
      resource: this.patchResource, name: this.patchName,
      patch_type: this.patchType, patch_data: parsed
    }).subscribe({
      next: (res) => { this.patchSuccess = res.success; this.patchResult = res.message; this.addHistory('patch', `${this.patchResource}/${this.patchName}`, res.success); },
      error: (err) => { this.patchSuccess = false; this.patchResult = err.error?.detail || 'Failed'; }
    });
  }

  submitAnnotate() {
    if (!this.annotateName || !this.annotateKV) return;
    this.annotateResult = '';
    const annotations: Record<string, string> = {};
    for (const part of this.annotateKV.split(',')) {
      const trimmed = part.trim();
      if (trimmed.endsWith('-')) { annotations[trimmed.slice(0, -1)] = ''; this.annotateRemove = true; }
      else if (trimmed.includes('=')) { const [k, v] = trimmed.split('=', 2); annotations[k] = v; }
    }
    this.http.post<any>('/api/resource-ops/annotate', {
      resource: this.annotateResource, name: this.annotateName,
      annotations, remove: this.annotateRemove
    }).subscribe({
      next: (res) => { this.annotateSuccess = res.success; this.annotateResult = res.message; this.addHistory('annotate', `${this.annotateResource}/${this.annotateName}`, res.success); },
      error: (err) => { this.annotateSuccess = false; this.annotateResult = err.error?.detail || 'Failed'; }
    });
  }

  submitSetImage() {
    if (!this.imageDeployment || !this.imageTag) return;
    this.imageResult = '';
    this.http.post<any>('/api/resource-ops/set-image', {
      deployment: this.imageDeployment,
      container: this.imageContainer || this.imageDeployment,
      image: this.imageTag
    }).subscribe({
      next: (res) => { this.imageSuccess = res.success; this.imageResult = res.message; this.addHistory('set-image', this.imageDeployment, res.success); },
      error: (err) => { this.imageSuccess = false; this.imageResult = err.error?.detail || 'Failed'; }
    });
  }

  private addHistory(action: string, target: string, success: boolean) {
    this.history.unshift({ action, target, success, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) });
    if (this.history.length > 10) this.history.pop();
  }
}
