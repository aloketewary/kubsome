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
  template: `
    <app-spotlight id="resources" title="Resources" icon="pi pi-database"
      description="Browse all Kubernetes resource types with describe views."
      [capabilities]="['Multi-resource browser', 'Describe view', 'YAML output']" [compact]="true" />

        <!-- Header -->
    <app-page-header title="Resources" subtitle="Browse & describe Kubernetes resources">
        <button pButton icon="pi pi-refresh" class="p-button-outlined p-button-sm p-button-rounded" (click)="listResources()" pTooltip="Refresh"></button>
    </app-page-header>

    <!-- Controls -->
    <div class="summary-strip">
      <div class="control-group">
        <p-select [options]="resourceTypes" [(ngModel)]="selectedType" placeholder="Resource type..."
                  [style]="{ width: '180px' }" [filter]="true" (ngModelChange)="listResources()" />
      </div>
      <div class="search-wrap">
        <i class="pi pi-search"></i>
        <input pInputText [(ngModel)]="searchName" placeholder="Fuzzy search name..." (ngModelChange)="filterList()" (keydown.enter)="describeByName()" />
      </div>
      @if (listData.length > 0) {
        <div class="summary-pill">
          <span class="pill-value">{{ filteredList.length }}</span>
          <span class="pill-label">{{ selectedType }}</span>
        </div>
      }
    </div>

    <!-- List View -->
    @if (filteredList.length > 0 && !describeData) {
      <div class="resource-list">
        @for (item of filteredList; track item.name) {
          <div class="res-row" (click)="describeItem(item.name)">
            <div class="res-dot" [class]="'dot-' + normalizeStatus(item.status)"></div>
            <span class="res-name mono">{{ item.name }}</span>
            @if (item.status) {
              <p-tag [value]="item.status" [severity]="tagSeverity(item.status)" />
            }
            @if (item.ready) {
              <span class="res-ready">{{ item.ready }}</span>
            }
            @if (item.age) {
              <span class="res-age">{{ item.age }}</span>
            }
            <div class="res-actions">
              <i class="pi pi-search" pTooltip="Describe"></i>
            </div>
          </div>
        }
      </div>
    }

    <!-- Describe Panel (fullscreen overlay) -->
    @if (describeData) {
      <div class="describe-overlay">
        <div class="describe-container">
          <!-- Header -->
          <div class="desc-header">
            <div class="desc-title-row">
              <span class="desc-badge">{{ describeData.resource }}</span>
              <h2>{{ describeData.name }}</h2>
            </div>
            <div class="desc-header-actions">
              <button pButton icon="pi pi-copy" class="p-button-sm p-button-text p-button-rounded" pTooltip="Copy raw" (click)="copyRaw()"></button>
              <button pButton icon="pi pi-window-minimize" class="p-button-sm p-button-text p-button-rounded" pTooltip="Close" (click)="describeData = null"></button>
            </div>
          </div>

          <!-- Body -->
          <div class="desc-body">
            <!-- Info Panel -->
            <div class="desc-panel">
              <div class="panel-title"><i class="pi pi-info-circle"></i> Overview</div>
              <div class="kv-grid">
                @for (item of infoFields; track item.key) {
                  <div class="kv-row">
                    <span class="kv-key">{{ item.key }}</span>
                    <span class="kv-val" [class.kv-status]="isHighlight(item.key, item.value)">{{ item.value }}</span>
                  </div>
                }
              </div>
            </div>

            <!-- Labels -->
            @if (labelFields.length > 0) {
              <div class="desc-panel">
                <div class="panel-title"><i class="pi pi-tag"></i> Labels & Annotations</div>
                <div class="tag-list">
                  @for (lbl of labelFields; track lbl) {
                    <span class="label-chip">{{ lbl }}</span>
                  }
                </div>
              </div>
            }

            <!-- Remaining Sections -->
            @if (detailFields.length > 0) {
              <div class="desc-panel">
                <div class="panel-title"><i class="pi pi-list"></i> Details</div>
                <div class="kv-grid">
                  @for (item of detailFields; track item.key) {
                    <div class="kv-row">
                      <span class="kv-key">{{ item.key }}</span>
                      <span class="kv-val mono-sm">{{ item.value }}</span>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    }

    <!-- Empty -->
    @if (filteredList.length === 0 && !describeData && !loading && selectedType) {
      <div class="empty-state">
        <i class="pi pi-inbox"></i>
        <span>No {{ selectedType }} found</span>
      </div>
    }
    @if (!selectedType && !loading) {
      <div class="empty-state">
        <i class="pi pi-database"></i>
        <span>Select a resource type to browse</span>
      </div>
    }
    @if (loading) {
      <div class="empty-state"><div class="spin"></div> Loading...</div>
    }
    @if (error) {
      <div class="error-banner"><i class="pi pi-exclamation-triangle"></i> {{ error }}</div>
    }
  `,
  styles: [`


    .summary-strip {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 16px; margin-bottom: 16px;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-sm);
    }
    .control-group { display: flex; align-items: center; gap: 8px; }
    .search-wrap { position: relative; flex: 1; max-width: 280px; }
    .search-wrap i { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 13px; }
    .search-wrap input { padding-left: 32px !important; width: 100%; }
    .summary-pill {
      display: flex; align-items: center; gap: 6px; padding: 4px 12px;
      border-radius: 20px; background: var(--bg-elevated); font-size: 12px; margin-left: auto;
    }
    .pill-value { font-weight: 600; }
    .pill-label { color: var(--text-muted); }

    /* List */
    .resource-list {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
      overflow: hidden;
    }
    .res-row {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 16px; cursor: pointer; transition: background 0.1s;
      border-bottom: 1px solid var(--border);
    }
    .res-row:last-child { border-bottom: none; }
    .res-row:hover { background: var(--bg-hover); }
    .res-row:hover .res-actions { opacity: 1; }
    .res-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .dot-running, .dot-active, .dot-available, .dot-bound, .dot-ready { background: var(--success); }
    .dot-pending, .dot-progressing { background: var(--warning); animation: pulse 2s infinite; }
    .dot-failed, .dot-error, .dot-crashloopbackoff { background: var(--danger); }
    .dot-unknown { background: var(--text-muted); }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
    .res-name { flex: 1; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .res-ready { font-size: 10px; color: var(--text-muted); font-family: 'JetBrains Mono', monospace; }
    .res-age { font-size: 10px; color: var(--text-muted); }
    .res-actions { display: flex; gap: 6px; opacity: 0; transition: opacity 0.15s; }
    .res-actions i { font-size: 13px; color: var(--text-muted); padding: 4px; border-radius: 4px; }
    .res-actions i:hover { color: var(--accent); background: var(--accent-subtle); }
    .mono { font-family: 'JetBrains Mono', monospace; font-size: 11px; }

    /* Describe Overlay */
    .describe-overlay {
      position: fixed; inset: 0; z-index: 9000; background: var(--bg);
      display: flex; flex-direction: column;
    }
    .describe-container { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
    .desc-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 24px; border-bottom: 1px solid var(--border); background: var(--bg-elevated);
    }
    .desc-title-row { display: flex; align-items: center; gap: 10px; }
    .desc-badge {
      font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 3px 8px;
      background: var(--accent-subtle); color: var(--accent); border-radius: 4px; letter-spacing: 0.03em;
    }
    .desc-header h2 { font-size: 18px; font-weight: 700; margin: 0; }
    .desc-header-actions { display: flex; gap: 4px; }
    .desc-body { flex: 1; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 16px; }

    /* Panels */
    .desc-panel {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
      overflow: hidden;
    }
    .panel-title {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 16px; font-size: 12px; font-weight: 600; color: var(--text-secondary);
      background: var(--bg-elevated); border-bottom: 1px solid var(--border);
    }
    .panel-title i { font-size: 13px; color: var(--accent); }
    .kv-grid { padding: 12px 16px; overflow: hidden; }
    .kv-row { display: flex; padding: 6px 0; border-bottom: 1px solid var(--border); gap: 12px; }
    .kv-row:last-child { border-bottom: none; }
    .kv-key {
      min-width: 160px; max-width: 160px; font-size: 11px; font-weight: 600; color: var(--accent);
      font-family: 'JetBrains Mono', monospace; flex-shrink: 0;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .kv-val {
      flex: 1; font-size: 11px; color: var(--text-secondary);
      white-space: pre-wrap; word-break: break-word; overflow-wrap: break-word;
      max-height: 120px; overflow-y: auto; line-height: 1.5;
    }
    .kv-status { font-weight: 600; color: var(--success); }
    .mono-sm { font-family: 'JetBrains Mono', monospace; font-size: 10px; }

    /* Labels */
    .tag-list { display: flex; flex-wrap: wrap; gap: 6px; padding: 12px 16px; max-height: 200px; overflow-y: auto; }
    .label-chip {
      font-size: 10px; padding: 3px 8px; border-radius: 4px;
      background: var(--bg-elevated); border: 1px solid var(--border);
      font-family: 'JetBrains Mono', monospace; color: var(--text-secondary);
      max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

    /* States */
    .empty-state {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      padding: 56px; color: var(--text-muted); font-size: 13px;
    }
    .empty-state i { font-size: 28px; opacity: 0.3; }
    .error-banner {
      display: flex; align-items: center; gap: 8px; padding: 12px 16px;
      background: var(--danger-subtle); border-radius: var(--radius-sm);
      font-size: 12px; color: var(--danger); margin-top: 12px;
    }
    .spin { width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (max-width: 768px) {
      .resource-grid { grid-template-columns: 1fr; }
    }
  `],
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
