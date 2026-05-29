import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ApiService } from '../../core/services/api.service';
import { HoloCardComponent } from '../../shared/components/futuristic/holo-card.component';
import { StatusBeaconComponent } from '../../shared/components/futuristic/status-beacon.component';
import { MetricTileComponent } from '../../shared/components/futuristic/metric-tile.component';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [FormsModule, TagModule, TooltipModule, HoloCardComponent, StatusBeaconComponent, MetricTileComponent],
  templateUrl: './search.html',
  styleUrl: './search.scss',
})
export class SearchComponent {
  private api = inject(ApiService);
  query = '';
  lastQuery = '';
  results: any[] = [];
  searched = false;

  doSearch() {
    if (!this.query.trim()) return;
    this.lastQuery = this.query;
    this.api.search(this.query).subscribe(res => {
      this.results = res.results || [];
      this.searched = true;
    });
  }
}
