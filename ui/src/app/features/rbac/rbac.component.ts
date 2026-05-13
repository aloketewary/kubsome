import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { SpotlightComponent } from '../../shared/components/spotlight.component';

@Component({
  selector: 'app-rbac',
  standalone: true,
  imports: [TagModule, ButtonModule, TooltipModule, FormsModule, InputTextModule, SpotlightComponent],
  template: `
    <app-spotlight id="rbac" title="RBAC" icon="pi pi-lock"
      description="View role bindings and access control configuration."
      [capabilities]="['Role bindings', 'Service accounts', 'Permission overview']" [compact]="true" />

        <div class="page-header">
      <div>
        <h1>RBAC</h1>
        <p class="subtitle">Access control bindings</p>
      </div>
      <button pButton icon="pi pi-refresh" class="p-button-outlined p-button-sm p-button-rounded" (click)="load()" pTooltip="Refresh"></button>
    </div>

    <!-- Summary -->
    <div class="summary-strip">
      <div class="summary-pill">
        <i class="pi pi-shield"></i>
        <span class="pill-val">{{ bindings.length }}</span>
        <span class="pill-label">Bindings</span>
      </div>
      <div class="summary-pill">
        <i class="pi pi-key"></i>
        <span class="pill-val">{{ uniqueRoles.length }}</span>
        <span class="pill-label">Roles</span>
      </div>
      <div class="summary-pill">
        <i class="pi pi-users"></i>
        <span class="pill-val">{{ uniqueSubjects }}</span>
        <span class="pill-label">Subjects</span>
      </div>
      @if (adminCount > 0) {
        <div class="summary-pill pill-warn">
          <span class="pill-dot dot-warn"></span>
          <span class="pill-val">{{ adminCount }}</span>
          <span class="pill-label">Admin Access</span>
        </div>
      }
    </div>

    <!-- Permission Checker -->
    <div class="checker-card">
      <div class="checker-header">
        <i class="pi pi-question-circle"></i>
        <span>Can user/SA do X?</span>
      </div>
      <div class="checker-form">
        <select class="checker-select" [(ngModel)]="checkSubject">
          <option value="">Select service account...</option>
          @for (sa of serviceAccounts; track sa) {
            <option [value]="sa">{{ sa }}</option>
          }
        </select>
        <button pButton label="Check Permissions" icon="pi pi-search" class="p-button-sm" (click)="checkPermissions()" [disabled]="!checkSubject || checkLoading"></button>
      </div>
      @if (permMatrix) {
        <div class="perm-matrix">
          <div class="pm-header">
            <span class="pm-resource-col">Resource</span>
            @for (v of permVerbs; track v) {
              <span class="pm-verb">{{ v }}</span>
            }
          </div>
          @for (row of permMatrix.resources; track row.resource) {
            <div class="pm-row">
              <span class="pm-resource">{{ row.resource }}</span>
              @for (v of permVerbs; track v) {
                <span class="pm-cell" [class.pm-yes]="row.permissions[v]" [class.pm-no]="!row.permissions[v]">
                  {{ row.permissions[v] ? '✓' : '✗' }}
                </span>
              }
            </div>
          }
        </div>
      }
    </div>

    <!-- Filters -->
    <div class="filter-bar">
      <div class="filter-pills">
        <button class="fpill" [class.active]="kindFilter === 'all'" (click)="kindFilter = 'all'; applyFilter()">All</button>
        <button class="fpill" [class.active]="kindFilter === 'RoleBinding'" (click)="kindFilter = 'RoleBinding'; applyFilter()">RoleBinding</button>
        <button class="fpill" [class.active]="kindFilter === 'ClusterRoleBinding'" (click)="kindFilter = 'ClusterRoleBinding'; applyFilter()">ClusterRoleBinding</button>
      </div>
      <div class="search-wrap">
        <i class="pi pi-search"></i>
        <input pInputText [(ngModel)]="searchQuery" placeholder="Search..." (ngModelChange)="applyFilter()" />
      </div>
    </div>

    <!-- Bindings List -->
    <div class="binding-list">
      @for (b of filtered; track $index) {
        <div class="binding-card" [class.binding-cluster]="b.kind === 'ClusterRoleBinding'" [class.binding-admin]="isAdmin(b)">
          <div class="binding-left">
            <div class="binding-icon" [class]="roleClass(b)">
              <i class="pi pi-shield"></i>
            </div>
          </div>
          <div class="binding-body">
            <div class="binding-top">
              <code class="binding-name">{{ b.name }}</code>
              <p-tag [value]="b.kind" [severity]="b.kind === 'ClusterRoleBinding' ? 'warn' : 'info'" [rounded]="true" />
              @if (isAdmin(b)) {
                <p-tag value="ADMIN" severity="danger" [rounded]="true" />
              }
            </div>
            <div class="binding-role">
              <span class="role-label">Role:</span>
              <code class="role-name">{{ b.role }}</code>
              <span class="role-level" [class]="'level-' + permLevel(b)">{{ permLevel(b) }}</span>
            </div>
            <div class="binding-subjects">
              <span class="subjects-label">Subjects:</span>
              <div class="subject-chips">
                @for (subject of parseSubjects(b.subjects); track $index) {
                  <span class="subject-chip" [class]="'sc-' + subject.type">
                    <i class="pi" [class]="subjectIcon(subject.type)"></i>
                    {{ subject.name }}
                  </span>
                }
              </div>
            </div>
          </div>
        </div>
      }

      @if (filtered.length === 0 && searchQuery) {
        <div class="empty-state"><i class="pi pi-search"></i> No bindings matching "{{ searchQuery }}"</div>
      }
      @if (filtered.length === 0 && !searchQuery) {
        <div class="empty-state"><i class="pi pi-shield"></i> No RBAC bindings found</div>
      }
    </div>
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

    /* Summary */
    .summary-strip {
      display: flex; gap: 8px; margin-bottom: 16px;
      padding: 14px 18px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
    }
    .summary-pill { display: flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px; background: var(--bg-elevated); font-size: 12px; }
    .summary-pill i { font-size: 12px; color: var(--text-muted); }
    .pill-warn { background: var(--warning-subtle); }
    .pill-dot { width: 6px; height: 6px; border-radius: 50%; }
    .dot-warn { background: var(--warning); }
    .pill-val { font-weight: 700; }
    .pill-label { color: var(--text-muted); }

    /* Permission Checker */
    .checker-card {
      padding: 16px 18px; margin-bottom: 16px;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
    }
    .checker-header { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; margin-bottom: 12px; }
    .checker-header i { color: var(--accent); }
    .checker-form { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }
    .checker-select {
      padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border);
      background: var(--bg-elevated); color: var(--text); font-size: 12px; outline: none; min-width: 200px;
    }
    .checker-select:focus { border-color: var(--accent); }
    .perm-matrix { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
    .pm-header {
      display: grid; grid-template-columns: 120px repeat(5, 1fr);
      padding: 8px 12px; background: var(--bg-elevated); border-bottom: 1px solid var(--border);
      font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase;
    }
    .pm-row {
      display: grid; grid-template-columns: 120px repeat(5, 1fr);
      padding: 6px 12px; border-bottom: 1px solid var(--border); font-size: 12px;
    }
    .pm-row:last-child { border-bottom: none; }
    .pm-row:hover { background: var(--bg-hover); }
    .pm-resource { font-family: 'JetBrains Mono', monospace; font-size: 11px; }
    .pm-resource-col { font-family: 'JetBrains Mono', monospace; }
    .pm-verb, .pm-cell { text-align: center; }
    .pm-yes { color: var(--success); font-weight: 700; }
    .pm-no { color: var(--danger); opacity: 0.5; }

    /* Filters */
    .filter-bar {
      display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;
    }
    .filter-pills { display: flex; gap: 4px; }
    .fpill {
      padding: 5px 12px; border: 1px solid var(--border); border-radius: 6px;
      background: var(--bg-card); font-size: 11px; color: var(--text-muted);
      cursor: pointer; transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
    }
    .fpill:hover { border-color: var(--border-hover); color: var(--text); }
    .fpill.active { border-color: var(--accent); background: var(--accent-subtle); color: var(--accent); }
    .search-wrap { position: relative; }
    .search-wrap i { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 12px; }
    .search-wrap input { padding-left: 30px !important; width: 180px; }

    /* Binding Cards */
    .binding-list { display: flex; flex-direction: column; gap: 6px; }
    .binding-card {
      display: flex; gap: 12px; padding: 14px 16px;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
      transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
    }
    .binding-card:hover { border-color: var(--border-hover); transform: translateY(-2px); box-shadow: 0 8px 24px -8px rgba(0,0,0,0.2); }
    .binding-cluster { border-left: 3px solid var(--warning); }
    .binding-admin { border-left: 3px solid var(--danger); }

    .binding-left { flex-shrink: 0; }
    .binding-icon {
      width: 32px; height: 32px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center; font-size: 14px;
    }
    .binding-icon.role-admin { background: var(--danger-subtle); color: var(--danger); }
    .binding-icon.role-edit { background: var(--warning-subtle); color: var(--warning); }
    .binding-icon.role-view { background: var(--success-subtle); color: var(--success); }
    .binding-icon.role-other { background: var(--accent-subtle); color: var(--accent); }

    .binding-body { flex: 1; min-width: 0; }
    .binding-top { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .binding-name { font-size: 13px; font-weight: 600; }
    .binding-role { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; font-size: 12px; }
    .role-label { color: var(--text-muted); }
    .role-name { color: var(--text-secondary); }
    .role-level {
      font-size: 9px; font-weight: 600; padding: 1px 6px; border-radius: 3px;
      text-transform: uppercase; letter-spacing: 0.04em;
    }
    .level-admin { background: var(--danger-subtle); color: var(--danger); }
    .level-edit { background: var(--warning-subtle); color: var(--warning); }
    .level-view { background: var(--success-subtle); color: var(--success); }
    .level-custom { background: var(--bg-elevated); color: var(--text-muted); }

    .binding-subjects { display: flex; align-items: flex-start; gap: 6px; }
    .subjects-label { font-size: 12px; color: var(--text-muted); padding-top: 3px; }
    .subject-chips { display: flex; flex-wrap: wrap; gap: 4px; }
    .subject-chip {
      display: flex; align-items: center; gap: 4px;
      font-size: 11px; padding: 3px 8px; border-radius: 4px;
      background: var(--bg-elevated); border: 1px solid var(--border);
    }
    .subject-chip i { font-size: 10px; }
    .sc-user { border-color: var(--accent); }
    .sc-user i { color: var(--accent); }
    .sc-group { border-color: var(--purple); }
    .sc-group i { color: var(--purple); }
    .sc-sa { border-color: var(--success); }
    .sc-sa i { color: var(--success); }

    .empty-state {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      padding: 48px; color: var(--text-muted); font-size: 13px;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
    }
    .empty-state i { font-size: 16px; opacity: 0.5; }
  `],
})
export class RbacComponent implements OnInit {
  private http = inject(HttpClient);
  bindings: any[] = [];
  filtered: any[] = [];
  searchQuery = '';
  kindFilter: 'all' | 'RoleBinding' | 'ClusterRoleBinding' = 'all';
  serviceAccounts: string[] = [];
  checkSubject = '';
  checkLoading = false;
  permMatrix: any = null;
  permVerbs = ['get', 'list', 'create', 'delete', 'update'];

