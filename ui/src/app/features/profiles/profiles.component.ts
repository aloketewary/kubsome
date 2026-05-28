import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { PageInfoComponent } from '../../shared/components/page-info.component';
import { SpotlightComponent } from '../../shared/components/spotlight.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { RelatedPagesComponent } from '../../shared/components/related-pages.component';

@Component({
  selector: 'app-profiles',
  standalone: true,
  imports: [ButtonModule, TagModule, PageInfoComponent, SpotlightComponent, RelatedPagesComponent, PageHeaderComponent],
  template: `
    <app-spotlight id="profiles" title="Profiles" icon="pi pi-user"
      description="Switch between configuration profiles for different environments or workflows."
      [capabilities]="['Quick switch', 'Environment presets', 'Custom configs', 'Reset to default']" [compact]="true" />

    <app-page-header title="Profiles" [subtitle]="'Active: ' + (active || 'default')">
        <button pButton icon="pi pi-undo" label="Reset" class="p-button-outlined p-button-sm" (click)="reset()" [disabled]="!active"></button>
        <button pButton icon="pi pi-refresh" class="p-button-outlined p-button-sm p-button-rounded" (click)="refresh()" [loading]="loading"></button>
        <app-page-info title="Profiles" description="Manage configuration profiles that bundle context, namespace, theme, and feature settings."
          [tips]="['Active profile shown with green badge', 'Reset returns to default settings', 'Profiles stored in ~/.kubsome/profiles/']"
          [commands]="['profiles', 'profile use <name>', 'profile reset']" />
    </app-page-header>

    @if (profiles.length) {
      <div class="profiles-grid">
        @for (p of profiles; track p.name) {
          <div class="profile-card" [class.active]="p.name === active">
            <div class="profile-header">
              <div class="profile-icon">
                <i class="pi pi-user"></i>
              </div>
              <div class="profile-info">
                <strong>{{ p.name }}</strong>
                @if (p.name === active) {
                  <p-tag value="active" severity="success" [rounded]="true" size="small" />
                }
              </div>
            </div>
            <div class="profile-details">
              @if (p.context) { <div class="detail-row"><span class="dl">Context</span><span class="dv">{{ p.context }}</span></div> }
              @if (p.namespace) { <div class="detail-row"><span class="dl">Namespace</span><span class="dv">{{ p.namespace }}</span></div> }
              @if (p.theme) { <div class="detail-row"><span class="dl">Theme</span><span class="dv">{{ p.theme }}</span></div> }
              @if (p.description) { <div class="detail-row full"><span class="dl">Description</span><span class="dv">{{ p.description }}</span></div> }
            </div>
            <div class="profile-actions">
              @if (p.name !== active) {
                <button pButton icon="pi pi-check" label="Activate" class="p-button-outlined p-button-sm" (click)="activate(p.name)"></button>
              } @else {
                <button pButton icon="pi pi-times" label="Deactivate" class="p-button-text p-button-sm" (click)="reset()"></button>
              }
            </div>
          </div>
        }
      </div>
    }

    @if (!profiles.length && !loading) {
      <div class="empty-state">
        <i class="pi pi-user"></i>
        <h3>No Profiles</h3>
        <p>Create profiles in <code>~/.kubsome/profiles/</code> to switch between environments quickly.</p>
      </div>
    }

    @if (loading && !profiles.length) {
      <div class="loading"><div class="spin"></div> Loading profiles...</div>
    }

    <app-related-pages label="Related" [pages]="relatedPages" />
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .header-actions { display: flex; align-items: center; gap: 8px; }

    .profiles-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
    .profile-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; transition: border-color 0.2s; }
    .profile-card.active { border-left: 3px solid var(--success); }
    .profile-card:hover { border-color: var(--accent); }

    .profile-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .profile-icon { width: 36px; height: 36px; border-radius: 50%; background: var(--bg-elevated); display: flex; align-items: center; justify-content: center; }
    .profile-icon i { font-size: 16px; color: var(--accent); }
    .profile-info { display: flex; align-items: center; gap: 8px; }
    .profile-info strong { font-size: 15px; }

    .profile-details { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 12px; }
    .detail-row { display: flex; flex-direction: column; gap: 1px; }
    .detail-row.full { grid-column: 1 / -1; }
    .dl { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .dv { font-size: 13px; }

    .profile-actions { display: flex; justify-content: flex-end; }

    .empty-state { text-align: center; padding: 60px 20px; color: var(--text-muted); }
    .empty-state i { font-size: 48px; margin-bottom: 16px; opacity: 0.3; }
    .empty-state h3 { font-size: 18px; margin: 0 0 8px; color: var(--text-primary); }
    .empty-state code { background: var(--bg-elevated); padding: 2px 6px; border-radius: 4px; font-size: 12px; }
    .loading { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 60px; color: var(--text-muted); }
    .spin { width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class ProfilesComponent implements OnInit {
  private http = inject(HttpClient);
  profiles: any[] = [];
  active: string | null = null;
  loading = false;

  relatedPages = [
    { path: '/settings', icon: 'pi pi-cog', label: 'Settings', description: 'Global configuration options' },
    { path: '/integrations', icon: 'pi pi-plug', label: 'Integrations', description: 'Connected external tools' },
    { path: '/compare', icon: 'pi pi-arrows-h', label: 'Compare', description: 'Multi-cluster drift detection' },
  ];

  ngOnInit() { this.refresh(); }

  refresh() {
    this.loading = true;
    this.http.get<any>('/api/profiles').subscribe({
      next: (res) => {
        this.profiles = res.profiles || [];
        this.active = res.active || null;
        this.loading = false;
      },
      error: () => { this.profiles = []; this.loading = false; },
    });
  }

  activate(name: string) {
    this.http.post<any>('/api/profiles/activate', { name }).subscribe({
      next: () => { this.active = name; },
    });
  }

  reset() {
    this.http.post<any>('/api/profiles/deactivate', {}).subscribe({
      next: () => { this.active = null; },
    });
  }
}
