import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ApiService } from '../../core/services/api.service';
import { ResourceDescribeResponse, ResourceSummary } from '../../core/models';
import { HoloCardComponent } from '../../shared/components/futuristic/holo-card.component';
import { MetricTileComponent } from '../../shared/components/futuristic/metric-tile.component';
import { StatusBeaconComponent } from '../../shared/components/futuristic/status-beacon.component';
import { ActionIconComponent } from '../../shared/components/futuristic/action-icon.component';
import { CommandBarComponent } from '../../shared/components/futuristic/command-bar.component';
import type { CommandPill } from '../../shared/components/futuristic/command-bar.component';
import { IntelHeaderComponent } from '../../shared/components/futuristic/intel-header.component';

interface RecentItem { type: string; name: string; namespace: string; }

type CopyState = 'idle' | 'copied' | 'failed';
type ResourceStatusFilter = 'all' | 'healthy' | 'pending' | 'failed' | 'unknown';

@Component({
  selector: 'app-resources',
  standalone: true,
  imports: [FormsModule, Select, TagModule, TooltipModule, HoloCardComponent, MetricTileComponent, StatusBeaconComponent, ActionIconComponent, CommandBarComponent, IntelHeaderComponent],
  templateUrl: './resources.html',
  styleUrl: './resources.scss',
})
export class ResourcesComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private copyTimer?: ReturnType<typeof setTimeout>;

  resourceTypes = ['pods', 'deployments', 'services', 'configmaps', 'secrets', 'ingresses', 'jobs', 'cronjobs', 'daemonsets', 'statefulsets', 'replicasets', 'hpa', 'pvc', 'nodes', 'namespaces'];
  namespaces: string[] = [];
  selectedType = '';
  selectedNamespace = '';
  searchName = '';
  describeSearch = '';
  listData: ResourceSummary[] = [];
  filteredList: ResourceSummary[] = [];
  describeData: ResourceDescribeResponse | null = null;
  describeTarget = '';
  describeView: 'parsed' | 'raw' | 'yaml' = 'parsed';
  infoFields: { key: string; value: string }[] = [];
  labelFields: string[] = [];
  detailFields: { key: string; value: string }[] = [];
  warningEvents: string[] = [];
  listLoading = false;
  describeLoading = false;
  namespaceLoading = false;
  listError = '';
  describeError = '';
  copyState: CopyState = 'idle';
  recentResources: RecentItem[] = [];
  statusFilter: ResourceStatusFilter = 'all';

  get loading() { return this.listLoading || this.describeLoading || this.namespaceLoading; }
  get showingDetails() { return Boolean(this.describeData || this.describeLoading || this.describeError); }
  get healthyCount() { return this.listData.filter(i => this.normalizeStatus(i.status) === 'running').length; }
  get warningCount() { return this.listData.filter(i => this.normalizeStatus(i.status) === 'pending').length; }
  get failedCount() { return this.listData.filter(i => this.normalizeStatus(i.status) === 'failed').length; }
  get unknownCount() { return this.listData.filter(i => this.normalizeStatus(i.status) === 'unknown').length; }

  get filterPills(): CommandPill[] {
    const pills: CommandPill[] = [
      { label: 'All', value: 'all', count: this.listData.length },
      { label: 'Healthy', value: 'healthy', count: this.healthyCount, color: 'green' },
    ];
    if (this.warningCount > 0) pills.push({ label: 'Pending', value: 'pending', count: this.warningCount, color: 'amber' });
    if (this.failedCount > 0) pills.push({ label: 'Failed', value: 'failed', count: this.failedCount, color: 'red' });
    if (this.unknownCount > 0) pills.push({ label: 'Unknown', value: 'unknown', count: this.unknownCount, color: 'purple' });
    return pills;
  }

  get filteredDescribeRaw(): string {
    if (!this.describeData?.raw) return '';
    if (!this.describeSearch) return this.describeData.raw;
    const lines = this.describeData.raw.split('\n');
    const q = this.describeSearch.toLowerCase();
    return lines.filter(line => line.toLowerCase().includes(q)).join('\n');
  }

  get filteredDetailFields(): { key: string; value: string }[] {
    if (!this.describeSearch) return this.detailFields;
    const q = this.describeSearch.toLowerCase();
    return this.detailFields.filter(field => field.key.toLowerCase().includes(q) || field.value.toLowerCase().includes(q));
  }

  ngOnInit() {
    this.loadNamespaces();
    this.loadRecent();
  }

  ngOnDestroy() {
    if (this.copyTimer) clearTimeout(this.copyTimer);
  }

  private loadNamespaces() {
    this.namespaceLoading = true;
    this.api.getNamespaces().subscribe({
      next: (res) => {
        this.namespaces = res.namespaces || [];
        this.namespaceLoading = false;
      },
      error: () => { this.namespaceLoading = false; },
    });
  }

  onTypeChange() {
    this.statusFilter = 'all';
    this.backToList();
    this.listResources();
  }

  onStatusFilterChange(value: string) {
    if (['all', 'healthy', 'pending', 'failed', 'unknown'].includes(value)) {
      this.statusFilter = value as ResourceStatusFilter;
      this.filterList();
    }
  }

  onNamespaceChange() {
    if (this.selectedType) this.listResources();
  }

  listResources() {
    if (!this.selectedType) return;
    this.listLoading = true;
    this.listError = '';
    this.describeData = null;
    this.describeError = '';
    this.api.getResource(this.selectedType, this.selectedNamespace).subscribe({
      next: (res) => {
        this.listData = (res.data?.items || []).map((item: any) => ({
          name: item.metadata?.name || 'Unnamed resource',
          namespace: item.metadata?.namespace || '',
          status: this.extractStatus(item),
          ready: this.extractReady(item),
          age: this.formatAge(item.metadata?.creationTimestamp),
        }));
        this.filterList();
        this.listLoading = false;
      },
      error: (err) => {
        this.listLoading = false;
        this.listError = err.error?.detail || 'Failed to load resources.';
        this.listData = [];
        this.filteredList = [];
      },
    });
  }

  filterList() {
    const query = this.searchName.trim().toLowerCase();
    const statusFiltered = this.statusFilter === 'all'
      ? this.listData
      : this.listData.filter(item => this.normalizeStatus(item.status) === (this.statusFilter === 'healthy' ? 'running' : this.statusFilter));
    this.filteredList = query
      ? statusFiltered.filter(item => item.name.toLowerCase().includes(query))
      : [...statusFiltered];
  }

  describeItem(name: string) {
    if (!this.selectedType) return;
    this.describeLoading = true;
    this.describeError = '';
    this.describeData = null;
    this.describeTarget = name;
    this.describeView = 'parsed';
    this.describeSearch = '';
    this.copyState = 'idle';
    this.api.describeResource(this.selectedType, name, this.selectedNamespace).subscribe({
      next: (res) => {
        this.describeData = res;
        this.parseDescribe(res.parsed || {});
        this.addRecent({ type: this.selectedType, name: res.name || name, namespace: this.selectedNamespace });
        this.describeLoading = false;
      },
      error: (err) => {
        this.describeLoading = false;
        this.describeError = err.error?.detail || `Unable to describe ${name}.`;
      },
    });
  }

  describeRecent(item: RecentItem) {
    this.selectedType = item.type;
    this.selectedNamespace = item.namespace;
    this.describeItem(item.name);
  }

  async copyRaw() {
    if (!this.describeData?.raw) return;
    try {
      await navigator.clipboard.writeText(this.describeData.raw);
      this.copyState = 'copied';
    } catch {
      this.copyState = 'failed';
    }
    if (this.copyTimer) clearTimeout(this.copyTimer);
    this.copyTimer = setTimeout(() => this.copyState = 'idle', 2400);
  }

  setView(view: 'parsed' | 'raw' | 'yaml') { this.describeView = view; }

  backToList() {
    this.describeData = null;
    this.describeTarget = '';
    this.describeError = '';
    this.describeLoading = false;
    this.describeSearch = '';
    this.copyState = 'idle';
  }

  private parseDescribe(parsed: Record<string, string>) {
    const infoKeys = ['Name', 'Namespace', 'CreationTimestamp', 'Status', 'Phase', 'Replicas', 'Type', 'IP', 'Node'];
    this.infoFields = [];
    this.labelFields = [];
    this.detailFields = [];
    this.warningEvents = [];
    for (const [key, value] of Object.entries(parsed)) {
      if (infoKeys.includes(key)) this.infoFields.push({ key, value });
      else if (key === 'Labels' || key === 'Annotations') this.labelFields.push(...value.split('\n').map(line => line.trim()).filter(Boolean));
      else this.detailFields.push({ key, value });
    }
    const eventsField = parsed['Events'] || '';
    const warningPatterns = ['CrashLoopBackOff', 'ImagePullBackOff', 'FailedScheduling', 'OOMKilled', 'BackOff', 'Unhealthy', 'FailedMount', 'FailedCreate', 'Evicted'];
    for (const line of eventsField.split('\n')) {
      for (const pattern of warningPatterns) {
        if (line.includes(pattern) && !this.warningEvents.includes(pattern)) this.warningEvents.push(pattern);
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
    const normalized = status.toLowerCase();
    if (['running', 'active', 'available', 'bound', 'ready', 'complete'].includes(normalized)) return 'running';
    if (['pending', 'progressing', 'containercreating'].includes(normalized)) return 'pending';
    if (['failed', 'error', 'crashloopbackoff'].includes(normalized)) return 'failed';
    return 'unknown';
  }

  beaconStatus(status: string): 'ok' | 'warning' | 'critical' | 'idle' {
    const normalized = this.normalizeStatus(status);
    if (normalized === 'running') return 'ok';
    if (normalized === 'pending') return 'warning';
    if (normalized === 'failed') return 'critical';
    return 'idle';
  }

  tagSeverity(status: string): 'success' | 'warn' | 'danger' | 'secondary' {
    const normalized = this.normalizeStatus(status);
    if (normalized === 'running') return 'success';
    if (normalized === 'pending') return 'warn';
    if (normalized === 'failed') return 'danger';
    return 'secondary';
  }

  private extractStatus(item: any): string {
    return item.status?.phase || item.status?.conditions?.find((condition: any) => condition.status === 'True')?.type || 'Unknown';
  }

  private extractReady(item: any): string {
    const containerStatuses = item.status?.containerStatuses;
    if (containerStatuses) return `${containerStatuses.filter((container: any) => container.ready).length}/${containerStatuses.length}`;
    const ready = item.status?.readyReplicas;
    const desired = item.spec?.replicas;
    if (ready !== undefined && desired !== undefined) return `${ready}/${desired}`;
    return '';
  }

  private formatAge(timestamp: string): string {
    if (!timestamp) return '';
    const minutes = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  }
}
