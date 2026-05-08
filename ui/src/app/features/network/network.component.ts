import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  selector: 'app-network',
  standalone: true,
  imports: [FormsModule, JsonPipe, TagModule, ButtonModule, InputTextModule],
  template: `
    <div class="page-header">
      <h1>Network & Services</h1>
      <p class="subtitle">Ingress, mesh, and DNS</p>
    </div>

    <h3 class="section-title">Ingresses</h3>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Host</th><th>Path</th><th>Service</th></tr></thead>
        <tbody>
          @for (ing of ingresses; track $index) {
            <tr>
              <td><code class="mono">{{ ing.name }}</code></td>
              <td>{{ ing.host || '*' }}</td>
              <td><code class="mono">{{ ing.path || '/' }}</code></td>
              <td><p-tag [value]="ing.service" severity="info" /></td>
            </tr>
          }
          @if (ingresses.length === 0) { <tr><td colspan="4" class="empty">No ingresses</td></tr> }
        </tbody>
      </table>
    </div>

    <h3 class="section-title" style="margin-top: 24px;">DNS Lookup</h3>
    <div class="dns-section">
      <input pInputText [(ngModel)]="dnsQuery" placeholder="Service name..." style="width: 200px;" (keyup.enter)="lookupDns()" />
      <button pButton label="Lookup" icon="pi pi-globe" class="p-button-sm" (click)="lookupDns()" [disabled]="!dnsQuery.trim()"></button>
    </div>
    @if (dnsResult) {
      <pre class="dns-output">{{ dnsResult | json }}</pre>
    }
  `,
  styles: [`
    .page-header { margin-bottom: 24px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .section-title { font-size: 14px; font-weight: 600; color: var(--text-secondary); margin-bottom: 12px; }
    .table-wrap { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 12px 16px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); border-bottom: 1px solid var(--border); background: var(--bg-elevated); }
    td { padding: 10px 16px; border-bottom: 1px solid var(--border); }
    tr:hover td { background: var(--bg-hover); }
    .empty { text-align: center; padding: 24px; color: var(--text-muted); }
    .dns-section { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }
    .dns-output {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 16px;
      white-space: pre-wrap;
      max-height: 300px;
      overflow-y: auto;
    }
  `],
})
export class NetworkComponent implements OnInit {
  private http = inject(HttpClient);
  ingresses: any[] = [];
  dnsQuery = '';
  dnsResult: any = null;

  ngOnInit() {
    this.http.get<any>('http://localhost:8000/api/ingress').subscribe(r => this.ingresses = r.ingresses || []);
  }

  lookupDns() {
    if (!this.dnsQuery.trim()) return;
    this.http.get<any>(`http://localhost:8000/api/dns/${this.dnsQuery}`).subscribe(r => this.dnsResult = r);
  }
}
