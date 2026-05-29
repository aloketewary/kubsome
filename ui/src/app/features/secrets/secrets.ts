import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { HoloCardComponent } from '../../shared/components/futuristic/holo-card.component';
import { MetricTileComponent } from '../../shared/components/futuristic/metric-tile.component';
import { StatusBeaconComponent } from '../../shared/components/futuristic/status-beacon.component';
import { ActionIconComponent } from '../../shared/components/futuristic/action-icon.component';

@Component({
  selector: 'app-secrets',
  standalone: true,
  imports: [TagModule, TooltipModule, HoloCardComponent, MetricTileComponent, StatusBeaconComponent, ActionIconComponent],
  templateUrl: './secrets.html',
  styleUrl: './secrets.scss',
})
export class SecretsComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  data: any = null;
  saEntries: { name: string; secrets: string[] }[] = [];
  loading = false;
  lastScanned = '';
  private refreshTimer: any;

  ngOnInit() { this.load(); this.refreshTimer = setInterval(() => this.load(), 60000); }
  ngOnDestroy() { clearInterval(this.refreshTimer); }

  load() {
    this.loading = true; this.data = null;
    this.http.get<any>('/api/image-pull-secrets').subscribe(res => {
      this.data = res;
      this.saEntries = Object.entries(res.service_account_secrets || {}).map(([name, secrets]) => ({ name, secrets: secrets as string[] }));
      this.loading = false;
      this.lastScanned = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    });
  }

  getFirstImage(item: any): string { return item.images?.[0] || 'unknown'; }
  getFirstRegistry(item: any): string { return item.registries_needed?.[0] || '<registry>'; }
  shortImage(image: string): string { const parts = image.split('/'); return parts[parts.length - 1] || image; }
  copyFix(item: any) { const cmd = `kubectl create secret docker-registry ${item.secret} --docker-server=${this.getFirstRegistry(item)} --docker-username=<user> --docker-password=<token> -n ${this.data.namespace}`; navigator.clipboard.writeText(cmd); }
}
