import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { HoloCardComponent } from '../../shared/components/futuristic/holo-card.component';
import { MetricTileComponent } from '../../shared/components/futuristic/metric-tile.component';
import { StatusBeaconComponent } from '../../shared/components/futuristic/status-beacon.component';
import { CommandBarComponent } from '../../shared/components/futuristic/command-bar.component';
import type { CommandPill } from '../../shared/components/futuristic/command-bar.component';
import { LiveIndicatorComponent } from '../../shared/components/futuristic/live-indicator.component';
import { IntelHeaderComponent } from '../../shared/components/futuristic/intel-header.component';

@Component({
  selector: 'app-rbac',
  standalone: true,
  imports: [FormsModule, TagModule, ButtonModule, TooltipModule, HoloCardComponent, MetricTileComponent, StatusBeaconComponent, CommandBarComponent, LiveIndicatorComponent, IntelHeaderComponent],
  templateUrl: './rbac.html',
  styleUrl: './rbac.scss',
})
export class RbacComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  bindings: any[] = [];
  filtered: any[] = [];
  searchQuery = '';
  kindFilter = 'all';
  serviceAccounts: string[] = [];
  checkSubject = '';
  checkLoading = false;
  permMatrix: any = null;
  permVerbs = ['get', 'list', 'create', 'delete', 'update'];
  loading = false;
  autoRefresh = true;
  lastUpdated = '';
  private refreshTimer: any;

  get uniqueRoles() { return [...new Set(this.bindings.map(b => b.role))]; }
  get uniqueSubjects() { return new Set(this.bindings.map(b => b.subjects)).size; }
  get adminCount() { return this.bindings.filter(b => this.isAdmin(b)).length; }
  get filterPills(): CommandPill[] {
    return [
      { label: 'All', value: 'all', count: this.bindings.length },
      { label: 'RoleBinding', value: 'RoleBinding', color: 'cyan' },
      { label: 'ClusterRole', value: 'ClusterRoleBinding', color: 'amber' },
    ];
  }

  onFilterChange(v: string) { this.kindFilter = v; this.applyFilter(); }
  onSearchChange(v: string) { this.searchQuery = v; this.applyFilter(); }

  ngOnInit() { this.load(); this.loadServiceAccounts(); this.startAutoRefresh(); }
  ngOnDestroy() { clearInterval(this.refreshTimer); }
  toggleAutoRefresh() { this.autoRefresh = !this.autoRefresh; if (this.autoRefresh) this.startAutoRefresh(); else clearInterval(this.refreshTimer); }
  private startAutoRefresh() { clearInterval(this.refreshTimer); this.refreshTimer = setInterval(() => this.load(), 30000); }

  load() { this.loading = true; this.http.get<any>('/api/rbac').subscribe({ next: (res) => { this.bindings = res.bindings || []; this.applyFilter(); this.loading = false; this.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }, error: () => { this.loading = false; } }); }
  loadServiceAccounts() { this.http.get<any>('/api/rbac/service-accounts').subscribe({ next: (res) => { this.serviceAccounts = res.accounts || []; } }); }
  checkPermissions() { if (!this.checkSubject) return; this.checkLoading = true; this.permMatrix = null; this.http.get<any>('/api/rbac/check', { params: { subject: this.checkSubject } }).subscribe({ next: (res) => { this.permMatrix = res; this.checkLoading = false; }, error: () => { this.checkLoading = false; } }); }

  applyFilter() {
    let result = this.bindings;
    if (this.kindFilter !== 'all') result = result.filter(b => b.kind === this.kindFilter);
    if (this.searchQuery) { const q = this.searchQuery.toLowerCase(); result = result.filter(b => (b.name || '').toLowerCase().includes(q) || (b.role || '').toLowerCase().includes(q)); }
    this.filtered = result.sort((a, b) => { if (this.isAdmin(a) && !this.isAdmin(b)) return -1; if (!this.isAdmin(a) && this.isAdmin(b)) return 1; return (a.name || '').localeCompare(b.name || ''); });
  }

  isAdmin(b: any): boolean { return (b.role || '').toLowerCase().includes('admin'); }
  permLevel(b: any): string { const r = (b.role || '').toLowerCase(); if (r.includes('admin')) return 'admin'; if (r.includes('edit')) return 'edit'; if (r.includes('view')) return 'view'; return 'custom'; }
  parseSubjects(subjects: string): { name: string; type: string }[] { if (!subjects) return []; return subjects.split(',').map(s => { const t = s.trim(); if (t.includes('ServiceAccount')) return { name: t, type: 'sa' }; if (t.includes('Group')) return { name: t, type: 'group' }; return { name: t, type: 'user' }; }); }
}
