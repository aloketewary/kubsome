import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-plugins',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    CardModule,
    ButtonModule,
    InputTextModule,
    TagModule,
    SkeletonModule,
    ToastModule
  ],
  providers: [MessageService],
  template: `
    <div class="p-4">
      <div class="flex justify-content-between align-items-center mb-4">
        <div>
          <h1 class="text-2xl font-bold">Plugins</h1>
          <p class="text-muted-color">Discover and install community extensions</p>
        </div>
        <a routerLink="/settings" class="p-button-text">
          <i class="pi pi-cog mr-2"></i>Settings
        </a>
      </div>

      <!-- Search -->
      <div class="mb-4">
        <span class="p-input-icon-left w-full md:w-30rem">
          <i class="pi pi-search"></i>
          <input type="text" pInputText [(ngModel)]="searchTerm" placeholder="Search plugins..." class="w-full" />
        </span>
      </div>

      <!-- Plugin List -->
      <div class="grid">
        <div class="col-12 md:col-6 lg:col-4" *ngFor="let plugin of filteredPlugins">
          <div pCard class="h-full">
            <ng-template pTemplate="header">
              <div class="flex justify-content-between align-items-center">
                <span class="font-bold text-lg">{{ plugin.name }}</span>
                <p-tag [value]="plugin.category" [severity]="getSeverity(plugin.category)" [styleClass]="'text-xs'"></p-tag>
              </div>
            </ng-template>
            <ng-template pTemplate="body">
              <p class="m-0 text-sm text-muted-color">{{ plugin.description }}</p>
              <div class="flex flex-wrap gap-2 mt-3">
                <span class="flex align-items-center text-xs">
                  <i class="pi pi-star mr-1"></i>{{ plugin.rating || '0.0' }}
                </span>
                <span class="flex align-items-center text-xs">
                  <i class="pi pi-download mr-1"></i>{{ plugin.downloads || 0 }} installs
                </span>
              </div>
            </ng-template>
            <ng-template pTemplate="footer">
              <div class="flex gap-2">
                <a [routerLink]="'/plugins/' + plugin.id" class="p-button-text p-button-sm">
                  <i class="pi pi-info-circle mr-2"></i>Details
                </a>
                <button pButton pRipple label="Install" icon="pi pi-download"
                        class="p-button-sm p-button-outlined"
                        (click)="installPlugin(plugin)"></button>
              </div>
            </ng-template>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div *ngIf="filteredPlugins.length === 0" class="text-center py-8">
        <i class="pi pi-search pi-4x mb-3 text-muted-color"></i>
        <p class="text-muted-color">No plugins found matching your search.</p>
      </div>
    </div>
  `
})
export class PluginsComponent {
  searchTerm = '';
  
  plugins = [
    { id: 'health-checker', name: 'Health Checker', category: 'Monitoring', description: 'Advanced health monitoring with custom thresholds', rating: 4.8, downloads: 1250 },
    { id: 'cost-optimizer', name: 'Cost Optimizer', category: 'Cost', description: 'Automated right-sizing recommendations', rating: 4.6, downloads: 980 },
    { id: 'security-scanner', name: 'Security Scanner', category: 'Security', description: 'Deep security posture analysis', rating: 4.9, downloads: 1420 },
    { id: 'cluster-backup', name: 'Cluster Backup', category: 'Backup', description: 'Automated etcd and config backups', rating: 4.5, downloads: 670 },
    { id: 'alert-forwarder', name: 'Alert Forwarder', category: 'Notifications', description: 'Forward alerts to Slack, PagerDuty, Teams', rating: 4.7, downloads: 890 },
    { id: 'resource-trend', name: 'Resource Trends', category: 'Analytics', description: '7-day resource usage forecasting', rating: 4.4, downloads: 540 },
    { id: 'network-map', name: 'Network Map', category: 'Networking', description: 'Visualize service dependencies and traffic', rating: 4.8, downloads: 760 },
    { id: 'log-analyzer', name: 'Log Analyzer', category: 'Observability', description: 'Pattern detection in application logs', rating: 4.6, downloads: 620 },
    { id: 'policy-enforcer', name: 'Policy Enforcer', category: 'Governance', description: 'Kubernetes policy compliance checks', rating: 4.7, downloads: 830 },
    { id: 'secret-rotator', name: 'Secret Rotator', category: 'Security', description: 'Automated rotation for secrets and credentials', rating: 4.5, downloads: 410 }
  ];

  get filteredPlugins() {
    if (!this.searchTerm) return this.plugins;
    const term = this.searchTerm.toLowerCase();
    return this.plugins.filter(
      p => 
        p.name.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term)
    );
  }

  getSeverity(category: string) {
    const map: Record<string, any> = {
      'Monitoring': 'info',
      'Cost': 'success',
      'Security': 'danger',
      'Backup': 'warning',
      'Notifications': 'info',
      'Analytics': 'secondary',
      'Networking': 'info',
      'Observability': 'secondary',
      'Governance': 'warning',
      'DevTools': 'success'
    };
    return map[category] || 'secondary';
  }

  installPlugin(plugin: any) {
    // Placeholder - would call API endpoint
    console.log('Installing plugin:', plugin.name);
    // In real impl: this.messageService.add({severity:'success', summary:'Success', detail:`${plugin.name} installed`});
  }
}
