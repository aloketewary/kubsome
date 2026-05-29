import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SpotlightComponent } from '../../shared/components/spotlight.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';


@Component({
  selector: 'app-port-forwards',
  standalone: true,
  imports: [ButtonModule, TagModule, FormsModule, SpotlightComponent, PageHeaderComponent],
  templateUrl: './port-forwards.html',
  styleUrl: './port-forwards.scss',
})
export class PortForwardsComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  forwards: any[] = [];
  newTarget = '';
  newLocalPort: number | null = null;
  newRemotePort: number | null = null;
  private timer: any;

  ngOnInit() { this.refresh(); this.timer = setInterval(() => this.refresh(), 10000); }
  ngOnDestroy() { clearInterval(this.timer); }

  refresh() {
    this.http.get<any>('/api/port-forwards').subscribe({
      next: (res) => { this.forwards = res.forwards || []; },
    });
  }

  startForward() {
    const body = {
      target: this.newTarget,
      local_port: this.newLocalPort,
      remote_port: this.newRemotePort || this.newLocalPort,
    };
    this.http.post<any>('/api/port-forwards/start', body).subscribe({
      next: (res) => {
        if (res.success) { this.newTarget = ''; this.newLocalPort = null; this.newRemotePort = null; this.refresh(); }
        else { alert(res.message); }
      },
    });
  }

  stopForward(target: string) {
    this.http.post<any>('/api/port-forwards/stop', { target }).subscribe({
      next: () => { this.refresh(); },
    });
  }

  stopAll() {
    this.http.post<any>('/api/port-forwards/stop-all', {}).subscribe({
      next: () => { this.refresh(); },
    });
  }
}
