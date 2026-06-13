import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { HoloCardComponent } from '../../shared/components/futuristic/holo-card.component';
import { MetricTileComponent } from '../../shared/components/futuristic/metric-tile.component';
import { StatusBeaconComponent } from '../../shared/components/futuristic/status-beacon.component';
import { ActionIconComponent } from '../../shared/components/futuristic/action-icon.component';
import { IntelHeaderComponent } from '../../shared/components/futuristic/intel-header.component';

interface RecentItem { type: string; name: string; namespace: string; }

@Component({
  selector: 'app-resources',
  standalone: true,
  imports: [FormsModule, Select, TagModule, TooltipModule, HoloCardComponent, MetricTileComponent, StatusBeaconComponent, ActionIconComponent, IntelHeaderComponent],
  templateUrl: './resources.html',
  styleUrl: './resources.scss',
})
export class ResourcesComponent implements OnInit {
  private http = inject(HttpClient);

  resourceTypes = ['pods', 'deployments', 'services', 'configmaps', 'secrets', 'ingresses', 'jobs', 'cronjobs', 'daemonsets', 'statefulsets', 'replicasets', 'hpa', 'pvc', 'nodes', 'namespaces'];
  namespaces: string[] = [];
  selectedType = '';
  selectedNamespace = '';
  searchName = '';
  describeSearch = '';
  listData: any[] = [];
  filteredList: any[] = [];
  describeData: any = null;
  describeView: 'parsed' | 'raw' | 'yaml' = 'parsed';
  infoFields: { key: string; value: string }[] = [];
  labelFields: string[] = [];
  detailFields: { key: string; value: string }[] = [];
  warningEvents: string[] = [];
  loading = false;
  error = '';
  recentResources: RecentItem[] = [];

  get healthyCount() { return this.listData.filter(i => this.normalizeStatus(i.status) === 'running').length; }
  get warningCount() { return this.listData.filter(i => this.normalizeStatus(i.status) === 'pending').length; }
  get failedCount() { return this.listData.filter(i => this.normalizeStatus(i.status) === 'failed').length; }

  get filteredDescribeRaw(): string {
    if (!this.describeData?.raw) return '';
    if (!this.describeSearch) return this.describeData.raw;
    const lines = this.describeData.raw.split('\n');
    const q = this.describeSearch.toLowerCase();
    return lines.filter((l: string) => l.toLowerCase().includes(q)).join('\n');
  }

  get filteredDetailFields(): { key: string; value: string }[] {
    if (!this.describeSearch) return this.detailFields;
    const q = this.describeSearch.toLowerCase();
    return this.detailFields.filter(f => f.key.toLowerCase().includes(q) || f.value.toLowerCase().includes(q));
  }

  ngOnInit() {
    this.loadNamespaces();
    this.loadRecent();
  }

  private loadNamespaces() {
    this.http.get<any>('/api/get/namespaces').subscribe({
      next: (res) => {
        const items = res.data?.items || [];
        this.namespaces = items.map((i: any) => i.metadata?.name).filter(Boolean);
      },
      error: () => {},
    });
  }

  onTypeChange() { this.listResources(); }

  onNamespaceChange() { if (this.selectedType) this.listResources(); }

  listResources() {
    if (!this.selectedType) return;
    this.loading = true; this.error = ''; this.describeData = null;
    const ns = this.selectedNamespace ? `?namespace=${this.selectedNamespace}` : '';
    this.http.get<any>(`/api/get/${this.selectedType}${ns}`).subscribe({
      next: (res) => {
        this.loading = false;
        const items = res.data?.items || [];
        this.listData = items.map((item: any) => ({
          name: item.metadata?.name,
          namespace: item.metadata?.namespace || '',
          status: this.extractStatus(item),
          ready: this.extractReady(item),
          age: this.formatAge(item.metadata?.creationTimestamp),
        }));
        this.filterList();
      },
      error: (err) => { this.loading = false; this.error = err.error?.detail || 'Failed'; this.listData = []; this.filteredList = []; },
    });
  }

  filterList() {
    if (!this.searchName) { this.filteredList = this.listData; return; }
    const q = this.searchName.toLowerCase();
    this.filteredList = this.listData.filter(i => i.name.toLowerCase().includes(q));
  }

