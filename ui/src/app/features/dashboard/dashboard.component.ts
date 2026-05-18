import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ApiService } from '../../core/services/api.service';
import { OverviewResponse, KubeEvent } from '../../core/models';
import { SpotlightComponent } from '../../shared/components/spotlight.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [TagModule, ButtonModule, TooltipModule, SpotlightComponent],
  template: `
    @if (data) {
      <app-spotlight id="dashboard" title="Cluster Dashboard" icon="pi pi-th-large"
        description="Real-time overview of your cluster health. Cards show pod, node, and deployment status at a glance."
        [capabilities]="['Health scoring across pods, nodes, deployments', 'Anomaly alerts with auto-detection', 'Quick navigation to problem areas', 'Recent events timeline']" />
      <div class="hero" [class]="'hero-' + overallHealth">
        <div class="hero-mesh"></div>
        <div class="hero-orb hero-orb-1"></div>
        <div class="hero-orb hero-orb-2"></div>
        <div class="hero-orb hero-orb-3"></div>
        <div class="hero-glass">
          <div class="hero-ring">
            <svg viewBox="0 0 36 36" class="ring-svg">
              <path class="ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path class="ring-fill" [attr.stroke-dasharray]="healthPct + ', 100'" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            </svg>
            <span class="ring-value">{{ healthPct }}%</span>
          </div>
          <div class="hero-info">
            <h1 class="hero-title">{{ overallHealth === 'healthy' ? 'All Systems Operational' : overallHealth === 'degraded' ? 'Degraded Performance' : 'Critical Issues Detected' }}</h1>
            <p class="hero-sub">{{ data.pods.healthy + data.nodes.healthy + data.deployments.healthy }} / {{ podTotal + nodeTotal + depTotal }} resources healthy</p>
          </div>
          <div class="hero-actions">
            <span class="hero-time">{{ lastUpdated }}</span>
            <button class="customize-btn" (click)="router.navigate(['/my-dashboard'])" title="Customize Dashboard" aria-label="Customize Dashboard">
              <i class="pi pi-sliders-h"></i>
            </button>
            <button class="refresh-btn" [class.spinning]="refreshing"
              (click)="refresh()" (keydown)="onKey($event, refresh.bind(this))"
              aria-label="Refresh Dashboard" title="Refresh">
              <i class="pi pi-refresh"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- Growth: Empty State -->
      @if (isClusterEmpty) {
        <div class="empty-state-card glass stagger-1">
          <div class="empty-icon"><i class="pi pi-compass"></i></div>
          <div class="empty-content">
            <h3>Welcome to Kubsome!</h3>
            <p>We didn't find any resources in the current namespace. Try exploring other namespaces or use the AI Assistant to get started.</p>
            <div class="empty-actions">
              <button class="btn-primary" (click)="router.navigate(['/namespace'])">Switch Namespace</button>
              <button class="btn-secondary" (click)="router.navigate(['/ai'])">Ask AI Assistant</button>
            </div>
          </div>
        </div>
      }

      <!-- Growth: Smart Insights -->
      <div class="insights-row stagger-1">
        <div class="insight-pill" (click)="router.navigate(['/scorecard'])" tabindex="0" role="button" (keydown)="onKey($event, router.navigate.bind(router, ['/scorecard']))">
          <i class="pi pi-trophy"></i>
          <span>Check Cluster Scorecard</span>
        </div>
        <div class="insight-pill" (click)="router.navigate(['/cost'])" tabindex="0" role="button" (keydown)="onKey($event, router.navigate.bind(router, ['/cost']))">
          <i class="pi pi-chart-line"></i>
          <span>Optimize Resource Costs</span>
        </div>
        @if (data && pins.length === 0) {
          <div class="insight-pill suggested" (click)="router.navigate(['/ai'])" tabindex="0" role="button" (keydown)="onKey($event, router.navigate.bind(router, ['/ai']))">
            <i class="pi pi-bookmark"></i>
            <span>Tip: Pin your favorite AI queries</span>
          </div>
        }
        @if (stats && stats.unresolved_count > 0) {
          <div class="insight-pill suggested" (click)="router.navigate(['/stats'])" tabindex="0" role="button" (keydown)="onKey($event, router.navigate.bind(router, ['/stats']))">
            <i class="pi pi-question-circle"></i>
            <span>Review {{ stats.unresolved_count }} unresolved queries</span>
          </div>
        }
      </div>

      <!-- Alert -->
      @if ((data.pods.critical) > 0 || data.nodes.warning > 0) {
        <div class="alert-banner">
          <div class="alert-pulse"></div>
          <i class="pi pi-exclamation-triangle"></i>
          <span>
            @if ((data.pods.critical) > 0) { {{ data.pods.critical }} pod(s) critical. }
            @if (data.nodes.warning > 0) { {{ data.nodes.warning }} node(s) not ready. }
          </span>
          <button class="alert-action" (click)="goToPods()">Investigate <i class="pi pi-arrow-right"></i></button>
        </div>
      }

      <!-- Bento Metrics -->
      <div class="bento-grid">
        <div class="bento-card bento-pods stagger-1" (click)="goToPods()" (keydown)="onKey($event, goToPods.bind(this))" tabindex="0" role="button" aria-label="View Pods">
          <div class="bento-header">
            <div class="bento-icon pods"><i class="pi pi-box"></i></div>
            <span class="bento-label">Pods</span>
          </div>
          <div class="bento-value-row">
            <span class="bento-value">{{ data.pods.healthy }}</span>
            <span class="bento-total">/ {{ podTotal }}</span>
          </div>
          <div class="bento-bar">
            <div class="bar-fill bar-ok" [style.width.%]="pct(data.pods.healthy, podTotal)"></div>
            <div class="bar-fill bar-warn" [style.width.%]="pct(data.pods.warning, podTotal)"></div>
            <div class="bar-fill bar-crit" [style.width.%]="pct(data.pods.critical, podTotal)"></div>
          </div>
          <div class="bento-pills">
            @if (data.pods.warning > 0) { <span class="pill pill-warn">{{ data.pods.warning }} warn</span> }
            @if (data.pods.critical > 0) { <span class="pill pill-crit">{{ data.pods.critical }} crit</span> }
            @if (data.pods.warning === 0 && data.pods.critical === 0) { <span class="pill pill-ok">Healthy</span> }
          </div>
        </div>

        <div class="bento-card bento-nodes stagger-2" (click)="router.navigate(['/metrics'])" (keydown)="onKey($event, router.navigate.bind(router, ['/metrics']))" tabindex="0" role="button" aria-label="View Node Metrics">
          <div class="bento-header">
            <div class="bento-icon nodes"><i class="pi pi-server"></i></div>
            <span class="bento-label">Nodes</span>
          </div>
          <div class="bento-value-row">
            <span class="bento-value">{{ data.nodes.healthy }}</span>
            <span class="bento-total">/ {{ nodeTotal }}</span>
          </div>
          <div class="bento-bar">
            <div class="bar-fill bar-ok" [style.width.%]="pct(data.nodes.healthy, nodeTotal)"></div>
            <div class="bar-fill bar-warn" [style.width.%]="pct(data.nodes.warning, nodeTotal)"></div>
          </div>
          <div class="bento-pills">
            @if (data.nodes.warning > 0) { <span class="pill pill-warn">{{ data.nodes.warning }} not ready</span> }
            @else { <span class="pill pill-ok">All ready</span> }
          </div>
        </div>

        <div class="bento-card bento-deps stagger-3" (click)="router.navigate(['/deployments'])" (keydown)="onKey($event, router.navigate.bind(router, ['/deployments']))" tabindex="0" role="button" aria-label="View Deployments">
          <div class="bento-header">
            <div class="bento-icon deploys"><i class="pi pi-send"></i></div>
            <span class="bento-label">Deployments</span>
          </div>
          <div class="bento-value-row">
            <span class="bento-value">{{ data.deployments.healthy }}</span>
            <span class="bento-total">/ {{ depTotal }}</span>
          </div>
          <div class="bento-bar">
            <div class="bar-fill bar-ok" [style.width.%]="pct(data.deployments.healthy, depTotal)"></div>
            <div class="bar-fill bar-crit" [style.width.%]="pct(data.deployments.unavailable, depTotal)"></div>
          </div>
          <div class="bento-pills">
            @if (data.deployments.unavailable > 0) { <span class="pill pill-crit">{{ data.deployments.unavailable }} down</span> }
            @else { <span class="pill pill-ok">All available</span> }
          </div>
        </div>

        <!-- Uptime Card -->
        <div class="bento-card bento-uptime stagger-4" [class.uptime-up]="!uptime?.cluster_down" [class.uptime-down]="uptime?.cluster_down">
          <div class="uptime-row">
            <div class="uptime-ring-wrap">
              <div class="uptime-ring" [class.ring-up]="!uptime?.cluster_down" [class.ring-down]="uptime?.cluster_down"></div>
            </div>
            <div class="uptime-info">
              <span class="uptime-title">{{ uptime?.cluster_down ? 'Cluster Down' : 'Cluster Operational' }}</span>
              <span class="uptime-ctx" [pTooltip]="contextCopied ? 'Copied!' : (uptime?.context || 'Copy Context')" tooltipPosition="bottom"
                (click)="copyContext()" (keydown)="onKey($event, copyContext.bind(this))"
                tabindex="0" role="button" [attr.aria-label]="contextCopied ? 'Copied!' : 'Copy Context'">{{ uptime?.context }}</span>
            </div>
            <div class="uptime-stats">
              @if (uptime?.nodes?.length && !uptime?.cluster_down) {
                <div class="ustat"><span class="ustat-val">{{ uptime.nodes.length }}</span><span class="ustat-lbl">Nodes</span></div>
                <div class="ustat"><span class="ustat-val">{{ getReadyNodes() }}</span><span class="ustat-lbl">Ready</span></div>
                <div class="ustat"><span class="ustat-val">{{ uptime.pods?.running || 0 }}</span><span class="ustat-lbl">Pods</span></div>
                <div class="ustat"><span class="ustat-val">{{ getMaxUptime() }}</span><span class="ustat-lbl">Uptime</span></div>
              }
            </div>
            <span class="uptime-day-pill">{{ uptime?.day }}</span>
          </div>
          @if (uptime?.downtime_hint) {
            <div class="uptime-alert"><i class="pi pi-exclamation-triangle"></i> {{ uptime.downtime_hint }}</div>
          }
        </div>
      </div>

      <!-- Charts -->
      <div class="charts-row">
        <div class="chart-card stagger-5">
          <div class="chart-header">
            <h3>Event Activity</h3>
            <span class="chart-badge">{{ recentEvents.length }} events</span>
          </div>
          <div class="bar-chart">
            @for (bar of activityBars; track $index) {
              <div class="chart-bar-wrap">
                <div class="chart-bar" [style.height.%]="bar" [class.bar-high]="bar > 70" [class.bar-med]="bar > 40 && bar <= 70"></div>
              </div>
            }
          </div>
        </div>

        <div class="chart-card stagger-6">
          <div class="chart-header">
            <h3>Pod Distribution</h3>
          </div>
          <div class="donut-chart">
            <svg viewBox="0 0 42 42" class="donut-svg">
              <circle class="donut-bg" cx="21" cy="21" r="15.9" />
              <circle class="donut-ok" cx="21" cy="21" r="15.9" [attr.stroke-dasharray]="podRunningDash" stroke-dashoffset="25" />
              <circle class="donut-warn" cx="21" cy="21" r="15.9" [attr.stroke-dasharray]="podWarnDash" [attr.stroke-dashoffset]="podWarnOffset" />
              <circle class="donut-crit" cx="21" cy="21" r="15.9" [attr.stroke-dasharray]="podCritDash" [attr.stroke-dashoffset]="podCritOffset" />
            </svg>
            <div class="donut-center">
              <span class="donut-total">{{ podTotal }}</span>
              <span class="donut-label">pods</span>
            </div>
          </div>
          <div class="donut-legend">
            <span class="dl-item"><span class="dl-dot dl-ok"></span>{{ data.pods.healthy }}</span>
            <span class="dl-item"><span class="dl-dot dl-warn"></span>{{ data.pods.warning }}</span>
            <span class="dl-item"><span class="dl-dot dl-crit"></span>{{ data.pods.critical }}</span>
          </div>
        </div>
      </div>

      <!-- Bottom: Events + Actions -->
      <div class="bottom-grid">
        <div class="bottom-section">
          <div class="section-header">
            <h2>Recent Events</h2>
            <button class="see-all-btn" (click)="router.navigate(['/events'])">View all <i class="pi pi-arrow-right"></i></button>
          </div>
          <div class="events-card">
            @for (event of recentEvents; track $index) {
              <div class="event-row">
                <div class="event-dot" [class.warn]="event.type === 'Warning'"></div>
                <div class="event-content">
                  <span class="event-reason">{{ event.reason }}</span>
                  <span class="event-msg">{{ event.message }}</span>
                </div>
                <code class="event-obj">{{ event.object }}</code>
              </div>
            }
            @if (recentEvents.length === 0) {
              <div class="events-empty"><i class="pi pi-check-circle"></i> No recent events</div>
            }
          </div>
        </div>

        <div class="bottom-section">
          <div class="section-header">
            <h2>Quick Actions</h2>
          </div>
          <div class="actions-grid">
            <div class="action-card" (click)="router.navigate(['/ai'])" (keydown)="onKey($event, router.navigate.bind(router, ['/ai']))" tabindex="0" role="button">
              <i class="pi pi-sparkles"></i>
              <span>AI Summary</span>
            </div>
            <div class="action-card" (click)="router.navigate(['/terminal'])" (keydown)="onKey($event, router.navigate.bind(router, ['/terminal']))" tabindex="0" role="button">
              <i class="pi pi-code"></i>
              <span>Terminal</span>
            </div>
            <div class="action-card" (click)="router.navigate(['/runbooks'])" (keydown)="onKey($event, router.navigate.bind(router, ['/runbooks']))" tabindex="0" role="button">
              <i class="pi pi-book"></i>
              <span>Runbooks</span>
            </div>
            <div class="action-card" (click)="router.navigate(['/incident'])" (keydown)="onKey($event, router.navigate.bind(router, ['/incident']))" tabindex="0" role="button">
              <i class="pi pi-exclamation-circle"></i>
              <span>Incident</span>
            </div>
            <div class="action-card" (click)="router.navigate(['/secrets'])" (keydown)="onKey($event, router.navigate.bind(router, ['/secrets']))" tabindex="0" role="button">
              <i class="pi pi-lock"></i>
              <span>Secrets</span>
            </div>
            <div class="action-card" (click)="router.navigate(['/cost'])" (keydown)="onKey($event, router.navigate.bind(router, ['/cost']))" tabindex="0" role="button">
              <i class="pi pi-dollar"></i>
              <span>Optimize</span>
            </div>
          </div>
        </div>
      </div>
    } @else {
      <!-- Skeleton -->
      <div class="skeleton-hero skeleton"></div>
      <div class="skeleton-grid">
        <div class="skeleton-card skeleton"></div>
        <div class="skeleton-card skeleton"></div>
        <div class="skeleton-card skeleton"></div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
      padding: 4px 0 32px;
      max-width: 100%;
      overflow: visible;
    }

    /* Empty State */
    .empty-state-card {
      display: flex; align-items: center; gap: 24px;
      padding: 24px 32px; margin-bottom: 24px;
      border-radius: 20px; border: 1px solid var(--border);
      background: var(--bg-card);
    }
    .empty-icon {
      width: 64px; height: 64px; border-radius: 16px;
      background: var(--accent-subtle); color: var(--accent);
      display: flex; align-items: center; justify-content: center; font-size: 28px;
    }
    .empty-content h3 { margin: 0 0 8px; font-size: 18px; font-weight: 700; }
    .empty-content p { margin: 0 0 16px; color: var(--text-muted); font-size: 14px; line-height: 1.5; }
    .empty-actions { display: flex; gap: 12px; }
    .btn-primary {
      background: var(--accent); color: #fff; border: none; padding: 8px 16px;
      border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;
    }
    .btn-secondary {
      background: var(--bg-elevated); color: var(--text); border: 1px solid var(--border);
      padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;
    }

    /* Insights Pill */
    .insights-row { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
    .insight-pill {
      display: flex; align-items: center; gap: 8px; padding: 8px 16px;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 20px;
      font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s;
    }
    .insight-pill:hover { border-color: var(--accent); background: var(--accent-subtle); color: var(--accent); transform: translateY(-1px); }
    .insight-pill.suggested { border-style: dashed; opacity: 0.8; }
    .insight-pill i { font-size: 14px; }

    /* Hero — Glassmorphism + Mesh Gradient */
    .hero {
      position: relative;
      border-radius: 20px;
      margin-bottom: 28px;
      overflow: hidden;
      isolation: isolate;
    }
    .hero-mesh {
      position: absolute; inset: 0; z-index: 0;
      background: linear-gradient(135deg, rgba(15,15,20,0.9), rgba(20,20,30,0.85));
    }
    :host-context([data-theme="light"]) .hero-mesh {
      background: linear-gradient(135deg, rgba(241,245,249,0.95), rgba(226,232,240,0.9));
    }
    .hero-orb {
      position: absolute; border-radius: 50%; filter: blur(60px); opacity: 0.5;
      animation: orbFloat 8s ease-in-out infinite alternate;
    }
    .hero-orb-1 { width: 200px; height: 200px; top: -40px; left: -30px; }
    .hero-orb-2 { width: 160px; height: 160px; bottom: -50px; right: 10%; animation-delay: -3s; }
    .hero-orb-3 { width: 120px; height: 120px; top: 20%; right: -20px; animation-delay: -5s; }
    .hero-healthy .hero-orb-1 { background: rgba(34,197,94,0.4); }
    .hero-healthy .hero-orb-2 { background: rgba(56,189,248,0.3); }
    .hero-healthy .hero-orb-3 { background: rgba(34,197,94,0.25); }
    .hero-degraded .hero-orb-1 { background: rgba(234,179,8,0.4); }
    .hero-degraded .hero-orb-2 { background: rgba(251,146,60,0.3); }
    .hero-degraded .hero-orb-3 { background: rgba(234,179,8,0.25); }
    .hero-critical .hero-orb-1 { background: rgba(239,68,68,0.4); }
    .hero-critical .hero-orb-2 { background: rgba(244,63,94,0.3); }
    .hero-critical .hero-orb-3 { background: rgba(239,68,68,0.25); }
    @keyframes orbFloat {
      0% { transform: translate(0, 0) scale(1); }
      100% { transform: translate(15px, -10px) scale(1.1); }
    }

    .hero-glass {
      position: relative; z-index: 1;
      display: flex; align-items: center; gap: 24px;
      padding: 36px 40px;
      backdrop-filter: blur(20px) saturate(1.4);
      -webkit-backdrop-filter: blur(20px) saturate(1.4);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 20px;
      background: rgba(255,255,255,0.03);
    }

    .hero-ring { position: relative; width: 72px; height: 72px; flex-shrink: 0; }
    .ring-svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    .ring-bg { fill: none; stroke: rgba(255,255,255,0.08); stroke-width: 3; }
    .ring-fill { fill: none; stroke-width: 3.5; stroke-linecap: round; transition: stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1); }
    .hero-healthy .ring-fill { stroke: #22c55e; filter: drop-shadow(0 0 6px rgba(34,197,94,0.5)); }
    .hero-degraded .ring-fill { stroke: #eab308; filter: drop-shadow(0 0 6px rgba(234,179,8,0.5)); }
    .hero-critical .ring-fill { stroke: #ef4444; filter: drop-shadow(0 0 6px rgba(239,68,68,0.5)); }
    .ring-value {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 15px; font-weight: 800; letter-spacing: -0.02em;
      color: #fff;
    }
    :host-context([data-theme="light"]) .ring-value { color: var(--text); }

    .hero-info { flex: 1; }
    .hero-title { font-size: 24px; font-weight: 800; letter-spacing: -0.03em; margin: 0; color: #fff; }
    :host-context([data-theme="light"]) .hero-title { color: var(--text); }
    .hero-sub { font-size: 13px; color: rgba(255,255,255,0.55); margin: 6px 0 0; font-weight: 400; }
    :host-context([data-theme="light"]) .hero-sub { color: var(--text-secondary); }
    .hero-actions { display: flex; align-items: center; gap: 12px; }
    .hero-time { font-size: 11px; color: rgba(255,255,255,0.35); font-variant-numeric: tabular-nums; }
    :host-context([data-theme="light"]) .hero-time { color: var(--text-muted); }
    .refresh-btn {
      width: 36px; height: 36px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.1);
      background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.7);
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: all 0.2s cubic-bezier(0.34,1.56,0.64,1);
    }
    .customize-btn {
      width: 36px; height: 36px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.1);
      background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.7);
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: all 0.2s cubic-bezier(0.34,1.56,0.64,1);
    }
    .customize-btn:hover { background: rgba(255,255,255,0.12); border-color: var(--accent); color: var(--accent); }
    :host-context([data-theme="light"]) .customize-btn {
      border-color: var(--border); background: var(--bg-elevated); color: var(--text-muted);
    }
    :host-context([data-theme="light"]) .refresh-btn {
      border-color: var(--border); background: var(--bg-elevated); color: var(--text-muted);
    }
    .refresh-btn:hover { background: rgba(255,255,255,0.12); transform: scale(1.1) rotate(45deg); border-color: rgba(255,255,255,0.2); }
    .refresh-btn:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--accent); }
    .refresh-btn.spinning i { animation: spin 0.8s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

    /* Alert Banner */
    .alert-banner {
      display: flex; align-items: center; gap: 12px;
      padding: 14px 18px;
      background: rgba(239,68,68,0.06);
      border: 1px solid rgba(239,68,68,0.2);
      border-radius: 14px;
      margin-bottom: 22px;
      font-size: 13px;
      backdrop-filter: blur(8px);
      animation: slideDown 0.4s cubic-bezier(0.34,1.56,0.64,1);
    }
    @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
    .alert-banner i { color: var(--danger); font-size: 16px; }
    .alert-banner span { flex: 1; }
    .alert-pulse {
      width: 8px; height: 8px; border-radius: 50%; background: var(--danger);
      box-shadow: 0 0 8px var(--danger); animation: pulse 2s infinite;
    }
    @keyframes pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.8); } }
    .alert-action {
      background: none; border: 1px solid rgba(239,68,68,0.3); color: var(--danger);
      padding: 6px 12px; border-radius: 8px; font-size: 12px; cursor: pointer;
      transition: all 0.2s; display: flex; align-items: center; gap: 4px;
    }
    .alert-action:hover { background: rgba(239,68,68,0.1); border-color: var(--danger); }

    /* Bento Grid */
    .bento-grid {
      display: grid;
      grid-template-columns: 1.4fr 1fr 1fr;
      grid-template-rows: auto auto;
      gap: 14px;
      margin-bottom: 28px;
    }
    .bento-uptime { grid-column: 1 / -1; cursor: default; }
    .uptime-up { border-color: rgba(16,185,129,0.15); }
    .uptime-down { border-color: rgba(244,63,94,0.25); }
    .bento-card {
      padding: 22px 24px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1);
      position: relative; overflow: hidden;
    }
    .bento-card::before {
      content: ''; position: absolute; inset: 0;
      background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.03), transparent 70%);
      pointer-events: none;
    }
    .bento-card:hover {
      transform: translateY(-3px) scale(1.005);
      border-color: var(--border-hover);
      box-shadow: 0 12px 40px -12px rgba(0,0,0,0.3);
    }
    .bento-card:focus-visible {
      outline: none;
      border-color: var(--accent);
      box-shadow: inset 0 0 0 1px var(--accent), 0 12px 40px -12px rgba(0,0,0,0.3);
    }
    .bento-pods { grid-column: 1; }

    .bento-header { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
    .bento-icon {
      width: 36px; height: 36px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center; font-size: 16px;
    }
    .bento-icon.pods { background: var(--accent-subtle); color: var(--accent); }
    .bento-icon.nodes { background: var(--success-subtle); color: var(--success); }
    .bento-icon.deploys { background: rgba(168,85,247,0.1); color: #a855f7; }
    .bento-label { font-size: 12px; font-weight: 500; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }

    .bento-value-row { display: flex; align-items: baseline; gap: 4px; margin-bottom: 14px; }
    .bento-value { font-size: 36px; font-weight: 800; letter-spacing: -0.04em; }
    .bento-total { font-size: 16px; color: var(--text-muted); font-weight: 400; }

    .bento-bar {
      height: 6px; border-radius: 3px; background: var(--bg-elevated);
      display: flex; overflow: hidden; margin-bottom: 12px;
    }
    .bar-fill { height: 100%; transition: width 0.6s cubic-bezier(0.4,0,0.2,1); }
    .bar-ok { background: var(--success); }
    .bar-warn { background: var(--warning); }
    .bar-crit { background: var(--danger); }

    .bento-pills { display: flex; gap: 6px; flex-wrap: wrap; }
    .pill {
      font-size: 11px; font-weight: 600; padding: 4px 10px;
      border-radius: 20px; letter-spacing: 0.01em;
    }
    .pill-ok { background: rgba(34,197,94,0.1); color: #22c55e; }
    .pill-warn { background: rgba(234,179,8,0.1); color: #eab308; }
    .pill-crit { background: rgba(239,68,68,0.1); color: #ef4444; box-shadow: 0 0 8px rgba(239,68,68,0.15); }

    /* Uptime Card */
    .uptime-row { display: flex; align-items: center; gap: 16px; }
    .uptime-ring-wrap {
      width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: var(--bg-elevated);
    }
    .uptime-ring {
      width: 16px; height: 16px; border-radius: 50%;
      animation: ringPulse 2.5s ease-in-out infinite;
    }
    .ring-up { background: var(--success); box-shadow: 0 0 10px rgba(16,185,129,0.5); }
    .ring-down { background: var(--danger); box-shadow: 0 0 10px rgba(244,63,94,0.5); animation: blink 1.5s infinite; }
    @keyframes ringPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(0.85); opacity: 0.7; } }
    @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

    .uptime-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .uptime-title { font-size: 14px; font-weight: 700; }
    .uptime-up .uptime-title { color: var(--success); }
    .uptime-down .uptime-title { color: var(--danger); }
    .uptime-ctx { font-size: 11px; color: var(--text-muted); font-family: 'JetBrains Mono', monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
    .uptime-ctx:hover { color: var(--accent); }
    .uptime-ctx:focus-visible { outline: none; color: var(--accent); text-decoration: underline; }

    .uptime-stats { display: flex; gap: 20px; flex-shrink: 0; }
    .ustat { display: flex; flex-direction: column; align-items: center; gap: 1px; }
    .ustat-val { font-size: 16px; font-weight: 800; letter-spacing: -0.03em; }
    .ustat-lbl { font-size: 9px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }

    .uptime-day-pill { font-size: 11px; font-weight: 500; color: var(--text-muted); padding: 4px 12px; background: var(--bg-elevated); border-radius: 20px; flex-shrink: 0; }

    .uptime-alert {
      display: flex; align-items: center; gap: 8px; margin-top: 14px;
      padding: 8px 14px; background: var(--danger-subtle); border-radius: 10px;
      font-size: 12px; color: var(--danger);
    }

    @media (max-width: 900px) { .bento-grid { grid-template-columns: 1fr; } }

    /* Charts Row */
    .charts-row {
      display: grid;
      grid-template-columns: 1.6fr 1fr;
      gap: 14px;
      margin-bottom: 28px;
    }
    .chart-card {
      padding: 20px 24px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      transition: border-color 0.2s;
    }
    .chart-card:hover { border-color: var(--border-hover); }
    .chart-header {
      display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;
    }
    .chart-header h3 { font-size: 13px; font-weight: 600; margin: 0; color: var(--text-secondary); }
    .chart-badge {
      font-size: 10px; font-weight: 600; padding: 3px 10px;
      border-radius: 20px; background: var(--accent-subtle); color: var(--accent);
    }

    /* Bar Chart */
    .bar-chart { display: flex; align-items: flex-end; gap: 4px; height: 90px; }
    .chart-bar-wrap { flex: 1; height: 100%; display: flex; align-items: flex-end; }
    .chart-bar {
      width: 100%; border-radius: 4px 4px 0 0; background: var(--accent); opacity: 0.4;
      transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1); cursor: crosshair; min-height: 4px;
    }
    .chart-bar:hover { opacity: 1; transform: scaleY(1.08); transform-origin: bottom; }
    .chart-bar.bar-high { background: var(--danger); opacity: 0.6; }
    .chart-bar.bar-med { background: var(--warning); opacity: 0.5; }

    /* Donut Chart */
    .donut-chart { position: relative; width: 110px; height: 110px; margin: 0 auto 14px; }
    .donut-svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    .donut-bg { fill: none; stroke: var(--bg-elevated); stroke-width: 4; }
    .donut-ok { fill: none; stroke: var(--success); stroke-width: 4.5; stroke-linecap: round; transition: stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1); }
    .donut-warn { fill: none; stroke: var(--warning); stroke-width: 4.5; stroke-linecap: round; transition: stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1); }
    .donut-crit { fill: none; stroke: var(--danger); stroke-width: 4.5; stroke-linecap: round; transition: stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1); }
    .donut-center {
      position: absolute; inset: 0; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
    }
    .donut-total { font-size: 24px; font-weight: 800; letter-spacing: -0.03em; }
    .donut-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .donut-legend { display: flex; justify-content: center; gap: 14px; }
    .dl-item { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--text-secondary); font-weight: 500; }
    .dl-dot { width: 7px; height: 7px; border-radius: 50%; }
    .dl-ok { background: var(--success); }
    .dl-warn { background: var(--warning); }
    .dl-crit { background: var(--danger); }

    @media (max-width: 768px) { .charts-row { grid-template-columns: 1fr; } }

    /* Bottom Grid — Two Column */
    .bottom-grid {
      display: grid;
      grid-template-columns: 1.5fr 1fr;
      gap: 16px;
      margin-bottom: 8px;
    }
    .bottom-section { min-width: 0; overflow: hidden; }
    .section-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 12px;
    }
    .section-header h2 { font-size: 14px; font-weight: 700; margin: 0; letter-spacing: -0.01em; }
    .see-all-btn {
      background: none; border: none; color: var(--accent); font-size: 12px;
      cursor: pointer; display: flex; align-items: center; gap: 4px;
      padding: 4px 10px; border-radius: 8px; transition: background 0.15s;
    }
    .see-all-btn:hover { background: var(--accent-subtle); }

    /* Events */
    .events-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 14px;
      overflow: hidden;
      max-height: 300px;
      overflow-y: auto;
    }
    .event-row {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 16px; border-bottom: 1px solid var(--border);
      font-size: 12px; transition: all 0.15s;
      min-width: 0;
    }
    .event-row:last-child { border-bottom: none; }
    .event-row:hover { background: var(--bg-hover); transform: translateX(2px); }
    .event-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); flex-shrink: 0; }
    .event-dot.warn { background: var(--warning); box-shadow: 0 0 6px rgba(234,179,8,0.3); }
    .event-content { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .event-reason { font-weight: 600; font-size: 12px; }
    .event-msg { font-size: 11px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
    .event-obj {
      font-size: 10px; color: var(--text-muted); background: var(--bg-elevated);
      padding: 3px 8px; border-radius: 20px; white-space: nowrap; font-family: 'JetBrains Mono', monospace;
      flex-shrink: 0; max-width: 120px; overflow: hidden; text-overflow: ellipsis;
    }
    .events-empty { padding: 32px; text-align: center; color: var(--text-muted); font-size: 12px; display: flex; align-items: center; justify-content: center; gap: 6px; }

    /* Actions */
    .actions-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }
    .action-card {
      display: flex; align-items: center; gap: 10px;
      padding: 16px 18px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 14px;
      cursor: pointer;
      font-size: 13px; font-weight: 500;
      transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
    }
    .action-card:hover {
      transform: translateY(-2px) scale(1.02);
      border-color: var(--accent);
      background: var(--accent-subtle);
      box-shadow: 0 8px 24px -8px rgba(99,102,241,0.15);
    }
    .action-card:focus-visible {
      outline: none;
      border-color: var(--accent);
      box-shadow: inset 0 0 0 1px var(--accent);
    }
    .action-card i { font-size: 16px; color: var(--text-muted); transition: color 0.2s; }
    .action-card:hover i { color: var(--accent); }

    @media (max-width: 900px) {
      .bottom-grid { grid-template-columns: 1fr; }
      .actions-grid { grid-template-columns: 1fr; }
    }

    /* Skeleton */
    .skeleton-hero { height: 120px; border-radius: 20px; margin-bottom: 28px; }
    .skeleton-grid { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 14px; }
    .skeleton-card { height: 170px; border-radius: 16px; }
    .skeleton {
      background: linear-gradient(90deg, var(--bg-elevated) 25%, var(--bg-hover) 50%, var(--bg-elevated) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    /* Staggered Entrance */
    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .stagger-1 { animation: fadeSlideUp 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.05s both; }
    .stagger-2 { animation: fadeSlideUp 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.12s both; }
    .stagger-3 { animation: fadeSlideUp 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.19s both; }
    .stagger-4 { animation: fadeSlideUp 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.26s both; }
    .stagger-5 { animation: fadeSlideUp 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.33s both; }
    .stagger-6 { animation: fadeSlideUp 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.40s both; }
  `],
})
export class DashboardComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private http = inject(HttpClient);
  router = inject(Router);
  data: OverviewResponse | null = null;
  recentEvents: KubeEvent[] = [];
  lastUpdated = '';
  refreshing = false;
  private refreshInterval: any;
  uptime: any = null;
  pins: any[] = [];
  contextCopied = false;
  stats: any = null;

  get podTotal() {
    return (this.data?.pods.healthy || 0) + (this.data?.pods.warning || 0) + (this.data?.pods.critical || 0);
  }
  get nodeTotal() {
    return (this.data?.nodes.healthy || 0) + (this.data?.nodes.warning || 0);
  }
  get depTotal() {
    return (this.data?.deployments.healthy || 0) + (this.data?.deployments.unavailable || 0);
  }
  get overallHealth(): 'healthy' | 'degraded' | 'critical' {
    if ((this.data?.pods.critical || 0) > 0 || (this.data?.nodes.warning || 0) > 0) return 'critical';
    if ((this.data?.pods.warning || 0) > 0 || (this.data?.deployments.unavailable || 0) > 0) return 'degraded';
    return 'healthy';
  }
  get healthPct(): number {
    const total = this.podTotal + this.nodeTotal + this.depTotal;
    if (total === 0) return 100;
    const healthy = (this.data?.pods.healthy || 0) + (this.data?.nodes.healthy || 0) + (this.data?.deployments.healthy || 0);
    return Math.round((healthy / total) * 100);
  }

  get isClusterEmpty(): boolean {
    return this.data !== null && this.podTotal === 0 && this.nodeTotal === 0 && this.depTotal === 0;
  }

  Math = Math;

  get activityBars(): number[] {
    const bars = new Array(16).fill(0);
    const total = this.recentEvents.length;
    if (total === 0) return bars.map(() => Math.random() * 15 + 5);
    for (let i = 0; i < total; i++) { bars[Math.floor((i / total) * 16)]++; }
    const max = Math.max(...bars, 1);
    return bars.map(b => Math.max((b / max) * 100, 5));
  }

  get podRunningDash(): string {
    const pct = this.podTotal > 0 ? (this.data!.pods.healthy / this.podTotal) * 100 : 0;
    return pct + ' ' + (100 - pct);
  }
  get podWarnDash(): string {
    const pct = this.podTotal > 0 ? (this.data!.pods.warning / this.podTotal) * 100 : 0;
    return pct + ' ' + (100 - pct);
  }
  get podWarnOffset(): string {
    const running = this.podTotal > 0 ? (this.data!.pods.healthy / this.podTotal) * 100 : 0;
    return String(25 - running);
  }
  get podCritDash(): string {
    const pct = this.podTotal > 0 ? (this.data!.pods.critical / this.podTotal) * 100 : 0;
    return pct + ' ' + (100 - pct);
  }
  get podCritOffset(): string {
    const running = this.podTotal > 0 ? (this.data!.pods.healthy / this.podTotal) * 100 : 0;
    const warn = this.podTotal > 0 ? (this.data!.pods.warning / this.podTotal) * 100 : 0;
    return String(25 - running - warn);
  }

  pct(value: number, total: number): number {
    return total === 0 ? 0 : Math.round((value / total) * 100);
  }

  goToPods() { this.router.navigate(['/pods']); }

  getReadyNodes(): number {
    return this.uptime?.nodes?.filter((n: any) => n.ready).length || 0;
  }

  getMaxUptime(): string {
    if (!this.uptime?.nodes?.length) return '—';
    const max = this.uptime.nodes.reduce((a: any, b: any) => a.uptime_seconds > b.uptime_seconds ? a : b);
    return max.uptime_human || '—';
  }

  onKey(event: KeyboardEvent, action: Function) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      action();
    }
  }

  refresh() {
    this.refreshing = true;
    this.loadPins();
    this.loadStats();
    this.api.getOverview().subscribe({
      next: (res) => { this.data = res; },
      error: () => {
        this.data = {
          pods: { healthy: 0, warning: 0, critical: 0 },
          nodes: { healthy: 0, warning: 0 },
          deployments: { healthy: 0, unavailable: 0 },
        } as any;
      },
    });
    this.api.getEvents(5).subscribe({
      next: (res) => { this.recentEvents = res.events; this.refreshing = false; },
      error: () => { this.recentEvents = []; this.refreshing = false; },
    });
    this.http.get<any>('/api/uptime').subscribe({
      next: (res) => { this.uptime = res; },
      error: () => {
        const hasResources = this.podTotal > 0 || this.nodeTotal > 0;
        this.uptime = {
          api_reachable: hasResources,
          cluster_down: !hasResources,
          downtime_hint: hasResources ? '' : 'Uptime API unreachable',
          day: new Date().toLocaleDateString('en', { weekday: 'long' }),
        };
      },
    });
    this.lastUpdated = new Date().toLocaleTimeString();
  }

  loadPins() {
    this.http.get<any>('/api/saved-queries').subscribe({
      next: (res) => (this.pins = res.queries || []),
      error: () => (this.pins = []),
    });
  }

  loadStats() {
    this.api.getStats().subscribe({
      next: (res) => (this.stats = res),
      error: () => (this.stats = null),
    });
  }

  copyContext() {
    if (this.uptime?.context) {
      navigator.clipboard.writeText(this.uptime.context).then(() => {
        this.contextCopied = true;
        setTimeout(() => (this.contextCopied = false), 2000);
      });
    }
  }

  ngOnInit() {
    this.refresh();
    this.refreshInterval = setInterval(() => this.refresh(), 30000);
  }

  ngOnDestroy() {
    clearInterval(this.refreshInterval);
  }
}
