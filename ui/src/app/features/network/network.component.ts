import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  selector: 'app-network',
  standalone: true,
  imports: [FormsModule, JsonPipe, TagModule, ButtonModule, TooltipModule, InputTextModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Network</h1>
        <p class="subtitle">Ingress routing, DNS, and service mesh</p>
      </div>
      <button pButton icon="pi pi-refresh" class="p-button-outlined p-button-sm p-button-rounded" (click)="load()" pTooltip="Refresh"></button>
    </div>

    <!-- Summary -->
    <div class="summary-strip">
      <div class="summary-pill">
        <i class="pi pi-link"></i>
        <span class="pill-val">{{ ingresses.length }}</span>
        <span class="pill-label">Ingresses</span>
      </div>
      <div class="summary-pill" [class.pill-ok]="meshDetected" [class.pill-off]="!meshDetected">
        <i class="pi pi-sitemap"></i>
        <span class="pill-val">{{ meshDetected ? 'Active' : 'None' }}</span>
        <span class="pill-label">Service Mesh</span>
      </div>
    </div>

    <!-- Ingress Section -->
    <div class="section">
      <div class="section-header">
        <h3><i class="pi pi-link"></i> Ingress Routes</h3>
        <span class="section-count">{{ ingresses.length }}</span>
      </div>

      @if (ingresses.length > 0) {
        <div class="ingress-list">
          @for (ing of ingresses; track $index) {
            <div class="ingress-card">
              <div class="ing-flow">
                <!-- External -->
                <div class="flow-node flow-external">
                  <i class="pi pi-globe"></i>
                  <span class="flow-label">{{ ing.host || '*' }}</span>
                </div>
                <div class="flow-arrow"><i class="pi pi-arrow-right"></i></div>
                <!-- Path -->
                <div class="flow-node flow-path">
                  <i class="pi pi-directions"></i>
                  <code class="flow-label">{{ ing.path || '/' }}</code>
                </div>
                <div class="flow-arrow"><i class="pi pi-arrow-right"></i></div>
                <!-- Service -->
                <div class="flow-node flow-service">
                  <i class="pi pi-server"></i>
                  <span class="flow-label">{{ ing.service }}</span>
                </div>
              </div>
              <div class="ing-meta">
                <code class="ing-name">{{ ing.name }}</code>
                @if (ing.tls) {
                  <p-tag value="TLS" severity="success" [rounded]="true" />
                }
              </div>
            </div>
          }
        </div>
      } @else {
        <div class="empty-state"><i class="pi pi-link"></i> No ingress routes configured</div>
      }
    </div>

    <!-- DNS Tool -->
    <div class="section">
      <div class="section-header">
        <h3><i class="pi pi-globe"></i> DNS Lookup</h3>
      </div>

      <div class="dns-tool">
        <div class="dns-input-row">
          <div class="dns-input-wrap">
            <i class="pi pi-search"></i>
            <input pInputText [(ngModel)]="dnsQuery" placeholder="Enter service name..." (keyup.enter)="lookupDns()" />
          </div>
          <button pButton label="Resolve" icon="pi pi-globe" class="p-button-sm" (click)="lookupDns()" [disabled]="!dnsQuery.trim()"></button>
        </div>

        @if (dnsResult) {
          <div class="dns-result">
            <div class="dns-result-header">
              <span class="dns-service">{{ dnsQuery }}</span>
              <p-tag value="Resolved" severity="success" [rounded]="true" />
            </div>
            <div class="dns-details">
              @if (dnsResult.cluster_ip) {
                <div class="dns-row">
                  <span class="dns-key">Cluster IP</span>
                  <code class="dns-val">{{ dnsResult.cluster_ip }}</code>
                </div>
              }
              @if (dnsResult.dns_name) {
                <div class="dns-row">
                  <span class="dns-key">DNS Name</span>
                  <code class="dns-val">{{ dnsResult.dns_name }}</code>
                </div>
              }
              @if (dnsResult.ports) {
                <div class="dns-row">
                  <span class="dns-key">Ports</span>
                  <div class="dns-ports">
                    @for (port of dnsResult.ports; track $index) {
                      <span class="port-chip">{{ port }}</span>
                    }
                  </div>
                </div>
              }
              @if (dnsResult.endpoints) {
                <div class="dns-row">
                  <span class="dns-key">Endpoints</span>
                  <span class="dns-val">{{ dnsResult.endpoints }} ready</span>
                </div>
              }
              @if (dnsResult.type) {
                <div class="dns-row">
                  <span class="dns-key">Type</span>
                  <p-tag [value]="dnsResult.type" severity="info" [rounded]="true" />
                </div>
              }
            </div>
            @if (dnsResult.raw) {
              <details class="dns-raw-toggle">
                <summary>Raw output</summary>
                <pre class="dns-raw">{{ dnsResult.raw || (dnsResult | json) }}</pre>
              </details>
            }
          </div>
        }

        @if (dnsResult && !dnsResult.cluster_ip && !dnsResult.dns_name) {
          <div class="dns-result">
            <pre class="dns-raw">{{ dnsResult | json }}</pre>
          </div>
        }
      </div>
    </div>

    <!-- Mesh Status -->
    <div class="section">
      <div class="section-header">
        <h3><i class="pi pi-sitemap"></i> Service Mesh</h3>
      </div>
      <div class="mesh-card">
        @if (meshDetected) {
          <div class="mesh-active">
            <div class="mesh-icon active"><i class="pi pi-check-circle"></i></div>
            <div class="mesh-info">
              <span class="mesh-title">Mesh Detected</span>
              <span class="mesh-detail">{{ meshType || 'Service mesh is active in this namespace' }}</span>
            </div>
          </div>
        } @else {
          <div class="mesh-inactive">
            <div class="mesh-icon inactive"><i class="pi pi-minus-circle"></i></div>
            <div class="mesh-info">
              <span class="mesh-title">No Mesh</span>
              <span class="mesh-detail">No service mesh sidecar detected</span>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

    /* Summary */
    .summary-strip {
      display: flex; gap: 8px; margin-bottom: 20px;
      padding: 14px 18px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
    }
    .summary-pill { display: flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px; background: var(--bg-elevated); font-size: 12px; }
    .summary-pill i { font-size: 12px; color: var(--text-muted); }
    .pill-ok { background: var(--success-subtle); }
    .pill-ok i { color: var(--success); }
    .pill-off { background: var(--bg-elevated); }
    .pill-val { font-weight: 700; }
    .pill-label { color: var(--text-muted); }

    /* Sections */
    .section { margin-bottom: 28px; }
    .section-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .section-header h3 { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px; margin: 0; }
    .section-header h3 i { font-size: 13px; color: var(--text-muted); }
    .section-count { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px; background: var(--bg-elevated); color: var(--text-muted); }

    /* Ingress Cards */
    .ingress-list { display: flex; flex-direction: column; gap: 8px; }
    .ingress-card {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 16px; transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
    }
    .ingress-card:hover { border-color: var(--border-hover); transform: translateY(-2px); box-shadow: 0 8px 24px -8px rgba(0,0,0,0.2); }
    .ing-flow { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .flow-node {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 12px; border-radius: 6px; font-size: 12px;
    }
    .flow-node i { font-size: 12px; }
    .flow-external { background: var(--accent-subtle); color: var(--accent); }
    .flow-path { background: var(--bg-elevated); color: var(--text-secondary); }
    .flow-path code { font-size: 11px; }
    .flow-service { background: var(--success-subtle); color: var(--success); }
    .flow-arrow { color: var(--text-muted); font-size: 10px; }
    .flow-label { font-weight: 500; }
    .ing-meta { display: flex; align-items: center; gap: 8px; }
    .ing-name { font-size: 11px; color: var(--text-muted); }

    /* DNS Tool */
    .dns-tool {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px;
    }
    .dns-input-row { display: flex; gap: 8px; margin-bottom: 12px; }
    .dns-input-wrap { position: relative; flex: 1; max-width: 300px; }
    .dns-input-wrap i { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 12px; }
    .dns-input-wrap input { padding-left: 30px !important; width: 100%; }
    .dns-result {
      background: var(--bg-elevated); border-radius: 8px; padding: 14px; margin-top: 8px;
    }
    .dns-result-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .dns-service { font-size: 14px; font-weight: 600; }
    .dns-details { display: flex; flex-direction: column; gap: 6px; }
    .dns-row { display: flex; align-items: center; gap: 12px; font-size: 12px; padding: 4px 0; }
    .dns-key { color: var(--text-muted); min-width: 80px; }
    .dns-val { font-family: 'JetBrains Mono', monospace; font-size: 11px; }
    .dns-ports { display: flex; gap: 4px; }
    .port-chip {
      font-size: 10px; font-family: 'JetBrains Mono', monospace;
      padding: 2px 6px; border-radius: 3px;
      background: var(--bg-card); border: 1px solid var(--border);
    }
    .dns-raw-toggle { margin-top: 10px; }
    .dns-raw-toggle summary { font-size: 11px; color: var(--text-muted); cursor: pointer; }
    .dns-raw {
      font-family: 'JetBrains Mono', monospace; font-size: 11px;
      margin-top: 8px; padding: 10px; background: var(--bg-card);
      border-radius: 6px; white-space: pre-wrap; max-height: 200px; overflow-y: auto;
    }

    /* Mesh */
    .mesh-card {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px;
    }
    .mesh-active, .mesh-inactive { display: flex; align-items: center; gap: 12px; }
    .mesh-icon {
      width: 40px; height: 40px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center; font-size: 18px;
    }
    .mesh-icon.active { background: var(--success-subtle); color: var(--success); }
    .mesh-icon.inactive { background: var(--bg-elevated); color: var(--text-muted); }
    .mesh-info { display: flex; flex-direction: column; gap: 2px; }
    .mesh-title { font-size: 14px; font-weight: 600; }
    .mesh-detail { font-size: 12px; color: var(--text-muted); }

    .empty-state {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      padding: 40px; color: var(--text-muted); font-size: 13px;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
    }
    .empty-state i { font-size: 16px; opacity: 0.5; }
  `],
})
export class NetworkComponent implements OnInit {
  private http = inject(HttpClient);
  ingresses: any[] = [];
  dnsQuery = '';
  dnsResult: any = null;
  meshDetected = false;
  meshType = '';

  ngOnInit() { this.load(); }

  load() {
    this.http.get<any>('/api/ingress').subscribe(r => this.ingresses = r.ingresses || []);
    this.http.get<any>('/api/mesh').subscribe(r => {
      this.meshDetected = r.detected || false;
      this.meshType = r.type || '';
    });
  }

  lookupDns() {
    if (!this.dnsQuery.trim()) return;
    this.dnsResult = null;
    this.http.get<any>(`/api/dns/${this.dnsQuery}`).subscribe(r => this.dnsResult = r);
  }
}