  describeItem(name: string) {
    this.loading = true; this.error = ''; this.describeView = 'parsed'; this.describeSearch = '';
    const ns = this.selectedNamespace ? `?namespace=${this.selectedNamespace}` : '';
    this.http.get<any>(`/api/describe/${this.selectedType}/${name}${ns}`).subscribe({
      next: (res) => {
        this.loading = false;
        this.describeData = res;
        this.parseDescribe(res.parsed || {});
        this.addRecent({ type: this.selectedType, name, namespace: this.selectedNamespace });
      },
      error: (err) => { this.loading = false; this.error = err.error?.detail || 'Not found'; this.describeData = null; },
    });
  }

  describeRecent(item: RecentItem) {
    this.selectedType = item.type;
    this.selectedNamespace = item.namespace;
    this.describeItem(item.name);
  }

  copyRaw() { if (this.describeData?.raw) navigator.clipboard.writeText(this.describeData.raw); }

  setView(view: 'parsed' | 'raw' | 'yaml') { this.describeView = view; }

  backToList() { this.describeData = null; this.describeSearch = ''; }

  private parseDescribe(parsed: Record<string, string>) {
    const infoKeys = ['Name', 'Namespace', 'CreationTimestamp', 'Status', 'Phase', 'Replicas', 'Type', 'IP', 'Node'];
    this.infoFields = []; this.labelFields = []; this.detailFields = []; this.warningEvents = [];
    for (const [key, value] of Object.entries(parsed)) {
      if (infoKeys.includes(key)) this.infoFields.push({ key, value });
      else if (key === 'Labels' || key === 'Annotations') this.labelFields.push(...value.split('\n').map(l => l.trim()).filter(l => l));
      else this.detailFields.push({ key, value });
    }
    // Extract warning events
    const eventsField = parsed['Events'] || '';
    const warningPatterns = ['CrashLoopBackOff', 'ImagePullBackOff', 'FailedScheduling', 'OOMKilled', 'BackOff', 'Unhealthy', 'FailedMount', 'FailedCreate', 'Evicted'];
    const lines = eventsField.split('\n');
    for (const line of lines) {
      for (const pattern of warningPatterns) {
        if (line.includes(pattern) && !this.warningEvents.includes(pattern)) {
          this.warningEvents.push(pattern);
        }
      }
    }
  }

  private addRecent(item: RecentItem) {
    this.recentResources = [item, ...this.recentResources.filter(r => !(r.type === item.type && r.name === item.name))].slice(0, 5);
    try { localStorage.setItem('kubsome_recent_resources', JSON.stringify(this.recentResources)); } catch {}
  }

  private loadRecent() {
    try { this.recentResources = JSON.parse(localStorage.getItem('kubsome_recent_resources') || '[]'); } catch { this.recentResources = []; }
  }

  normalizeStatus(status: string): string {
    if (!status) return 'unknown';
    const s = status.toLowerCase();
    if (['running', 'active', 'available', 'bound', 'ready'].includes(s)) return 'running';
    if (['pending', 'progressing'].includes(s)) return 'pending';
    if (['failed', 'error', 'crashloopbackoff'].includes(s)) return 'failed';
    return 'unknown';
  }

  beaconStatus(status: string): 'ok' | 'warning' | 'critical' | 'idle' {
    const n = this.normalizeStatus(status);
    if (n === 'running') return 'ok';
    if (n === 'pending') return 'warning';
    if (n === 'failed') return 'critical';
    return 'idle';
  }

  tagSeverity(status: string): 'success' | 'warn' | 'danger' | 'secondary' {
    const n = this.normalizeStatus(status);
    if (n === 'running') return 'success';
    if (n === 'pending') return 'warn';
    if (n === 'failed') return 'danger';
    return 'secondary';
  }

  private extractStatus(item: any): string { return item.status?.phase || item.status?.conditions?.[0]?.type || ''; }
  private extractReady(item: any): string { const cs = item.status?.containerStatuses; if (cs) return `${cs.filter((c: any) => c.ready).length}/${cs.length}`; const r = item.status?.readyReplicas; const d = item.spec?.replicas; if (r !== undefined && d !== undefined) return `${r}/${d}`; return ''; }
  private formatAge(ts: string): string { if (!ts) return ''; const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000); if (mins < 60) return `${mins}m`; const hrs = Math.floor(mins / 60); if (hrs < 24) return `${hrs}h`; return `${Math.floor(hrs / 24)}d`; }
}