  get uniqueRoles() { return [...new Set(this.bindings.map(b => b.role))]; }
  get uniqueSubjects() { return new Set(this.bindings.map(b => b.subjects)).size; }
  get adminCount() { return this.bindings.filter(b => this.isAdmin(b)).length; }

  ngOnInit() { this.load(); this.loadServiceAccounts(); }

  load() {
    this.http.get<any>('/api/rbac').subscribe(res => {
      this.bindings = res.bindings || [];
      this.applyFilter();
    });
  }

  loadServiceAccounts() {
    this.http.get<any>('/api/rbac/service-accounts').subscribe(res => {
      this.serviceAccounts = res.accounts || [];
    });
  }

  checkPermissions() {
    if (!this.checkSubject) return;
    this.checkLoading = true;
    this.permMatrix = null;
    this.http.get<any>('/api/rbac/check', { params: { subject: this.checkSubject } }).subscribe({
      next: (res) => { this.permMatrix = res; this.checkLoading = false; },
      error: () => { this.checkLoading = false; },
    });
  }

  applyFilter() {
    let result = this.bindings;
    if (this.kindFilter !== 'all') result = result.filter(b => b.kind === this.kindFilter);
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(b =>
        (b.name || '').toLowerCase().includes(q) ||
        (b.role || '').toLowerCase().includes(q) ||
        (b.subjects || '').toLowerCase().includes(q)
      );
    }
    // Sort: admin first, then cluster, then namespace
    this.filtered = result.sort((a, b) => {
      if (this.isAdmin(a) && !this.isAdmin(b)) return -1;
      if (!this.isAdmin(a) && this.isAdmin(b)) return 1;
      if (a.kind === 'ClusterRoleBinding' && b.kind !== 'ClusterRoleBinding') return -1;
      if (a.kind !== 'ClusterRoleBinding' && b.kind === 'ClusterRoleBinding') return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
  }

  isAdmin(b: any): boolean {
    const role = (b.role || '').toLowerCase();
    return role.includes('admin') || role.includes('cluster-admin');
  }

  permLevel(b: any): string {
    const role = (b.role || '').toLowerCase();
    if (role.includes('admin')) return 'admin';
    if (role.includes('edit') || role.includes('write')) return 'edit';
    if (role.includes('view') || role.includes('read')) return 'view';
    return 'custom';
  }

  roleClass(b: any): string {
    return 'role-' + this.permLevel(b);
  }

  parseSubjects(subjects: string): { name: string; type: string }[] {
    if (!subjects) return [];
    return subjects.split(',').map(s => {
      const trimmed = s.trim();
      if (trimmed.includes('ServiceAccount') || trimmed.includes('-sa')) return { name: trimmed, type: 'sa' };
      if (trimmed.includes('Group') || trimmed.includes('group')) return { name: trimmed, type: 'group' };
      return { name: trimmed, type: 'user' };
    });
  }

  subjectIcon(type: string): string {
    if (type === 'sa') return 'pi-cog';
    if (type === 'group') return 'pi-users';
    return 'pi-user';
  }
}
