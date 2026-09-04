import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { Select } from 'primeng/select';
import { IntelHeaderComponent } from '../../shared/components/futuristic/intel-header.component';
import { ConfirmService } from '../../shared/services/confirm.service';

type YamlActionState = 'ready' | 'draft' | 'generating' | 'loading' | 'loaded' | 'validating' | 'validated' | 'applying' | 'applied' | 'error';

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
  actionState: YamlActionState = 'ready';
  actionMessage = 'Choose a template or describe a resource to start.';
  isBusy = false;

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
  get actionLabel() {
    const labels: Record<YamlActionState, string> = { ready: 'Ready', draft: 'Draft', generating: 'Generating', loading: 'Loading from cluster', loaded: 'Loaded from cluster', validating: 'Validating', validated: 'Validation passed', applying: 'Applying', applied: 'Applied', error: 'Action failed' };
    return labels[this.actionState];
  }

  useTemplate(tpl: any) {
    this.kind = tpl.kind;
    this.name = '';
    this.showEditor = true;
    this.isLiveEdit = false;
    this.yaml = `# ${tpl.kind} manifest\n# Enter a name above and click Generate\n`;
    this.actionState = 'draft';
    this.actionMessage = `${tpl.kind} template ready. Add a resource name, then generate a manifest.`;
    this.result = '';
    this.updateLines();
  }

  generate() {
    if (!this.kind || !this.name || this.isBusy) return;
    this.showEditor = true;
    this.isLiveEdit = false;
    this.result = '';
    this.isBusy = true;
    this.actionState = 'generating';
    this.actionMessage = `Generating ${this.kind}/${this.name}...`;
    this.http.post<any>(`${this.base}/generate`, { kind: this.kind, name: this.name }).subscribe({
      next: (res) => {
        this.yaml = res.yaml || `# Could not generate ${this.kind} manifest`;
        this.actionState = res.yaml ? 'draft' : 'error';
        this.actionMessage = res.yaml ? 'Manifest generated. Review the YAML before validation or apply.' : 'Manifest generation returned no YAML.';
        this.isBusy = false;
        this.updateLines();
      },
      error: () => {
        this.yaml = `# Error generating ${this.kind} manifest`;
        this.actionState = 'error';
        this.actionMessage = 'Manifest generation failed. Check the API connection and retry.';
        this.isBusy = false;
        this.updateLines();
      },
    });
  }

  loadResource() {
    if (!this.kind || !this.name || this.isBusy) return;
    const kindMap: Record<string, string> = { Deployment: 'deployment', Service: 'service', ConfigMap: 'configmap', Secret: 'secret', Ingress: 'ingress', CronJob: 'cronjob', HPA: 'hpa' };
    const resource = kindMap[this.kind] || this.kind.toLowerCase();
    this.isBusy = true;
    this.actionState = 'loading';
    this.actionMessage = `Loading ${this.kind}/${this.name} from the current cluster...`;
    this.http.post<any>(`${this.base}/exec`, { command: `kubectl get ${resource} ${this.name} -o yaml` }).subscribe({
      next: (res) => {
        this.yaml = res.output || `# Could not fetch ${this.kind}/${this.name}`;
        this.showEditor = true;
        this.isLiveEdit = true;
        this.resourceNames = [];
        this.actionState = res.output ? 'loaded' : 'error';
        this.actionMessage = res.output ? 'Live manifest loaded. Review changes before applying.' : 'Resource returned no YAML.';
        this.isBusy = false;
        this.updateLines();
      },
      error: () => {
        this.yaml = `# Error fetching ${this.kind}/${this.name}`;
        this.showEditor = true;
        this.actionState = 'error';
        this.actionMessage = 'Resource could not be loaded. Check the name and cluster connection.';
        this.isBusy = false;
        this.updateLines();
      },
    });
  }

  onKindChange() {
    if (!this.kind) { this.resourceNames = []; return; }
    const kindMap: Record<string, string> = { Deployment: 'deployments', Service: 'services', ConfigMap: 'configmaps', Secret: 'secrets', Ingress: 'ingresses', CronJob: 'cronjobs', HPA: 'hpa' };
    const resource = kindMap[this.kind] || this.kind.toLowerCase() + 's';
    this.http.post<any>(`${this.base}/exec`, { command: `kubectl get ${resource} -o jsonpath='{.items[*].metadata.name}'` }).subscribe({
      next: (res) => {
        const names = (res.output || '').trim().replace(/'/g, '').split(/\s+/).filter((n: string) => n);
        this.resourceNames = names.slice(0, 20);
      },
      error: () => { this.resourceNames = []; },
    });
  }

  onYamlChange() {
    if (!this.isBusy && this.yaml.trim() && !['validating', 'applying'].includes(this.actionState)) {
      this.actionState = 'draft';
      this.actionMessage = 'Unsaved YAML changes. Validate before applying.';
    }
    this.updateLines();
  }

  apply() {
    if (!this.yaml.trim() || this.isBusy) return;
    this.confirmService.confirm({ title: 'Apply Manifest', message: `Apply this ${this.kind || 'resource'} manifest to the cluster?`, confirmLabel: 'Apply', severity: 'warning', productionGuard: true }).then(ok => {
      if (!ok) return;
      this.isDryRun = false;
      this.isBusy = true;
      this.actionState = 'applying';
      this.actionMessage = 'Applying manifest to the current cluster...';
      this.http.post<any>(`${this.base}/exec`, { command: `kubectl apply -f - <<EOF\n${this.yaml}\nEOF` }).subscribe({
        next: (res) => { this.result = res.output || 'Applied'; this.resultSuccess = res.exit_code === 0; this.actionState = this.resultSuccess ? 'applied' : 'error'; this.actionMessage = this.resultSuccess ? 'Manifest applied successfully.' : 'Apply returned an error. Review the output below.'; this.isBusy = false; },
        error: () => { this.result = 'Connection error'; this.resultSuccess = false; this.actionState = 'error'; this.actionMessage = 'Apply failed because the cluster connection could not be reached.'; this.isBusy = false; },
      });
    });
  }

  dryRun() {
    if (!this.yaml.trim() || this.isBusy) return;
    this.isDryRun = true;
    this.isBusy = true;
    this.actionState = 'validating';
    this.actionMessage = 'Validating manifest without applying changes...';
    this.http.post<any>(`${this.base}/exec`, { command: `kubectl apply --dry-run=client -f - <<EOF\n${this.yaml}\nEOF` }).subscribe({
      next: (res) => { this.result = res.output || 'Valid'; this.resultSuccess = res.exit_code === 0; this.actionState = this.resultSuccess ? 'validated' : 'error'; this.actionMessage = this.resultSuccess ? 'Validation passed. Manifest is ready for review.' : 'Validation failed. Fix the YAML and validate again.'; this.isBusy = false; },
      error: () => { this.result = 'Connection error'; this.resultSuccess = false; this.actionState = 'error'; this.actionMessage = 'Validation failed because the cluster connection could not be reached.'; this.isBusy = false; },
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
    this.actionState = 'ready';
    this.actionMessage = 'Choose a template or describe a resource to start.';
    this.updateLines();
  }

  updateLines() {
    const count = Math.max(this.yaml.split('\n').length, 1);
    this.lineNumbers = Array.from({ length: count }, (_, i) => i + 1);
  }
}
