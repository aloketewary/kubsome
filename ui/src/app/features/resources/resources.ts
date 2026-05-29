import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { Select } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { SpotlightComponent } from '../../shared/components/spotlight.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';


@Component({
  selector: 'app-resources',
  standalone: true,
  imports: [FormsModule, ButtonModule, Select, InputTextModule, TooltipModule, TagModule, SpotlightComponent, PageHeaderComponent],
  templateUrl: './resources.html',
  styleUrl: './resources.scss',
})
export class ResourcesComponent implements OnInit {
  private http = inject(HttpClient);

  resourceTypes = [
    'pods', 'deployments', 'services', 'configmaps', 'secrets',
    'ingresses', 'jobs', 'cronjobs', 'daemonsets', 'statefulsets',
    'replicasets', 'hpa', 'pvc', 'nodes', 'namespaces',
  ];
  selectedType = '';
  searchName = '';
  listData: any[] = [];
  filteredList: any[] = [];
  describeData: any = null;
  infoFields: { key: string; value: string }[] = [];
  labelFields: string[] = [];
  detailFields: { key: string; value: string }[] = [];
  loading = false;
  error = '';

  ngOnInit() {}

  listResources() {
    if (!this.selectedType) return;
    this.loading = true;
    this.error = '';
    this.describeData = null;
    this.http.get<any>(`/api/get/${this.selectedType}`).subscribe({
      next: (res) => {
        this.loading = false;
        const items = res.data?.items || [];
        this.listData = items.map((item: any) => ({
          name: item.metadata?.name,
          status: this.extractStatus(item),
          ready: this.extractReady(item),
          age: this.formatAge(item.metadata?.creationTimestamp),
        }));
        this.filterList();
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.detail || 'Failed to list resources';
        this.listData = [];
        this.filteredList = [];
      },
    });
  }

  filterList() {
    if (!this.searchName) { this.filteredList = this.listData; return; }
    const q = this.searchName.toLowerCase();
    this.filteredList = this.listData.filter(i => i.name.toLowerCase().includes(q));
  }

  describeByName() {
    if (this.searchName) this.describeItem(this.searchName);
  }

  describeItem(name: string) {
    this.loading = true;
    this.error = '';
    this.http.get<any>(`/api/describe/${this.selectedType}/${name}`).subscribe({
      next: (res) => {
        this.loading = false;
        this.describeData = res;
        this.parseDescribe(res.parsed || {});
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.detail || 'Resource not found';
        this.describeData = null;
      },
    });
  }

  copyRaw() {
    if (this.describeData?.raw) navigator.clipboard.writeText(this.describeData.raw);
  }

  private parseDescribe(parsed: Record<string, string>) {
    const infoKeys = ['Name', 'Namespace', 'CreationTimestamp', 'Status', 'Phase', 'Replicas', 'StrategyType', 'Selector', 'Type', 'IP', 'Port', 'Node'];
    const labelKeys = ['Labels', 'Annotations'];

    this.infoFields = [];
    this.labelFields = [];
    this.detailFields = [];

    for (const [key, value] of Object.entries(parsed)) {
      if (infoKeys.includes(key)) {
        this.infoFields.push({ key, value });
      } else if (labelKeys.includes(key)) {
        const items = value.split('\n').map(l => l.trim()).filter(l => l);
        this.labelFields.push(...items);
      } else {
        this.detailFields.push({ key, value });
      }
    }
  }

  isHighlight(key: string, value: string): boolean {
    if (key === 'Status' || key === 'Phase') return value === 'Running' || value === 'Active';
    if (key === 'Replicas') return value.includes('available') && !value.includes('unavailable');
    return false;
  }

  normalizeStatus(status: string): string {
    if (!status) return 'unknown';
    const s = status.toLowerCase();
    if (['running', 'active', 'available', 'bound', 'ready', 'true'].includes(s)) return 'running';
    if (['pending', 'progressing', 'containercreating'].includes(s)) return 'pending';
    if (['failed', 'error', 'crashloopbackoff', 'imagepullbackoff', 'evicted'].includes(s)) return 'failed';
    return 'unknown';
  }

  tagSeverity(status: string): 'success' | 'warn' | 'danger' | 'secondary' | undefined {
    const n = this.normalizeStatus(status);
    if (n === 'running') return 'success';
    if (n === 'pending') return 'warn';
    if (n === 'failed') return 'danger';
    return 'secondary';
  }

  private extractStatus(item: any): string {
    return item.status?.phase || item.status?.conditions?.[0]?.type || '';
  }

  private extractReady(item: any): string {
    const cs = item.status?.containerStatuses;
    if (cs) {
      const ready = cs.filter((c: any) => c.ready).length;
      return `${ready}/${cs.length}`;
    }
    const replicas = item.status?.readyReplicas;
    const desired = item.spec?.replicas;
    if (replicas !== undefined && desired !== undefined) return `${replicas}/${desired}`;
    return '';
  }

  private formatAge(ts: string): string {
    if (!ts) return '';
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  }
}
