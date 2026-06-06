import { Component, inject, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ApiService } from '../../core/services/api.service';
import { IntelHeaderComponent } from '../../shared/components/futuristic/intel-header.component';
import { MetricTileComponent } from '../../shared/components/futuristic/metric-tile.component';
import { CommandBarComponent } from '../../shared/components/futuristic/command-bar.component';
import type { CommandPill } from '../../shared/components/futuristic/command-bar.component';
import { DataRowComponent } from '../../shared/components/futuristic/data-row.component';
import { ActionIconComponent } from '../../shared/components/futuristic/action-icon.component';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [FormsModule, TagModule, TooltipModule, IntelHeaderComponent, MetricTileComponent, CommandBarComponent, DataRowComponent, ActionIconComponent],
  templateUrl: './search.html',
  styleUrl: './search.scss',
})
export class SearchComponent implements AfterViewInit {
  private api = inject(ApiService);
  router = inject(Router);

  @ViewChild('searchInput') searchInput!: ElementRef;

  query = '';
  lastQuery = '';
  results: any[] = [];
  searched = false;
  loading = false;
  kindFilter = 'all';

  get kindCounts(): { kind: string; count: number }[] {
    const map = new Map<string, number>();
    for (const r of this.results) {
      map.set(r.kind, (map.get(r.kind) || 0) + 1);
    }
    return Array.from(map.entries()).map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count);
  }

  get filterPills(): CommandPill[] {
    const pills: CommandPill[] = [{ label: 'All', value: 'all', count: this.results.length }];
    for (const k of this.kindCounts) {
      pills.push({ label: k.kind, value: k.kind, count: k.count, color: 'green' });
    }
    return pills;
  }

  get filteredResults(): any[] {
    if (this.kindFilter === 'all') return this.results;
    return this.results.filter(r => r.kind === this.kindFilter);
  }

  ngAfterViewInit() {
    setTimeout(() => this.searchInput?.nativeElement?.focus(), 100);
  }

  doSearch() {
    if (!this.query.trim()) return;
    this.lastQuery = this.query;
    this.loading = true;
    this.searched = false;
    this.kindFilter = 'all';
    this.api.search(this.query).subscribe({
      next: res => {
        this.results = res.results || [];
        this.searched = true;
        this.loading = false;
      },
      error: () => {
        this.results = [];
        this.searched = true;
        this.loading = false;
      },
    });
  }

  clearSearch() {
    this.query = '';
    this.results = [];
    this.searched = false;
    this.kindFilter = 'all';
    this.searchInput?.nativeElement?.focus();
  }

  onKindChange(value: string) { this.kindFilter = value; }

  navigateTo(r: any) {
    const kindRoutes: Record<string, string> = {
      Pod: '/pods',
      Deployment: '/deployments',
      Service: '/resources',
      ConfigMap: '/resources',
      Secret: '/resources',
      Job: '/jobs',
      CronJob: '/jobs',
    };
    const route = kindRoutes[r.kind] || '/resources';
    this.router.navigate([route], { queryParams: { filter: r.name } });
  }
}
