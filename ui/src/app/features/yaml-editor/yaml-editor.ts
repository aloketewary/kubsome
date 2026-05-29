import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { Select } from 'primeng/select';
import { IntelHeaderComponent } from '../../shared/components/futuristic/intel-header.component';
import { ConfirmService } from '../../shared/services/confirm.service';


@Component({
  selector: 'app-yaml-editor',
  standalone: true,
  imports: [FormsModule, ButtonModule, TagModule, TooltipModule, Select, IntelHeaderComponent],
  templateUrl: './yaml-editor.html',
  styleUrl: './yaml-editor.scss',
})
export class YamlEditorComponent {
  private http = inject(HttpClient);
  private confirmService = inject(ConfirmService);
  private base = '/api';

  kinds = ['Deployment', 'Service', 'ConfigMap', 'Secret', 'Ingress', 'CronJob', 'HPA'];
  kind = '';
  name = '';
  yaml = '';
  result = '';
  resultSuccess = false;
  isDryRun = false;
  copied = false;
  showEditor = false;
  lineNumbers: number[] = [1];
  resourceNames: string[] = [];
  isLiveEdit = false;

  templates = [
    { kind: 'Deployment', desc: 'Container workload', icon: 'pi pi-send', color: '#3b82f6' },
    { kind: 'Service', desc: 'Network endpoint', icon: 'pi pi-globe', color: '#22c55e' },
    { kind: 'ConfigMap', desc: 'Configuration data', icon: 'pi pi-file', color: '#eab308' },
    { kind: 'Secret', desc: 'Sensitive data', icon: 'pi pi-lock', color: '#ef4444' },
    { kind: 'Ingress', desc: 'External access', icon: 'pi pi-link', color: '#f472b6' },
    { kind: 'CronJob', desc: 'Scheduled task', icon: 'pi pi-clock', color: '#a855f7' },
  ];

  get lineCount() { return this.yaml.split('\n').length; }
  get fileName() { return this.kind ? `${this.name || 'untitled'}.${this.kind.toLowerCase()}.yaml` : 'manifest.yaml'; }

  useTemplate(tpl: any) {
    this.kind = tpl.kind;
    this.name = '';
    this.showEditor = true;
    this.yaml = `# ${tpl.kind} manifest\n# Enter a name above and click Generate\n`;
    this.updateLines();
  }

  generate() {
    this.showEditor = true;
    this.isLiveEdit = false;
    this.http.post<any>(`${this.base}/generate`, { kind: this.kind, name: this.name }).subscribe(res => {
      this.yaml = res.yaml || `# Could not generate ${this.kind} manifest`;
      this.updateLines();
    });
  }

  loadResource() {
    if (!this.kind || !this.name) return;
    const kindMap: Record<string, string> = {
      'Deployment': 'deployment', 'Service': 'service',
      'ConfigMap': 'configmap', 'Secret': 'secret',
      'Ingress': 'ingress', 'CronJob': 'cronjob', 'HPA': 'hpa',
    };
    const resource = kindMap[this.kind] || this.kind.toLowerCase();
    this.http.post<any>(`${this.base}/exec`, {
      command: `kubectl get ${resource} ${this.name} -o yaml`
    }).subscribe({
      next: (res) => {
        this.yaml = res.output || `# Could not fetch ${this.kind}/${this.name}`;
        this.showEditor = true;
        this.isLiveEdit = true;
        this.resourceNames = [];
        this.updateLines();
      },
      error: () => {
        this.yaml = `# Error fetching ${this.kind}/${this.name}`;
        this.showEditor = true;
        this.updateLines();
      },
    });
  }

  onKindChange() {
    if (!this.kind) { this.resourceNames = []; return; }
    const kindMap: Record<string, string> = {
      'Deployment': 'deployments', 'Service': 'services',
      'ConfigMap': 'configmaps', 'Secret': 'secrets',
      'Ingress': 'ingresses', 'CronJob': 'cronjobs', 'HPA': 'hpa',
    };
    const resource = kindMap[this.kind] || this.kind.toLowerCase() + 's';
    this.http.post<any>(`${this.base}/exec`, {
      command: `kubectl get ${resource} -o jsonpath='{.items[*].metadata.name}'`
    }).subscribe({
      next: (res) => {
        const names = (res.output || '').trim().replace(/'/g, '').split(/\s+/).filter((n: string) => n);
        this.resourceNames = names.slice(0, 20);
      },
      error: () => { this.resourceNames = []; },
    });
  }

  apply() {
    this.confirmService.confirm({
      title: 'Apply Manifest',
      message: `Apply this ${this.kind || 'resource'} manifest to the cluster?`,
      confirmLabel: 'Apply',
      severity: 'warning',
      productionGuard: true,
    }).then(ok => {
      if (!ok) return;
      this.isDryRun = false;
      this.http.post<any>(`${this.base}/exec`, {
        command: `kubectl apply -f - <<EOF\n${this.yaml}\nEOF`
      }).subscribe({
        next: (res) => { this.result = res.output || 'Applied'; this.resultSuccess = res.exit_code === 0; },
        error: () => { this.result = 'Connection error'; this.resultSuccess = false; },
      });
    });
  }

  dryRun() {
    this.isDryRun = true;
    this.http.post<any>(`${this.base}/exec`, {
      command: `kubectl apply --dry-run=client -f - <<EOF\n${this.yaml}\nEOF`
    }).subscribe({
      next: (res) => { this.result = res.output || 'Valid'; this.resultSuccess = res.exit_code === 0; },
      error: () => { this.result = 'Connection error'; this.resultSuccess = false; },
    });
  }

  copy() {
    navigator.clipboard.writeText(this.yaml);
    this.copied = true;
    setTimeout(() => this.copied = false, 2000);
  }

  clear() {
    this.yaml = '';
    this.result = '';
    this.showEditor = false;
    this.isLiveEdit = false;
    this.updateLines();
  }

  updateLines() {
    const count = Math.max(this.yaml.split('\n').length, 1);
    this.lineNumbers = Array.from({ length: count }, (_, i) => i + 1);
  }
}
