import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TitleCasePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TabsModule } from 'primeng/tabs';
import { PageInfoComponent } from '../../shared/components/page-info.component';
import { SpotlightComponent } from '../../shared/components/spotlight.component';

@Component({
  selector: 'app-mesh',
  standalone: true,
  imports: [ButtonModule, TagModule, TabsModule, TitleCasePipe, PageInfoComponent, SpotlightComponent],
  template: `
    <app-spotlight id="mesh" title="Service Mesh" icon="pi pi-share-alt"
      description="Istio/Linkerd visibility — traffic routing, mTLS, circuit breakers."
      [capabilities]="['mTLS status', 'VirtualService routing', 'Circuit breakers', 'Sidecar injection']" [compact]="true" />

    <div class="page-header">
      <div>
        <h1>Service Mesh</h1>
        <p class="subtitle">{{ data?.mesh ? (data.mesh | titlecase) + ' mesh' : 'Detecting mesh...' }} · {{ lastUpdated }}</p>
      </div>
      <div class="header-actions">
        <button pButton icon="pi pi-refresh" class="p-button-outlined p-button-sm p-button-rounded" (click)="refresh()" [loading]="loading"></button>
      </div>
      <app-page-info title="Service Mesh" description="Deep visibility into Istio or Linkerd service mesh — mTLS enforcement, traffic routing, circuit breakers, and sidecar injection."
        [tips]="['Green lock = mTLS STRICT', 'Yellow = PERMISSIVE (accepts plaintext)', 'Check injection coverage for gaps']"
        [commands]="['mesh-detail', 'vs', 'dr', 'mtls', 'mesh']" />
    </div>

    @if (data && !data.mesh) {
      <div class="empty-state">
        <i class="pi pi-share-alt"></i>
        <h3>No Service Mesh Detected</h3>
        <p>Istio or Linkerd namespace not found in this cluster.</p>
      </div>
    }

    @if (data?.mesh) {
      <!-- Overview Cards -->
      <div class="mesh-overview">
        <div class="ov-card">
          <div class="ov-icon"><i class="pi pi-share-alt"></i></div>
          <div class="ov-info">
            <span class="ov-value">{{ data.mesh | titlecase }}</span>
            <span class="ov-label">Mesh Provider</span>
          </div>
        </div>
        <div class="ov-card" [class.ov-ok]="data.mtls?.strict" [class.ov-warn]="!data.mtls?.strict">
          <div class="ov-icon"><i class="pi" [class.pi-lock]="data.mtls?.strict" [class.pi-lock-open]="!data.mtls?.strict"></i></div>
          <div class="ov-info">
            <span class="ov-value">{{ data.mtls?.effective_mode || 'Unknown' }}</span>
            <span class="ov-label">mTLS Mode</span>
          </div>
        </div>
        <div class="ov-card" [class.ov-ok]="data.injection?.coverage_pct > 90" [class.ov-warn]="data.injection?.coverage_pct <= 90">
          <div class="ov-icon"><i class="pi pi-box"></i></div>
          <div class="ov-info">
            <span class="ov-value">{{ data.injection?.coverage_pct }}%</span>
            <span class="ov-label">Sidecar Coverage ({{ data.injection?.injected }}/{{ data.injection?.total }})</span>
          </div>
        </div>
        <div class="ov-card">
          <div class="ov-icon"><i class="pi pi-directions"></i></div>
          <div class="ov-info">
            <span class="ov-value">{{ data.virtual_services?.length || 0 }} VS / {{ data.destination_rules?.length || 0 }} DR</span>
            <span class="ov-label">Traffic Rules</span>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <p-tabs [value]="activeTab" (valueChange)="activeTab = '' + $event">
        <p-tablist>
          <p-tab value="0">mTLS</p-tab>
          <p-tab value="1">VirtualServices</p-tab>
          <p-tab value="2">DestinationRules</p-tab>
          <p-tab value="3">Injection</p-tab>
        </p-tablist>

        <p-tabpanels>
          <!-- mTLS Tab -->
          <p-tabpanel value="0">
            <div class="mtls-section">
              <div class="mtls-status" [class.strict]="data.mtls?.strict">
                <i class="pi" [class.pi-lock]="data.mtls?.strict" [class.pi-lock-open]="!data.mtls?.strict"></i>
                <div>
                  <strong>{{ data.mtls?.effective_mode }}</strong>
                  <p>{{ data.mtls?.strict ? 'All pod-to-pod traffic is encrypted' : 'Accepts both plaintext and mTLS connections' }}</p>
                </div>
              </div>
              @if (data.mtls?.all_policies?.length) {
                <h4>PeerAuthentication Policies</h4>
                @for (p of data.mtls.all_policies; track p.name) {
                  <div class="policy-row">
                    <span class="policy-name">{{ p.name }}</span>
                    <span class="policy-ns">{{ p.namespace }}</span>
                    <p-tag [value]="p.mode" [severity]="p.mode === 'STRICT' ? 'success' : 'warn'" [rounded]="true" size="small" />
                    <span class="policy-scope">{{ p.scope }}</span>
                  </div>
                }
              }
            </div>
          </p-tabpanel>

          <!-- VirtualServices Tab -->
          <p-tabpanel value="1">
            @if (!data.virtual_services?.length) {
              <p class="empty-tab">No VirtualServices in this namespace</p>
            }
            @for (vs of data.virtual_services; track vs.name) {
              <div class="vs-card">
                <div class="vs-header">
                  <strong>{{ vs.name }}</strong>
                  <span class="vs-hosts">{{ vs.hosts?.join(', ') }}</span>
                  @if (vs.gateways?.length) {
                    <p-tag [value]="'gw: ' + vs.gateways.join(', ')" severity="info" [rounded]="true" size="small" />
                  }
                </div>
                @for (route of vs.routes; track $index) {
                  <div class="route-row">
                    @for (dest of route.destinations; track dest.host) {
                      <div class="dest-item">
                        <span class="dest-arrow">→</span>
                        <span class="dest-host">{{ dest.host }}</span>
                        @if (dest.subset) { <span class="dest-subset">({{ dest.subset }})</span> }
                        @if (dest.port) { <span class="dest-port">:{{ dest.port }}</span> }
                        @if (route.destinations.length > 1) {
                          <div class="weight-bar">
                            <div class="weight-fill" [style.width.%]="dest.weight"></div>
                            <span class="weight-label">{{ dest.weight }}%</span>
                          </div>
                        }
                      </div>
                    }
                    @if (route.timeout) { <span class="route-meta">timeout: {{ route.timeout }}</span> }
                    @if (route.retries?.attempts) { <span class="route-meta">retries: {{ route.retries.attempts }}x</span> }
                  </div>
                }
              </div>
            }
          </p-tabpanel>

          <!-- DestinationRules Tab -->
          <p-tabpanel value="2">
            @if (!data.destination_rules?.length) {
              <p class="empty-tab">No DestinationRules in this namespace</p>
            }
            @for (dr of data.destination_rules; track dr.name) {
              <div class="dr-card">
                <div class="dr-header">
                  <strong>{{ dr.name }}</strong>
                  <span class="dr-host">→ {{ dr.host }}</span>
                  @if (dr.tls_mode) { <p-tag [value]="dr.tls_mode" [severity]="dr.tls_mode === 'ISTIO_MUTUAL' ? 'success' : 'info'" [rounded]="true" size="small" /> }
                  @if (dr.load_balancer) { <p-tag [value]="'LB: ' + dr.load_balancer" severity="secondary" [rounded]="true" size="small" /> }
                </div>
                @if (dr.outlier_detection?.consecutive_errors) {
                  <div class="cb-info">
                    <i class="pi pi-bolt"></i>
                    Circuit Breaker: {{ dr.outlier_detection.consecutive_errors }} errors →
                    eject {{ dr.outlier_detection.base_ejection_time }}
                    @if (dr.outlier_detection.max_ejection_pct) { (max {{ dr.outlier_detection.max_ejection_pct }}%) }
                  </div>
                }
                @if (dr.subsets?.length) {
                  <div class="subsets">
                    @for (s of dr.subsets; track s.name) {
                      <p-tag [value]="s.name" severity="secondary" [rounded]="true" size="small" />
                    }
                  </div>
                }
              </div>
            }
          </p-tabpanel>

          <!-- Injection Tab -->
          <p-tabpanel value="3">
            <div class="injection-section">
              <div class="inj-bar-container">
                <div class="inj-bar">
                  <div class="inj-fill" [style.width.%]="data.injection?.coverage_pct"
                    [class.ok]="data.injection?.coverage_pct > 90"
                    [class.warn]="data.injection?.coverage_pct <= 90 && data.injection?.coverage_pct > 50"
                    [class.err]="data.injection?.coverage_pct <= 50"></div>
                </div>
                <span class="inj-pct">{{ data.injection?.coverage_pct }}% ({{ data.injection?.injected }}/{{ data.injection?.total }} pods)</span>
              </div>
              @if (data.injection?.not_injected?.length) {
                <h4>Pods Without Sidecar</h4>
                <div class="not-injected-list">
                  @for (pod of data.injection.not_injected; track pod) {
                    <div class="ni-row"><i class="pi pi-exclamation-triangle status-warn"></i> {{ pod }}</div>
                  }
                </div>
              } @else {
                <p class="all-good"><i class="pi pi-check-circle"></i> All pods have sidecar injected</p>
              }
            </div>
          </p-tabpanel>
        </p-tabpanels>
      </p-tabs>
    }

    @if (!data) {
      <div class="loading"><div class="spin"></div> Scanning service mesh...</div>
    }
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .header-actions { display: flex; align-items: center; gap: 8px; }

    .mesh-overview { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
    .ov-card { display: flex; align-items: center; gap: 12px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; }
    .ov-card.ov-ok { border-left: 3px solid var(--success); }
    .ov-card.ov-warn { border-left: 3px solid var(--warning); }
    .ov-icon { font-size: 20px; color: var(--text-muted); }
    .ov-card.ov-ok .ov-icon { color: var(--success); }
    .ov-card.ov-warn .ov-icon { color: var(--warning); }
    .ov-value { display: block; font-size: 14px; font-weight: 700; }
    .ov-label { font-size: 11px; color: var(--text-muted); }

    .mtls-section { padding: 16px 0; }
    .mtls-status { display: flex; align-items: center; gap: 16px; padding: 20px; border-radius: var(--radius); border: 1px solid var(--border); margin-bottom: 16px; }
    .mtls-status.strict { background: rgba(34,197,94,0.05); border-color: rgba(34,197,94,0.3); }
    .mtls-status.strict i { color: var(--success); font-size: 24px; }
    .mtls-status:not(.strict) { background: rgba(234,179,8,0.05); border-color: rgba(234,179,8,0.3); }
    .mtls-status:not(.strict) i { color: var(--warning); font-size: 24px; }
    .mtls-status p { font-size: 12px; color: var(--text-muted); margin: 4px 0 0; }
    h4 { font-size: 13px; font-weight: 600; margin: 16px 0 8px; }
    .policy-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
    .policy-name { font-weight: 600; min-width: 120px; }
    .policy-ns { color: var(--text-muted); min-width: 100px; }
    .policy-scope { font-size: 11px; color: var(--text-muted); }

    .vs-card, .dr-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; margin-bottom: 12px; }
    .vs-header, .dr-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; }
    .vs-hosts, .dr-host { font-size: 12px; color: var(--text-muted); }
    .route-row { padding: 8px 0 8px 16px; border-left: 2px solid var(--border); margin: 4px 0; }
    .dest-item { display: flex; align-items: center; gap: 6px; font-size: 13px; margin: 4px 0; }
    .dest-arrow { color: var(--success); font-weight: bold; }
    .dest-host { font-weight: 600; }
    .dest-subset, .dest-port { font-size: 11px; color: var(--text-muted); }
    .weight-bar { width: 80px; height: 6px; background: var(--bg-elevated); border-radius: 3px; overflow: hidden; position: relative; margin-left: 8px; }
    .weight-fill { height: 100%; background: var(--accent); border-radius: 3px; }
    .weight-label { font-size: 10px; color: var(--text-muted); margin-left: 4px; }
    .route-meta { font-size: 11px; color: var(--text-muted); margin-right: 12px; }

    .cb-info { font-size: 12px; color: var(--warning); padding: 8px 0; display: flex; align-items: center; gap: 6px; }
    .subsets { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }

    .injection-section { padding: 16px 0; }
    .inj-bar-container { margin-bottom: 16px; }
    .inj-bar { height: 8px; background: var(--bg-elevated); border-radius: 4px; overflow: hidden; margin-bottom: 6px; }
    .inj-fill { height: 100%; border-radius: 4px; transition: width 0.5s; }
    .inj-fill.ok { background: var(--success); }
    .inj-fill.warn { background: var(--warning); }
    .inj-fill.err { background: var(--danger); }
    .inj-pct { font-size: 12px; color: var(--text-muted); }
    .not-injected-list { display: flex; flex-direction: column; gap: 4px; }
    .ni-row { font-size: 13px; display: flex; align-items: center; gap: 6px; padding: 4px 0; }
    .all-good { color: var(--success); font-size: 13px; display: flex; align-items: center; gap: 6px; }

    .empty-state { text-align: center; padding: 60px 20px; color: var(--text-muted); }
    .empty-state i { font-size: 48px; margin-bottom: 16px; opacity: 0.3; }
    .empty-state h3 { font-size: 18px; margin: 0 0 8px; color: var(--text-primary); }
    .empty-tab { color: var(--text-muted); font-size: 13px; padding: 20px 0; }
    .status-warn { color: var(--warning); }

    .loading { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 60px; color: var(--text-muted); }
    .spin { width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (max-width: 768px) { .mesh-overview { grid-template-columns: repeat(2, 1fr); } }
  `],
})
export class MeshComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  data: any = null;
  loading = false;
  lastUpdated = '';
  activeTab = '0';
  private timer: any;

  ngOnInit() { this.refresh(); this.timer = setInterval(() => this.refresh(), 30000); }
  ngOnDestroy() { clearInterval(this.timer); }

  refresh() {
    this.loading = true;
    this.http.get<any>('/api/mesh/status').subscribe({
      next: (res) => { this.data = res; this.loading = false; this.lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); },
      error: () => { this.data = { mesh: null }; this.loading = false; },
    });
  }
}
