import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-secrets',
  standalone: true,
  imports: [TagModule, ButtonModule, TooltipModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Pull Secrets</h1>
        <p class="subtitle">Image registry credential verification</p>
      </div>
      <button pButton icon="pi pi-refresh" label="Scan" class="p-button-outlined p-button-sm" (click)="load()"></button>
    </div>

    @if (data) {
      <!-- Status Hero -->
      <div class="status-hero" [class]="data.missing.length > 0 ? 'hero-bad' : 'hero-good'">
        <div class="hero-icon">
          <i class="pi" [class]="data.missing.length > 0 ? 'pi-exclamation-triangle' : 'pi-check-circle'"></i>
        </div>
        <div class="hero-info">
          <h2>{{ data.missing.length > 0 ? data.missing.length + ' Missing Secret' + (data.missing.length > 1 ? 's' : '') : 'All Secrets Verified' }}</h2>
          <p>{{ data.missing.length > 0 ? 'Pods cannot pull images without these credentials' : 'All referenced pull secrets exist in the namespace' }}</p>
        </div>
        <div class="hero-stats">
          <div class="hs"><span class="hs-val danger-text">{{ data.missing.length }}</span><span class="hs-label">Missing</span></div>
          <div class="hs"><span class="hs-val success-text">{{ data.found.length }}</span><span class="hs-label">Verified</span></div>
          <div class="hs"><span class="hs-val">{{ data.existing_docker_secrets.length }}</span><span class="hs-label">In NS</span></div>
        </div>
      </div>

      <!-- Missing Secrets -->
      @if (data.missing.length > 0) {
        <div class="section">
          <div class="section-header">
            <h3 class="danger-text"><i class="pi pi-exclamation-triangle"></i> Missing ({{ data.missing.length }})</h3>
          </div>

          @for (item of data.missing; track $index) {
            <div class="missing-card">
              <!-- Flow Diagram -->
              <div class="flow-diagram">
                <div class="flow-step">
                  <div class="flow-icon step-pod"><i class="pi pi-box"></i></div>
                  <span class="flow-val">{{ shortName(item.pod) }}</span>
                  <span class="flow-type">Pod</span>
                </div>
                <div class="flow-connector"><i class="pi pi-arrow-right"></i></div>
                <div class="flow-step">
                  <div class="flow-icon step-image"><i class="pi pi-image"></i></div>
                  <span class="flow-val">{{ shortImage(getFirstImage(item)) }}</span>
                  <span class="flow-type">Image</span>
                </div>
                <div class="flow-connector"><i class="pi pi-arrow-right"></i></div>
                <div class="flow-step">
                  <div class="flow-icon step-registry"><i class="pi pi-globe"></i></div>
                  <span class="flow-val">{{ getFirstRegistry(item) }}</span>
                  <span class="flow-type">Registry</span>
                </div>
                <div class="flow-connector"><i class="pi pi-arrow-right"></i></div>
                <div class="flow-step step-missing">
                  <div class="flow-icon step-secret"><i class="pi pi-lock"></i></div>
                  <span class="flow-val">{{ item.secret }}</span>
                  <span class="flow-type">Secret ❌</span>
                </div>
              </div>

              <!-- Fix Command -->
              <div class="fix-block">
                <div class="fix-header">
                  <span class="fix-label">Fix command:</span>
                  <button pButton icon="pi pi-copy" class="p-button-sm p-button-text p-button-rounded" pTooltip="Copy" (click)="copyFix(item)"></button>
                </div>
                <pre class="fix-cmd">kubectl create secret docker-registry {{ item.secret }} \
  --docker-server={{ getFirstRegistry(item) }} \
  --docker-username=&lt;user&gt; \
  --docker-password=&lt;token&gt; \
  -n {{ data.namespace }}</pre>
              </div>
            </div>
          }
        </div>
      }

      <!-- Verified Secrets -->
      @if (data.found.length > 0) {
        <div class="section">
          <div class="section-header">
            <h3 class="success-text"><i class="pi pi-check-circle"></i> Verified ({{ data.found.length }})</h3>
          </div>
          <div class="verified-grid">
            @for (item of data.found; track $index) {
              <div class="verified-card">
                <div class="vc-icon"><i class="pi pi-lock"></i></div>
                <div class="vc-body">
                  <code class="vc-name">{{ item.secret }}</code>
                  <span class="vc-pod">{{ shortName(item.pod) }}</span>
                  @if (item.registry_in_secret) {
                    <span class="vc-registry">{{ item.registry_in_secret }}</span>
                  }
                </div>
                <p-tag value="✓" severity="success" [rounded]="true" />
              </div>
            }
          </div>
        </div>
      }

      <!-- Service Accounts -->
      @if (saEntries.length > 0) {
        <div class="section">
          <div class="section-header">
            <h3><i class="pi pi-user"></i> Service Accounts</h3>
          </div>
          <div class="sa-grid">
            @for (sa of saEntries; track sa.name) {
              <div class="sa-card" [class.sa-empty]="sa.secrets.length === 0">
                <div class="sa-icon" [class.sa-icon-ok]="sa.secrets.length > 0" [class.sa-icon-empty]="sa.secrets.length === 0">
                  <i class="pi" [class]="sa.secrets.length > 0 ? 'pi-check' : 'pi-minus'"></i>
                </div>
                <div class="sa-body">
                  <code class="sa-name">{{ sa.name }}</code>
                  <div class="sa-secrets-row">
                    @if (sa.secrets.length > 0) {
                      @for (s of sa.secrets; track s) {
                        <span class="sa-secret-chip">{{ s }}</span>
                      }
                    } @else {
                      <span class="sa-no-secrets">No pull secrets</span>
                    }
                  </div>
                </div>
              </div>
            }
          </div>
        </div>
      }
    } @else {
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <span>Scanning image pull secrets...</span>
      </div>
    }
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

    /* Status Hero */
    .status-hero {
      display: flex; align-items: center; gap: 16px;
      padding: 20px 24px; margin-bottom: 24px; border-radius: var(--radius);
    }
    .hero-bad { background: linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.02)); border: 1px solid rgba(239,68,68,0.2); }
    .hero-good { background: linear-gradient(135deg, rgba(34,197,94,0.08), rgba(34,197,94,0.02)); border: 1px solid rgba(34,197,94,0.2); }
    .hero-icon { font-size: 28px; }
    .hero-bad .hero-icon { color: var(--danger); }
    .hero-good .hero-icon { color: var(--success); }
    .hero-info { flex: 1; }
    .hero-info h2 { font-size: 18px; font-weight: 700; margin: 0 0 4px; }
    .hero-info p { font-size: 13px; color: var(--text-secondary); margin: 0; }
    .hero-stats { display: flex; gap: 16px; }
    .hs { text-align: center; padding: 6px 14px; background: var(--bg-elevated); border-radius: 8px; }
    .hs-val { display: block; font-size: 18px; font-weight: 700; }
    .danger-text { color: var(--danger); }
    .success-text { color: var(--success); }
    .hs-label { display: block; font-size: 9px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }

    /* Sections */
    .section { margin-bottom: 28px; }
    .section-header { margin-bottom: 12px; }
    .section-header h3 { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px; margin: 0; }
    .section-header h3 i { font-size: 13px; }

    /* Missing Cards */
    .missing-card {
      background: var(--bg-card); border: 1px solid var(--border); border-left: 3px solid var(--danger);
      border-radius: var(--radius); padding: 16px; margin-bottom: 10px;
    }
    .flow-diagram { display: flex; align-items: center; gap: 6px; margin-bottom: 14px; flex-wrap: wrap; }
    .flow-step { display: flex; flex-direction: column; align-items: center; gap: 3px; min-width: 80px; }
    .flow-icon {
      width: 32px; height: 32px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center; font-size: 14px;
    }
    .step-pod { background: var(--accent-subtle); color: var(--accent); }
    .step-image { background: rgba(168,85,247,0.1); color: var(--purple); }
    .step-registry { background: var(--success-subtle); color: var(--success); }
    .step-secret { background: var(--danger-subtle); color: var(--danger); }
    .step-missing .flow-val { color: var(--danger); font-weight: 600; }
    .flow-val { font-size: 10px; font-family: 'JetBrains Mono', monospace; text-align: center; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .flow-type { font-size: 9px; color: var(--text-muted); text-transform: uppercase; }
    .flow-connector { color: var(--text-muted); font-size: 10px; margin-bottom: 14px; }

    .fix-block { background: var(--bg-elevated); border-radius: 8px; padding: 10px 14px; }
    .fix-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
    .fix-label { font-size: 11px; color: var(--text-muted); font-weight: 500; }
    .fix-cmd {
      font-family: 'JetBrains Mono', monospace; font-size: 11px;
      margin: 0; white-space: pre-wrap; color: var(--text-secondary);
    }

    /* Verified */
    .verified-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 8px; }
    .verified-card {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 14px; background: var(--bg-card);
      border: 1px solid var(--border); border-left: 3px solid var(--success);
      border-radius: var(--radius);
    }
    .vc-icon {
      width: 28px; height: 28px; border-radius: 6px;
      background: var(--success-subtle); color: var(--success);
      display: flex; align-items: center; justify-content: center; font-size: 12px; flex-shrink: 0;
    }
    .vc-body { flex: 1; min-width: 0; }
    .vc-name { font-size: 12px; font-weight: 600; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .vc-pod { font-size: 10px; color: var(--text-muted); display: block; }
    .vc-registry { font-size: 10px; color: var(--text-muted); display: block; }

    /* Service Accounts */
    .sa-grid { display: flex; flex-direction: column; gap: 6px; }
    .sa-card {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 14px; background: var(--bg-card);
      border: 1px solid var(--border); border-radius: var(--radius);
    }
    .sa-card.sa-empty { opacity: 0.7; }
    .sa-icon {
      width: 24px; height: 24px; border-radius: 6px;
      display: flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0;
    }
    .sa-icon-ok { background: var(--success-subtle); color: var(--success); }
    .sa-icon-empty { background: var(--bg-elevated); color: var(--text-muted); }
    .sa-body { flex: 1; }
    .sa-name { font-size: 12px; font-weight: 500; display: block; margin-bottom: 3px; }
    .sa-secrets-row { display: flex; gap: 4px; flex-wrap: wrap; }
    .sa-secret-chip {
      font-size: 10px; font-family: 'JetBrains Mono', monospace;
      padding: 2px 6px; border-radius: 3px;
      background: var(--accent-subtle); color: var(--accent); border: 1px solid var(--accent);
    }
    .sa-no-secrets { font-size: 10px; color: var(--text-muted); }

    /* Loading */
    .loading-state { display: flex; align-items: center; gap: 12px; padding: 48px; color: var(--text-muted); justify-content: center; }
    .loading-spinner {
      width: 20px; height: 20px; border: 2px solid var(--border); border-top-color: var(--accent);
      border-radius: 50%; animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class SecretsComponent implements OnInit {
  private http = inject(HttpClient);
  data: any = null;
  saEntries: { name: string; secrets: string[] }[] = [];

  ngOnInit() { this.load(); }

  load() {
    this.data = null;
    this.http.get<any>('http://localhost:8000/api/image-pull-secrets').subscribe(res => {
      this.data = res;
      this.saEntries = Object.entries(res.service_account_secrets || {}).map(
        ([name, secrets]) => ({ name, secrets: secrets as string[] })
      );
    });
  }

  getFirstImage(item: any): string { return item.images?.[0] || 'unknown'; }
  getFirstRegistry(item: any): string { return item.registries_needed?.[0] || '<registry>'; }

  shortName(name: string): string {
    return name.length > 35 ? '...' + name.slice(-32) : name;
  }

  shortImage(image: string): string {
    // Show just the image name:tag, not full registry path
    const parts = image.split('/');
    return parts[parts.length - 1] || image;
  }

  copyFix(item: any) {
    const cmd = `kubectl create secret docker-registry ${item.secret} \\\n  --docker-server=${this.getFirstRegistry(item)} \\\n  --docker-username=<user> \\\n  --docker-password=<token> \\\n  -n ${this.data.namespace}`;
    navigator.clipboard.writeText(cmd);
  }
}
