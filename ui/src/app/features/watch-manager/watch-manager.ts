import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { SpotlightComponent } from '../../shared/components/spotlight.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';


@Component({
  selector: 'app-watch-manager',
  standalone: true,
  imports: [FormsModule, ButtonModule, TagModule, TooltipModule, SpotlightComponent, PageHeaderComponent],
  templateUrl: './watch-manager.html',
  styleUrl: './watch-manager.scss',
})
export class WatchManagerComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  status: any = null;
  showForm = false;
  newTarget = '';
  newCondition: 'crash' | 'restart' | 'count' = 'crash';
  formError = '';
  private pollInterval: any;

  ngOnInit() {
    this.refresh();
    this.pollInterval = setInterval(() => this.refresh(), 15000);
  }

  ngOnDestroy() { clearInterval(this.pollInterval); }

  refresh() {
    this.http.get<any>('/api/watch-status').subscribe({
      next: (res) => (this.status = res),
      error: () => (this.status = { running: false, watches: [] }),
    });
  }

  createWatch() {
    const target = this.newTarget.trim();
    if (!target) return;
    this.formError = '';
    this.http.post<any>('/api/watch-alert', { target, condition: this.newCondition }).subscribe({
      next: () => {
        this.newTarget = '';
        this.showForm = false;
        this.refresh();
      },
      error: (err) => {
        this.formError = err.error?.detail || 'Failed to create watch';
      },
    });
  }

  removeWatch(name: string) {
    this.http.delete<any>(`/api/watch-alert/${name}`).subscribe({
      next: () => this.refresh(),
      error: () => this.refresh(),
    });
  }

  formatTime(ts: number): string {
    return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
