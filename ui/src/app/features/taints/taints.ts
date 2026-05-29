import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { SpotlightComponent } from '../../shared/components/spotlight.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';


@Component({
  selector: 'app-taints',
  standalone: true,
  imports: [TagModule, ButtonModule, TooltipModule, FormsModule, InputTextModule, SpotlightComponent, PageHeaderComponent],
  templateUrl: './taints.html',
  styleUrl: './taints.scss',
})
export class TaintsComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  nodes: any[] = [];
  loading = false;
  lastUpdated = '';
  newNode = '';
  newSpec = '';
  actionMessage = '';
  actionSuccess = false;
  private refreshTimer: any;

  get nodeNames() { return this.nodes.map(n => n.node); }
  get totalTaints() { return this.nodes.reduce((sum, n) => sum + n.taints.length, 0); }
  get noScheduleCount() { return this.nodes.reduce((sum, n) => sum + n.taints.filter((t: any) => t.effect === 'NoSchedule').length, 0); }
  get noExecuteCount() { return this.nodes.reduce((sum, n) => sum + n.taints.filter((t: any) => t.effect === 'NoExecute').length, 0); }

  ngOnInit() {
    this.load();
    this.refreshTimer = setInterval(() => this.load(), 30000);
  }

  ngOnDestroy() { clearInterval(this.refreshTimer); }

  load() {
    this.loading = true;
    this.http.get<any>('/api/taints').subscribe({
      next: (res) => {
        this.nodes = res.nodes || [];
        this.loading = false;
        this.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      },
      error: () => { this.nodes = []; this.loading = false; },
    });
  }

  applyTaint() {
    if (!this.newNode || !this.newSpec) return;
    this.actionMessage = '';
    this.http.post<any>('/api/taint', { node: this.newNode, spec: this.newSpec }).subscribe({
      next: (res) => {
        this.actionSuccess = res.success;
        this.actionMessage = res.success ? `✓ Tainted ${this.newNode}` : res.output;
        if (res.success) { this.newSpec = ''; this.load(); }
      },
      error: (err) => { this.actionSuccess = false; this.actionMessage = err.error?.detail || 'Failed'; },
    });
  }

  removeTaint(node: string, taint: any) {
    const spec = taint.value ? `${taint.key}=${taint.value}:${taint.effect}` : `${taint.key}:${taint.effect}`;
    this.http.post<any>('/api/untaint', { node, spec }).subscribe({
      next: (res) => {
        this.actionSuccess = res.success;
        this.actionMessage = res.success ? `✓ Removed taint from ${node}` : res.output;
        if (res.success) this.load();
      },
      error: (err) => { this.actionSuccess = false; this.actionMessage = err.error?.detail || 'Failed'; },
    });
  }

  effectSeverity(effect: string): 'warn' | 'danger' | 'info' {
    if (effect === 'NoExecute') return 'danger';
    if (effect === 'NoSchedule') return 'warn';
    return 'info';
  }
}
