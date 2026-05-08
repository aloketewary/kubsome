import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-secrets',
  standalone: true,
  imports: [TagModule, ButtonModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Image Pull Secrets</h1>
        <p class="subtitle">Verify registry credentials across pods</p>
      </div>
      <button pButton icon="pi pi-refresh" label="Scan" class="p-button-outlined p-button-sm" (click)="load()"></button>
    </div>

    @if (data) {
      <!-- Summary -->
      <div class="summary-row">
        <div class="summary-card" [class.card-ok]="data.missing.length === 0" [class.card-bad]="data.missing.length > 0">
          <span class="summary-value">{{ data.missing.length }}</span>
          <span class="summary-label">Missing Secrets</span>
        </div>
        <div class="summary-card card-ok">
          <span class="summary-value">{{ data.found.length }}</span>
          <span class="summary-label">Verified</span>
        </div>
        <div class="summary-card">
          <span class="summary-value">{{ data.existing_docker_secrets.length }}</span>
          <span class="summary-label">Docker Secrets in NS</span>
        </div>
      </div>

      <!-- Missing Secrets -->
      @if (data.missing.length > 0) {
        <h3 class="section-title danger-title">
          <i class="pi pi-exclamation-triangle"></i>
          Missing Secrets ({{ data.missing.length }})
        </h3>
        <div class="secret-list">
          @for (item of data.missing; track $index) {
            <div class="secret-card missing">
              <div class="secret-icon"><i class="pi pi-lock"></i></div>
              <div class="secret-body">
                <div class="secret-name">{{ item.secret }}</div>
                <div class="secret-detail">
                  Referenced by <code>{{ item.pod }}</code>
                </div>
              </div>
              <p-tag value="MISSING" severity="danger" />
            </div>
          }
        </div>

        <div class="fix-hint">
          <i class="pi pi-info-circle"></i>
          <div>
            <strong>To fix:</strong> Create the missing secret(s):
            <pre class="fix-cmd">kubectl create secret docker-registry {{ data.missing[0].secret }} \\\n  --docker-server=&lt;registry&gt; \\\n  --docker-username=&lt;user&gt; \\\n  --docker-password=&lt;token&gt; \\\n  -n {{ data.namespace }}</pre>
          </div>
        </div>
      }

      <!-- Found Secrets -->
      @if (data.found.length > 0) {
        <h3 class="section-title success-title">
          <i class="pi pi-check-circle"></i>
          Verified Secrets ({{ data.found.length }})
        </h3>
        <div class="secret-list">
          @for (item of data.found; track $index) {
            <div class="secret-card found">
              <div class="secret-icon ok"><i class="pi pi-lock"></i></div>
              <div class="secret-body">
                <div class="secret-name">{{ item.secret }}</div>
                <div class="secret-detail">
                  Used by <code>{{ item.pod }}</code>
                </div>
              </div>
              <p-tag value="OK" severity="success" />
            </div>
          }
        </div>
      }

      <!-- Service Account Secrets -->
      @if (saEntries.length > 0) {
        <h3 class="section-title">Service Account Pull Secrets</h3>
        <div class="sa-list">
          @for (sa of saEntries; track sa.name) {
            <div class="sa-card">
              <div class="sa-name"><i class="pi pi-user"></i> {{ sa.name }}</div>
              <div class="sa-secrets">
                @if (sa.secrets.length > 0) {
                  @for (s of sa.secrets; track s) {
                    <p-tag [value]="s" severity="info" [rounded]="true" />
                  }
                } @else {
                  <span class="no-secrets">No pull secrets attached</span>
                }
              </div>
            </div>
          }
        </div>
      }
    } @else {
      <div class="loading">
        <i class="pi pi-spin pi-spinner"></i>
        Scanning image pull secrets...
      </div>
    }
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

    .summary-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 28px;
    }
    .summary-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 16px 20px;
      text-align: center;
    }
    .summary-card.card-ok { border-color: var(--success); border-left: 3px solid var(--success); }
    .summary-card.card-bad { border-color: var(--danger); border-left: 3px solid var(--danger); }
    .summary-value { display: block; font-size: 28px; font-weight: 700; letter-spacing: -0.03em; }
    .card-bad .summary-value { color: var(--danger); }
    .card-ok .summary-value { color: var(--success); }
    .summary-label { display: block; font-size: 11px; color: var(--text-muted); margin-top: 4px; text-transform: uppercase; letter-spacing: 0.04em; }

    .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 12px;
      margin-top: 24px;
    }
    .danger-title { color: var(--danger); }
    .danger-title i { font-size: 14px; }
    .success-title { color: var(--success); }
    .success-title i { font-size: 14px; }

    .secret-list { display: flex; flex-direction: column; gap: 6px; }
    .secret-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
    }
    .secret-card.missing { border-left: 3px solid var(--danger); }
    .secret-card.found { border-left: 3px solid var(--success); }
    .secret-icon {
      width: 32px; height: 32px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      background: var(--danger-subtle); color: var(--danger);
    }
    .secret-icon.ok { background: var(--success-subtle); color: var(--success); }
    .secret-body { flex: 1; }
    .secret-name { font-size: 13px; font-weight: 600; font-family: 'JetBrains Mono', monospace; }
    .secret-detail { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
    .secret-detail code { font-size: 11px; background: var(--bg-elevated); padding: 1px 4px; border-radius: 3px; }

    .fix-hint {
      display: flex;
      gap: 12px;
      padding: 16px;
      margin-top: 16px;
      background: var(--accent-subtle);
      border: 1px solid var(--accent);
      border-radius: var(--radius-sm);
      font-size: 13px;
    }
    .fix-hint i { color: var(--accent); font-size: 16px; margin-top: 2px; }
    .fix-cmd {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      margin-top: 8px;
      padding: 10px 12px;
      background: var(--bg-card);
      border-radius: 6px;
      white-space: pre-wrap;
    }

    .sa-list { display: flex; flex-direction: column; gap: 6px; }
    .sa-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
    }
    .sa-name { font-size: 13px; display: flex; align-items: center; gap: 8px; }
    .sa-name i { color: var(--text-muted); }
    .sa-secrets { display: flex; gap: 6px; flex-wrap: wrap; }
    .no-secrets { font-size: 11px; color: var(--text-muted); }

    .loading { display: flex; align-items: center; gap: 10px; color: var(--text-muted); padding: 40px; }
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
}
