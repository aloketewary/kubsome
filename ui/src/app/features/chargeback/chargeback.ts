import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TabsModule } from 'primeng/tabs';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { FormsModule } from '@angular/forms';
import { IntelHeaderComponent } from '../../shared/components/futuristic/intel-header.component';
import { LiveIndicatorComponent } from '../../shared/components/futuristic/live-indicator.component';
import { RelatedPagesComponent } from '../../shared/components/related-pages.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';


@Component({
  selector: 'app-chargeback',
  standalone: true,
  imports: [CommonModule, ButtonModule, TagModule, TabsModule, SelectButtonModule, TooltipModule, InputTextModule, FormsModule, IntelHeaderComponent, LiveIndicatorComponent, RelatedPagesComponent, SkeletonComponent],
  templateUrl: './chargeback.html',
  styleUrl: './chargeback.scss',
})
export class ChargebackComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);

  teamData: any[] = [];
  appData: any[] = [];
  nsData: any[] = [];
  envData: any[] = [];
  billingData: any[] = [];
  loading = false;
  loadError = false;
  activeTab = '0';
  days = 30;
  totalCost = 0;
  dailyRate = 0;
  appMax = 0;
  nsMax = 0;
  envMax = 0;
  unattributedPct = 0;
  searchQuery = '';
  autoRefresh = true;
  lastUpdated = '';
  toast: { message: string; severity: 'success' | 'danger' } | null = null;
  private timer: any;

  periodOptions = [
    { label: '7d', value: 7 },
    { label: '14d', value: 14 },
    { label: '30d', value: 30 },
    { label: '90d', value: 90 },
  ];

  get hasData() { return this.teamData.length > 0 || this.nsData.length > 0 || this.billingData.length > 0; }

  relatedPages = [
    { path: '/analytics', icon: 'pi pi-chart-bar', label: 'Analytics', description: 'Raw metrics and SQL queries' },
    { path: '/cost', icon: 'pi pi-dollar', label: 'Optimization', description: 'Resource optimization' },
    { path: '/rightsizing', icon: 'pi pi-sliders-h', label: 'Right-Sizing', description: 'Reduce waste per deployment' },
    { path: '/cost-estimate', icon: 'pi pi-calculator', label: 'Cost Estimate', description: 'Per-deployment cost' },
  ];

  ngOnInit() { this.refresh(); this.startAutoRefresh(); }
  ngOnDestroy() { clearInterval(this.timer); }

  toggleAutoRefresh() {
    this.autoRefresh = !this.autoRefresh;
    if (this.autoRefresh) this.startAutoRefresh();
    else clearInterval(this.timer);
  }

  private startAutoRefresh() {
    clearInterval(this.timer);
    this.timer = setInterval(() => this.refresh(), 60000);
  }

  applyFilter() { /* filtering handled in template via getter */ }

  private showToast(message: string, severity: 'success' | 'danger') {
    this.toast = { message, severity };
    setTimeout(() => { if (this.toast?.message === message) this.toast = null; }, 5000);
  }

  refresh() {
    this.loading = true;
    this.loadError = false;
    this.http.get<any>(`/api/chargeback/by-team?days=${this.days}`).subscribe({
      next: (res) => {
        this.teamData = res.items || [];
        this.totalCost = this.teamData.reduce((s: number, i: any) => s + (i.cost_usd || 0), 0);
        this.dailyRate = this.days > 0 ? this.totalCost / this.days : 0;
        const unattr = this.teamData.find((i: any) => i.team === 'unattributed');
        this.unattributedPct = this.totalCost > 0 && unattr
          ? Math.round((unattr.cost_usd / this.totalCost) * 100) : 0;
        this.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      },
      error: () => { this.teamData = []; this.loadError = true; },
    });
    this.http.get<any>(`/api/chargeback/by-app?days=${this.days}`).subscribe({
      next: (res) => {
        this.appData = res.items || [];
        this.appMax = Math.max(...this.appData.map((i: any) => i.cost_usd || 0), 1);
      },
      error: () => { this.appData = []; },
    });
    this.http.get<any>(`/api/chargeback/by-namespace?days=${this.days}`).subscribe({
      next: (res) => {
        this.nsData = res.items || [];
        this.nsMax = Math.max(...this.nsData.map((i: any) => i.cost_usd || 0), 1);
        this.loading = false;
      },
      error: () => { this.nsData = []; this.loading = false; },
    });
    this.http.get<any>(`/api/chargeback/by-environment?days=${this.days}`).subscribe({
      next: (res) => {
        this.envData = res.items || [];
        this.envMax = Math.max(...this.envData.map((i: any) => i.cost_usd || 0), 1);
      },
      error: () => { this.envData = []; },
    });
    this.http.get<any>(`/api/chargeback/by-billing-tag?days=${this.days}`).subscribe({
      next: (res) => { this.billingData = res.items || []; },
      error: () => { this.billingData = []; },
    });
  }

  exportReport(format: string) {
    this.http.post<any>('/api/chargeback/report', {
      days: this.days, group_by: 'team', format
    }).subscribe({
      next: (res) => {
        if (typeof res === 'string') { this.showToast(`Exported: ${res}`, 'success'); }
        else if (res.error) { this.showToast(res.error, 'danger'); }
        else { this.showToast(`${format.toUpperCase()} report generated`, 'success'); }
      },
      error: () => { this.showToast('Export failed', 'danger'); },
    });
  }

  barPct(cost: number, max?: number): number {
    const m = max || this.totalCost;
    return m > 0 ? Math.round((cost / m) * 100) : 0;
  }

  costPct(cost: number): number {
    return this.totalCost > 0 ? Math.round((cost / this.totalCost) * 100) : 0;
  }
}
