import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { SlicePipe } from '@angular/common';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { ConfirmService } from '../../shared/services/confirm.service';
import { SpotlightComponent } from '../../shared/components/spotlight.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

@Component({
  selector: 'app-incident',
  standalone: true,
  imports: [FormsModule, SlicePipe, TagModule, ButtonModule, TooltipModule, InputTextModule, SpotlightComponent, PageHeaderComponent],
  template: `
    <app-spotlight id="incident" title="Incident Tracking" icon="pi pi-exclamation-circle"
      description="Track production incidents with timeline, notes, and snapshots."
      [capabilities]="['Timeline with notes', 'Cluster snapshots', 'AI analysis', 'Export reports']" [compact]="true" />

    <app-page-header title="Incident" subtitle="Track and document production issues">
    </app-page-header>

    <!-- Resolved Summary -->
    @if (resolved) {
      <div class="resolved-container">
        <div class="resolved-hero">
          <div class="resolved-icon"><i class="pi pi-check-circle"></i></div>
          <h2>Incident Resolved</h2>
          <p>{{ resolved.title }}</p>
        </div>

        <div class="resolved-stats">
          <div class="stat-card">
            <span class="stat-val">{{ resolvedDuration }}</span>
            <span class="stat-label">Duration</span>
          </div>
          <div class="stat-card">
            <span class="stat-val">{{ (resolved.notes || []).length }}</span>
            <span class="stat-label">Notes</span>
          </div>
          <div class="stat-card">
            <span class="stat-val">{{ (resolved.snapshots || []).length }}</span>
            <span class="stat-label">Snapshots</span>
          </div>
          <div class="stat-card">
            <span class="stat-val">{{ (resolved.timeline || []).length }}</span>
            <span class="stat-label">Events</span>
          </div>
        </div>

        @if (resolvedExportPath) {
          <div class="export-info" (click)="loadReport()">
            <i class="pi pi-file"></i>
            <span>Exported to: <code>{{ resolvedExportPath }}</code></span>
            <i class="pi pi-external-link export-link"></i>
          </div>
        }

        @if (resolved.root_cause) {
          <div class="root-cause-card">
            <div class="rc-header"><i class="pi pi-search"></i> Root Cause</div>
            <p class="rc-text">{{ resolved.root_cause }}</p>
            @if (resolved.resolution) {
              <p class="rc-resolution"><strong>Resolution:</strong> {{ resolved.resolution }}</p>
            }
          </div>
        }

        <!-- Full Report View -->
        @if (reportData) {
          <div class="report-section">
            <div class="report-header">
              <h3>Full Report</h3>
              <button pButton icon="pi pi-times" class="p-button-text p-button-sm p-button-rounded" (click)="reportData = null"></button>
            </div>

            @if (reportData.snapshots?.length > 0) {
              <div class="report-block">
                <h4>Snapshots ({{ reportData.snapshots.length }})</h4>
                @for (snap of reportData.snapshots; track $index) {
                  <div class="snapshot-card">
                    <div class="snap-header">
                      <span class="snap-time">{{ snap.time | slice:11:19 }}</span>
                      <span class="snap-ctx">{{ snap.context }} / {{ snap.namespace }}</span>
                    </div>
                    <div class="snap-pods">
                      @for (pod of snap.pods || []; track pod.name) {
                        <span class="snap-pod" [class.snap-pod-bad]="pod.status !== 'Running'">{{ pod.name }} ({{ pod.status }})</span>
                      }
                      @if ((snap.pods || []).length === 0) {
                        <span class="snap-empty">No pods captured</span>
                      }
                    </div>
                    @if ((snap.events || []).length > 0) {
                      <div class="snap-events">
                        @for (ev of snap.events.slice(0, 5); track $index) {
                          <div class="snap-ev"><span class="snap-ev-type" [class.snap-ev-warn]="ev.type === 'Warning'">{{ ev.type }}</span> {{ ev.reason }}: {{ ev.message }}</div>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            }

            @if (reportData.notes?.length > 0) {
              <div class="report-block">
                <h4>Notes ({{ reportData.notes.length }})</h4>
                @for (note of reportData.notes; track $index) {
                  <div class="report-note">
                    <span class="note-time">{{ note.time | slice:11:19 }}</span>
                    <span>{{ note.text }}</span>
                  </div>
                }
              </div>
            }
          </div>
        }

        <!-- Timeline Review -->
        @if ((resolved.timeline || []).length > 0) {
          <div class="resolved-timeline">
            <h3>Timeline</h3>
            <div class="notes-timeline">
              @for (entry of resolved.timeline; track $index) {
                <div class="tl-entry">
                  <div class="tl-marker">
                    <div class="tl-dot" [class.tl-dot-start]="entry.event === 'Incident started'" [class.tl-dot-end]="entry.event === 'Incident closed'"></div>
                    @if ($index < resolved.timeline.length - 1) {
                      <div class="tl-line"></div>
                    }
                  </div>
                  <div class="tl-content">
                    <span class="tl-time">{{ entry.time | slice:11:19 }}</span>
                    <span class="tl-text"><strong>{{ entry.event }}</strong>@if (entry.detail) { — {{ entry.detail }}}</span>
                  </div>
                </div>
              }
            </div>
          </div>
        }

        <button pButton label="Done" icon="pi pi-arrow-left" class="p-button-outlined dismiss-btn" (click)="dismissResolved()"></button>
      </div>
    }

    <!-- No Active Incident -->
    @if (!active && !resolved) {
      <div class="start-container">
        <div class="start-hero">
          <div class="start-icon"><i class="pi pi-exclamation-circle"></i></div>
          <h2>Start Incident Tracking</h2>
          <p>Begin recording a timeline of observations, snapshots, and actions during an incident.</p>
        </div>

        <div class="start-form">
          <div class="form-field">
            <label>Incident Title</label>
            <input pInputText [(ngModel)]="title" placeholder="e.g. Payment API 5xx spike" />
          </div>
          <div class="form-field">
            <label>Severity</label>
            <div class="severity-options">
              @for (sev of severities; track sev.value) {
                <button class="sev-btn" [class.active]="severity === sev.value" [class]="'sev-' + sev.value" (click)="severity = sev.value">
                  {{ sev.label }}
                </button>
              }
            </div>
          </div>
          <button pButton label="Start Incident" icon="pi pi-play" class="p-button-danger start-btn" (click)="start()" [disabled]="!title.trim()"></button>
        </div>

        <!-- Past Incidents -->
        @if (history.length > 0) {
          <div class="history-section">
            <h3>Past Incidents</h3>
            @for (item of history; track item.id) {
              <div class="history-card" (click)="viewHistoryReport(item)">
                <div class="history-top">
                  <span class="history-title">{{ item.title }}</span>
                  <span class="history-date">{{ item.started | slice:0:10 }}</span>
                </div>
                <div class="history-meta">
                  <span>{{ item.notes_count }} notes</span>
                  <span>{{ item.snapshots_count }} snapshots</span>
                  @if (item.ended) {
                    <span>{{ calcDuration({started: item.started, ended: item.ended}) }}</span>
                  }
                </div>
                @if (item.root_cause) {
                  <div class="history-rc">{{ item.root_cause }}</div>
                }
              </div>
            }
          </div>
        }
      </div>
    }

    <!-- Active Incident -->
    @if (active && !resolved) {
      <!-- Urgency Banner -->
      <div class="incident-banner" [class]="'banner-' + (active.severity || severity)">
        <div class="banner-pulse"></div>
        <div class="banner-content">
          <div class="banner-left">
            <p-tag value="ACTIVE INCIDENT" severity="danger" />
            <p-tag [value]="(active.severity || severity).toUpperCase()" [severity]="(active.severity || severity) === 'critical' ? 'danger' : (active.severity || severity) === 'high' ? 'warn' : 'info'" [rounded]="true" />
            <span class="banner-title">{{ active.title }}</span>
          </div>
          <div class="banner-right">
            <div class="elapsed">
              <i class="pi pi-clock"></i>
              <span>{{ elapsedTime }}</span>
            </div>
            <button pButton label="Resolve" icon="pi pi-check" class="p-button-sm p-button-outlined" (click)="showResolveForm = true"></button>
          </div>
        </div>
      </div>

      <!-- Affected Resources -->
      <div class="affected-section">
        <div class="affected-header">
          <span class="affected-title"><i class="pi pi-exclamation-triangle"></i> Affected Resources</span>
          <div class="affected-input">
            <input pInputText [(ngModel)]="affectedInput" placeholder="Add pod or deployment..." (keyup.enter)="addAffected()" />
            <button pButton icon="pi pi-plus" class="p-button-sm p-button-rounded" (click)="addAffected()" [disabled]="!affectedInput.trim()"></button>
          </div>
        </div>
        @if ((active.affected || affectedResources).length > 0) {
          <div class="affected-tags">
            @for (res of (active.affected || affectedResources); track res) {
              <span class="affected-chip">
                <i class="pi pi-box"></i> {{ res }}
                <i class="pi pi-times chip-remove" (click)="removeAffected(res)" (keydown.enter)="removeAffected(res)" (keydown.space)="$event.preventDefault(); removeAffected(res)" tabindex="0" role="button" aria-label="Remove resource"></i>
              </span>
            }
          </div>
        } @else {
          <span class="affected-empty">No resources tagged yet</span>
        }
      </div>

      <!-- AI Insights & Findings -->
      <div class="ai-insight-row">
        <div class="insight-card glass-accent">
           <div class="card-header">
              <i class="pi pi-sparkles"></i>
              <span>Probable Cause</span>
           </div>
           <p class="card-val">{{ probableCause || 'Analyzing cluster signals...' }}</p>
        </div>
        <div class="insight-card glass">
           <div class="card-header">
              <i class="pi pi-map"></i>
              <span>Blast Radius</span>
           </div>
           <p class="card-val">{{ blastRadius || 'Calculating impact...' }}</p>
        </div>
        <div class="insight-card glass">
           <div class="card-header">
              <i class="pi pi-info-circle"></i>
              <span>Health Score</span>
           </div>
           <div class="health-meter">
              <div class="meter-bar" [style.width.%]="healthScore" [class.bar-bad]="healthScore < 50" [class.bar-warn]="healthScore >= 50 && healthScore < 80"></div>
              <span class="meter-val">{{ healthScore }}%</span>
           </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="quick-actions">
        <button pButton icon="pi pi-sparkles" label="AI Analysis" class="p-button-sm p-button-warning" (click)="runAiAnalysis()" [loading]="analyzing"></button>
        <button pButton icon="pi pi-camera" label="Snapshot" class="p-button-sm p-button-outlined" (click)="snapshot()" pTooltip="Capture cluster state"></button>
        <button pButton icon="pi pi-share-alt" label="Share" class="p-button-sm p-button-outlined" (click)="shareIncident()" pTooltip="Share via webhook" [loading]="sharing"></button>
        <button pButton icon="pi pi-wrench" label="Log Action" class="p-button-sm p-button-outlined" (click)="showActionInput = !showActionInput" pTooltip="Record remediation action"></button>
        <button pButton icon="pi pi-box" label="Pods" class="p-button-sm p-button-outlined" (click)="router.navigate(['/pods'])"></button>
        <button pButton icon="pi pi-bolt" label="Events" class="p-button-sm p-button-outlined" (click)="router.navigate(['/events'])"></button>
        @if (snapshotTaken) {
          <span class="snapshot-feedback"><i class="pi pi-check"></i> Snapshot captured</span>
        }
      </div>

      <!-- Action Input -->
      @if (showActionInput) {
        <div class="action-input-card">
          <div class="action-input-row">
            <select class="action-select" [(ngModel)]="actionType">
              <option value="restart">Restart</option>
              <option value="scale">Scale</option>
              <option value="rollback">Rollback</option>
              <option value="config_change">Config Change</option>
              <option value="manual_fix">Manual Fix</option>
              <option value="other">Other</option>
            </select>
            <input pInputText [(ngModel)]="actionTarget" placeholder="Target (e.g. payment-api)" />
            <input pInputText [(ngModel)]="actionResult" placeholder="Result (e.g. pods restarted)" />
            <button pButton icon="pi pi-plus" class="p-button-sm" (click)="logAction()" [disabled]="!actionTarget.trim()"></button>
          </div>
        </div>
      }

      <div class="incident-grid">
        <!-- Resolve Form -->
        @if (showResolveForm) {
          <div class="resolve-card">
            <h3><i class="pi pi-check-circle"></i> Resolve Incident</h3>
            <div class="resolve-form">
              <div class="form-field">
                <label>Root Cause</label>
                <select class="action-select full" [(ngModel)]="rootCauseCategory">
                  <option value="">Select category...</option>
                  <option value="OOM">Out of Memory (OOM)</option>
                  <option value="config_error">Configuration Error</option>
                  <option value="deployment_failure">Deployment Failure</option>
                  <option value="network">Network Issue</option>
                  <option value="resource_exhaustion">Resource Exhaustion</option>
                  <option value="dependency">Dependency Failure</option>
                  <option value="scaling">Scaling Issue</option>
                  <option value="unknown">Unknown / Investigating</option>
                </select>
              </div>
              <div class="form-field">
                <label>Details</label>
                <input pInputText [(ngModel)]="rootCauseDetail" placeholder="Brief description of what caused it..." />
              </div>
              <div class="form-field">
                <label>Resolution</label>
                <input pInputText [(ngModel)]="resolutionText" placeholder="What fixed it..." />
              </div>
              <div class="resolve-actions">
                <button pButton label="Cancel" class="p-button-text p-button-sm" (click)="showResolveForm = false"></button>
                <button pButton label="Resolve & Export" icon="pi pi-check" class="p-button-sm p-button-success" (click)="stop()"></button>
              </div>
            </div>
          </div>
        }

      <!-- Snapshot Diff -->
      @if ((active.snapshots || []).length >= 2) {
        <div class="snap-diff-section">
          <div class="notes-header">
            <h3><i class="pi pi-arrows-h"></i> Snapshot Changes</h3>
            <span class="notes-count">{{ (active.snapshots || []).length }} snapshots</span>
          </div>
          <div class="snap-diff-content">
            @for (change of snapshotDiff; track $index) {
              <div class="diff-entry" [class]="'diff-' + change.type">
                <span class="diff-icon">
                  @if (change.type === 'added') { <i class="pi pi-plus-circle"></i> }
                  @else if (change.type === 'removed') { <i class="pi pi-minus-circle"></i> }
                  @else { <i class="pi pi-sync"></i> }
                </span>
                <span class="diff-text">{{ change.message }}</span>
              </div>
            }
            @if (snapshotDiff.length === 0) {
              <span class="diff-empty">No changes between snapshots</span>
            }
          </div>
        </div>
      }

        <!-- Actions Log -->
        @if ((active.actions || []).length > 0) {
          <div class="actions-section">
            <div class="notes-header">
              <h3>Actions Taken</h3>
              <span class="notes-count">{{ (active.actions || []).length }}</span>
            </div>
            <div class="actions-list">
              @for (a of (active.actions || []).slice().reverse(); track $index) {
                <div class="action-entry">
                  <div class="action-badge">{{ a.action }}</div>
                  <div class="action-detail">
                    <span class="action-target">{{ a.target }}</span>
                    @if (a.result) { <span class="action-result">→ {{ a.result }}</span> }
                  </div>
                  <span class="action-time">{{ a.time | slice:11:19 }}</span>
                </div>
              }
            </div>
          </div>
        }

        <!-- Notes Timeline -->
        <div class="notes-section">
        <div class="notes-header">
          <h3>Timeline</h3>
          <span class="notes-count">{{ (active.notes || []).length }} entries</span>
        </div>

        <!-- Add Note -->
        <div class="note-input">
          <div class="note-input-dot"></div>
          <input pInputText [(ngModel)]="noteText" placeholder="What's happening now..." (keyup.enter)="addNote()" />
          <button pButton icon="pi pi-plus" class="p-button-sm" (click)="addNote()" [disabled]="!noteText.trim()"></button>
        </div>

        <!-- Notes List -->
        <div class="notes-timeline">
          @for (note of (active.notes || []).slice().reverse(); track $index) {
            <div class="tl-entry">
              <div class="tl-marker">
                <div class="tl-dot"></div>
                @if ($index < (active.notes || []).length - 1) {
                  <div class="tl-line"></div>
                }
              </div>
              <div class="tl-content">
                <span class="tl-time">{{ note.time }}</span>
                <span class="tl-text">{{ note.text }}</span>
              </div>
            </div>
          }
          @if ((active.notes || []).length === 0) {
            <div class="notes-empty">
              <i class="pi pi-pencil"></i>
              <span>No notes yet — add observations as you investigate</span>
            </div>
          }
        </div>
      </div>
      </div>
    }
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

    /* Start State */
    .start-container {
      max-width: 480px; margin: 0 auto;
    }
    .start-hero {
      text-align: center; margin-bottom: 28px;
    }
    .start-icon {
      width: 56px; height: 56px; border-radius: 50%; margin: 0 auto 16px;
      background: var(--danger-subtle); color: var(--danger);
      display: flex; align-items: center; justify-content: center; font-size: 24px;
    }
    .start-hero h2 { font-size: 20px; font-weight: 700; margin: 0 0 8px; }
    .start-hero p { font-size: 13px; color: var(--text-secondary); margin: 0; line-height: 1.5; }

    .start-form {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 24px;
    }
    .form-field { margin-bottom: 16px; }
    .form-field label { display: block; font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px; }
    .form-field input { width: 100%; }
    .severity-options { display: flex; gap: 6px; }
    .sev-btn {
      padding: 6px 14px; border-radius: 6px; border: 1px solid var(--border);
      background: var(--bg-elevated); color: var(--text-muted); font-size: 12px;
      cursor: pointer; transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
    }
    .sev-btn:hover { border-color: var(--border-hover); color: var(--text); }
    .sev-btn.active.sev-critical { border-color: var(--danger); background: var(--danger-subtle); color: var(--danger); }
    .sev-btn.active.sev-high { border-color: var(--warning); background: var(--warning-subtle); color: var(--warning); }
    .sev-btn.active.sev-medium { border-color: var(--accent); background: var(--accent-subtle); color: var(--accent); }
    .sev-btn.active.sev-low { border-color: var(--success); background: var(--success-subtle); color: var(--success); }
    .start-btn { width: 100%; margin-top: 8px; }

    /* Active Banner */
    .incident-banner {
      position: relative; overflow: hidden;
      padding: 16px 20px; margin-bottom: 16px;
      background: linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.03));
      border: 1px solid var(--danger); border-radius: var(--radius);
    }
    .banner-medium { border-color: var(--accent); background: linear-gradient(135deg, rgba(99,102,241,0.06), transparent); }
    .banner-medium .banner-pulse { background: var(--accent); }
    .banner-low { border-color: var(--success); background: linear-gradient(135deg, rgba(34,197,94,0.06), transparent); }
    .banner-low .banner-pulse { background: var(--success); }
    .banner-pulse {
      position: absolute; top: 0; left: 0; right: 0; height: 2px;
      background: var(--danger); animation: pulseBanner 2s ease-in-out infinite;
    }
    @keyframes pulseBanner { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
    .banner-content { display: flex; align-items: center; justify-content: space-between; }
    .banner-left { display: flex; align-items: center; gap: 12px; }
    .banner-title { font-size: 16px; font-weight: 600; }
    .banner-right { display: flex; align-items: center; gap: 12px; }
    .elapsed { display: flex; align-items: center; gap: 6px; font-size: 13px; font-family: 'JetBrains Mono', monospace; color: var(--text-secondary); }
    .elapsed i { font-size: 12px; }

    /* Affected Resources */
    .affected-section {
      padding: 14px 18px; margin-bottom: 16px;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
    }
    .affected-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .affected-title { font-size: 12px; font-weight: 600; color: var(--text-secondary); display: flex; align-items: center; gap: 6px; }
    .affected-title i { font-size: 12px; color: var(--warning); }
    .affected-input { display: flex; gap: 6px; }
    .affected-input input { width: 180px; font-size: 12px; }
    .affected-tags { display: flex; flex-wrap: wrap; gap: 6px; }
    .affected-chip {
      display: flex; align-items: center; gap: 5px;
      padding: 4px 10px; border-radius: 6px;
      background: var(--danger-subtle); color: var(--danger);
      font-size: 11px; font-weight: 500;
    }
    .affected-chip i { font-size: 11px; }
    .chip-remove { cursor: pointer; opacity: 0.6; transition: opacity 0.15s; }
    .chip-remove:hover { opacity: 1; }
    .affected-empty { font-size: 11px; color: var(--text-muted); }

    /* Snapshot Diff */
    .snap-diff-section {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 20px; margin-bottom: 16px;
    }
    .snap-diff-content { display: flex; flex-direction: column; gap: 4px; }
    .diff-entry {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 10px; border-radius: 4px; font-size: 12px;
    }
    .diff-added { background: rgba(34,197,94,0.06); }
    .diff-added .diff-icon { color: var(--success); }
    .diff-removed { background: rgba(239,68,68,0.06); }
    .diff-removed .diff-icon { color: var(--danger); }
    .diff-changed { background: rgba(234,179,8,0.06); }
    .diff-changed .diff-icon { color: var(--warning); }
    .diff-icon { font-size: 12px; flex-shrink: 0; }
    .diff-empty { font-size: 11px; color: var(--text-muted); }

    /* Quick Actions */
    .quick-actions {
      display: flex; gap: 8px; align-items: center; margin-bottom: 24px; flex-wrap: wrap;
    }

    .ai-insight-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
    .insight-card { padding: 16px; border-radius: var(--radius); border: 1px solid var(--border); }
    .card-header { display: flex; align-items: center; gap: 8px; font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px; }
    .card-header i { font-size: 14px; color: var(--accent); }
    .card-val { font-size: 13px; font-weight: 500; color: var(--text-secondary); line-height: 1.4; }

    .health-meter { display: flex; align-items: center; gap: 10px; margin-top: 4px; }
    .meter-bar { height: 6px; border-radius: 3px; background: var(--success); transition: width 0.5s ease; }
    .meter-bar.bar-bad { background: var(--danger); }
    .meter-bar.bar-warn { background: var(--warning); }
    .meter-val { font-size: 14px; font-weight: 700; font-family: 'JetBrains Mono', monospace; }

    .incident-grid { display: grid; grid-template-columns: 1fr; gap: 20px; align-items: start; }
    .snapshot-feedback {
      font-size: 12px; color: var(--success); display: flex; align-items: center; gap: 4px;
      animation: fadeIn 0.3s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    /* Action Input */
    .action-input-card {
      padding: 12px 16px; margin-bottom: 16px;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
      animation: fadeIn 0.2s ease;
    }
    .action-input-row { display: flex; gap: 8px; align-items: center; }
    .action-select {
      padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border);
      background: var(--bg-elevated); color: var(--text); font-size: 12px; outline: none;
    }
    .action-select:focus { border-color: var(--accent); }
    .action-select.full { width: 100%; }
    .action-input-row input { flex: 1; }

    /* Resolve Form */
    .resolve-card {
      background: var(--bg-card); border: 1px solid var(--success); border-radius: var(--radius);
      padding: 20px; animation: fadeIn 0.3s ease;
    }
    .resolve-card h3 { font-size: 14px; font-weight: 600; margin: 0 0 14px; display: flex; align-items: center; gap: 8px; }
    .resolve-card h3 i { color: var(--success); }
    .resolve-form { display: flex; flex-direction: column; gap: 12px; }
    .resolve-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }

    /* Actions Log */
    .actions-section {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px;
    }
    .actions-list { display: flex; flex-direction: column; gap: 6px; }
    .action-entry {
      display: flex; align-items: center; gap: 10px; padding: 8px 12px;
      background: var(--bg-elevated); border-radius: 6px; font-size: 12px;
    }
    .action-badge {
      font-size: 10px; font-weight: 600; padding: 3px 8px; border-radius: 4px;
      background: var(--accent-subtle); color: var(--accent); text-transform: uppercase;
    }
    .action-detail { flex: 1; }
    .action-target { font-weight: 500; }
    .action-result { color: var(--text-muted); margin-left: 6px; }
    .action-time { font-size: 10px; color: var(--text-muted); font-family: 'JetBrains Mono', monospace; }

    /* Notes */
    .notes-section {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px;
    }
    .notes-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .notes-header h3 { font-size: 15px; font-weight: 600; margin: 0; }
    .notes-count { font-size: 11px; color: var(--text-muted); background: var(--bg-elevated); padding: 2px 8px; border-radius: 10px; }

    .note-input {
      display: flex; align-items: center; gap: 10px; margin-bottom: 20px;
      padding-bottom: 16px; border-bottom: 1px solid var(--border);
    }
    .note-input-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--accent); flex-shrink: 0; }
    .note-input input { flex: 1; }

    .notes-timeline { padding-left: 4px; }
    .tl-entry { display: flex; gap: 12px; }
    .tl-marker { display: flex; flex-direction: column; align-items: center; }
    .tl-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--text-muted); margin-top: 5px; flex-shrink: 0; }
    .tl-line { width: 2px; flex: 1; background: var(--border); min-height: 16px; }
    .tl-content { flex: 1; padding-bottom: 14px; }
    .tl-time { display: block; font-size: 10px; color: var(--text-muted); font-family: 'JetBrains Mono', monospace; margin-bottom: 2px; }
    .tl-text { font-size: 13px; }

    .notes-empty {
      display: flex; align-items: center; gap: 8px; padding: 24px;
      color: var(--text-muted); font-size: 13px; justify-content: center;
    }
    .notes-empty i { font-size: 14px; opacity: 0.5; }

    /* Resolved State */
    .resolved-container { max-width: 560px; margin: 0 auto; }
    .resolved-hero { text-align: center; margin-bottom: 24px; }
    .resolved-icon {
      width: 56px; height: 56px; border-radius: 50%; margin: 0 auto 16px;
      background: var(--success-subtle); color: var(--success);
      display: flex; align-items: center; justify-content: center; font-size: 24px;
    }
    .resolved-hero h2 { font-size: 20px; font-weight: 700; margin: 0 0 6px; }
    .resolved-hero p { font-size: 14px; color: var(--text-secondary); margin: 0; }

    .resolved-stats {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px;
    }
    .stat-card {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 14px; text-align: center;
    }
    .stat-val { display: block; font-size: 18px; font-weight: 700; font-family: 'JetBrains Mono', monospace; }
    .stat-label { display: block; font-size: 11px; color: var(--text-muted); margin-top: 4px; }

    .export-info {
      display: flex; align-items: center; gap: 8px; padding: 12px 16px;
      background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius);
      font-size: 12px; color: var(--text-secondary); margin-bottom: 20px;
      cursor: pointer; transition: all 0.2s;
    }
    .export-info:hover { border-color: var(--accent); background: var(--accent-subtle); }
    .export-info code { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text); }
    .export-link { margin-left: auto; font-size: 11px; color: var(--accent); }

    .root-cause-card {
      padding: 16px; margin-bottom: 20px;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
      border-left: 3px solid var(--warning);
    }
    .rc-header { font-size: 11px; font-weight: 700; color: var(--warning); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
    .rc-text { font-size: 13px; margin: 0 0 6px; line-height: 1.4; }
    .rc-resolution { font-size: 12px; color: var(--text-secondary); margin: 0; }

    .report-section {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 20px; margin-bottom: 20px; animation: fadeIn 0.3s ease;
    }
    .report-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .report-header h3 { font-size: 14px; font-weight: 600; margin: 0; }
    .report-block { margin-bottom: 16px; }
    .report-block h4 { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 10px; }

    .snapshot-card {
      background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 8px;
      padding: 12px; margin-bottom: 8px;
    }
    .snap-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .snap-time { font-size: 11px; font-family: 'JetBrains Mono', monospace; color: var(--text-muted); }
    .snap-ctx { font-size: 10px; color: var(--text-muted); }
    .snap-pods { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; }
    .snap-pod {
      font-size: 10px; padding: 2px 6px; border-radius: 4px;
      background: var(--success-subtle); color: var(--success);
      font-family: 'JetBrains Mono', monospace;
    }
    .snap-pod-bad { background: var(--danger-subtle); color: var(--danger); }
    .snap-empty { font-size: 10px; color: var(--text-muted); }
    .snap-events { margin-top: 6px; }
    .snap-ev { font-size: 11px; color: var(--text-secondary); padding: 2px 0; }
    .snap-ev-type { font-size: 10px; font-weight: 600; margin-right: 4px; color: var(--text-muted); }
    .snap-ev-warn { color: var(--warning); }

    .report-note {
      display: flex; align-items: baseline; gap: 10px; padding: 6px 0;
      border-bottom: 1px solid var(--border); font-size: 12px;
    }
    .report-note:last-child { border-bottom: none; }
    .note-time { font-size: 10px; font-family: 'JetBrains Mono', monospace; color: var(--text-muted); flex-shrink: 0; }

    .resolved-timeline {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 20px; margin-bottom: 20px;
    }
    .resolved-timeline h3 { font-size: 14px; font-weight: 600; margin: 0 0 14px; }
    .tl-dot-start { background: var(--danger) !important; }
    .tl-dot-end { background: var(--success) !important; }

    .dismiss-btn { width: 100%; }

    /* History */
    .history-section {
      margin-top: 28px; padding-top: 20px; border-top: 1px solid var(--border);
    }
    .history-section h3 { font-size: 13px; font-weight: 600; color: var(--text-muted); margin: 0 0 12px; }
    .history-card {
      padding: 12px 16px; background: var(--bg-card); border: 1px solid var(--border);
      border-radius: var(--radius-sm, 12px); margin-bottom: 8px; cursor: pointer;
      transition: all 0.2s;
    }
    .history-card:hover { border-color: var(--accent); background: var(--accent-subtle); }
    .history-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
    .history-title { font-size: 13px; font-weight: 500; }
    .history-date { font-size: 10px; color: var(--text-muted); font-family: 'JetBrains Mono', monospace; }
    .history-meta { display: flex; gap: 12px; font-size: 11px; color: var(--text-muted); }
    .history-rc { font-size: 11px; color: var(--warning); margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    @media (max-width: 768px) {
      .page-header { flex-direction: column; gap: 12px; }
      .header-actions { flex-wrap: wrap; width: 100%; }
      .incident-hero { flex-direction: column; }
      .hero-stats { flex-wrap: wrap; }
      .timeline-entry { flex-direction: column; gap: 4px; }
    }
  `],
})
export class IncidentComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private confirmService = inject(ConfirmService);
  router = inject(Router);
  private base = '/api';
  active: any = null;
  resolved: any = null;
  resolvedDuration = '';
  resolvedExportPath = '';
  reportData: any = null;
  history: any[] = [];
  title = '';
  noteText = '';
  severity = 'high';
  elapsedTime = '00:00';
  snapshotTaken = false;
  analyzing = false;
  sharing = false;
  shareMsg = '';
  probableCause = '';
  blastRadius = '';
  healthScore = 100;
  showActionInput = false;
  showResolveForm = false;
  actionType = 'restart';
  actionTarget = '';
  actionResult = '';
  rootCauseCategory = '';
  rootCauseDetail = '';
  resolutionText = '';
  affectedInput = '';
  affectedResources: string[] = [];
  snapshotDiff: { type: string; message: string }[] = [];
  private timerInterval: any;

  severities = [
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ];

  ngOnInit() { this.loadStatus(); this.loadHistory(); }
  ngOnDestroy() { clearInterval(this.timerInterval); }

  loadHistory() {
    this.http.get<any>(`${this.base}/incident/history`).subscribe(res => {
      this.history = res.incidents || [];
    });
  }

  viewHistoryReport(item: any) {
    this.http.get<any>(`${this.base}/incident/report`, { params: { path: item.path } }).subscribe(res => {
      if (!res.error) {
        this.resolved = res;
        this.resolvedExportPath = item.path;
        this.resolvedDuration = this.calcDuration(res);
      }
    });
  }

  loadStatus() {
    this.http.get<any>(`${this.base}/incident/status`).subscribe(res => {
      this.active = res.status === 'no active incident' ? null : res;
      if (this.active) {
        this.startTimer();
        this.affectedResources = this.active.affected || [];
        this.computeSnapshotDiff();
        // Auto-run AI on first load if no cause yet
        if (!this.probableCause) this.runAiAnalysis();
      }
    });
  }

  start() {
    this.http.post<any>(`${this.base}/incident/start`, { title: this.title }).subscribe(() => {
      this.title = '';
      this.loadStatus();
    });
  }

  stop() {
    const rootCause = this.rootCauseCategory
      ? `[${this.rootCauseCategory}] ${this.rootCauseDetail}`.trim()
      : this.rootCauseDetail;
    this.http.post<any>(`${this.base}/incident/stop`, {
      root_cause: rootCause,
      resolution: this.resolutionText,
    }).subscribe(res => {
      this.active = null;
      this.showResolveForm = false;
      clearInterval(this.timerInterval);
      if (res?.incident) {
        this.resolved = res.incident;
        this.resolvedExportPath = res.export_path || '';
        this.resolvedDuration = this.calcDuration(res.incident);
      }
    });
  }

  dismissResolved() {
    this.resolved = null;
    this.resolvedExportPath = '';
    this.resolvedDuration = '';
    this.reportData = null;
  }

  loadReport() {
    if (!this.resolvedExportPath) return;
    this.http.get<any>(`${this.base}/incident/report`, { params: { path: this.resolvedExportPath } }).subscribe(res => {
      if (!res.error) this.reportData = res;
    });
  }

  calcDuration(incident: any): string {
    if (!incident.started || !incident.ended) return '—';
    const ms = new Date(incident.ended).getTime() - new Date(incident.started).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    return `${h}h ${mins % 60}m`;
  }

  addNote() {
    if (!this.noteText.trim()) return;
    this.http.post<any>(`${this.base}/incident/note`, { text: this.noteText }).subscribe(() => {
      this.noteText = '';
      this.loadStatus();
    });
  }

  snapshot() {
    this.http.post<any>(`${this.base}/incident/snapshot`, {}).subscribe(() => {
      this.snapshotTaken = true;
      this.loadStatus();
      setTimeout(() => this.snapshotTaken = false, 3000);
    });
  }

  logAction() {
    if (!this.actionTarget.trim()) return;
    this.http.post<any>(`${this.base}/incident/action`, {
      action: this.actionType,
      target: this.actionTarget,
      result: this.actionResult,
    }).subscribe(() => {
      this.actionTarget = '';
      this.actionResult = '';
      this.showActionInput = false;
      this.loadStatus();
    });
  }

  addAffected() {
    if (!this.affectedInput.trim()) return;
    this.affectedResources.push(this.affectedInput.trim());
    this.http.post<any>(`${this.base}/incident/note`, {
      text: `[affected] ${this.affectedInput.trim()}`
    }).subscribe(() => this.loadStatus());
    this.affectedInput = '';
  }

  removeAffected(res: string) {
    this.affectedResources = this.affectedResources.filter(r => r !== res);
  }

  private computeSnapshotDiff() {
    const snaps = this.active?.snapshots || [];
    if (snaps.length < 2) { this.snapshotDiff = []; return; }
    const first = snaps[0];
    const last = snaps[snaps.length - 1];
    const diff: { type: string; message: string }[] = [];

    const firstPods = new Set((first.pods || []).map((p: any) => p.name));
    const lastPods = new Set((last.pods || []).map((p: any) => p.name));

    for (const p of last.pods || []) {
      if (!firstPods.has(p.name)) diff.push({ type: 'added', message: `Pod ${p.name} appeared` });
    }
    for (const p of first.pods || []) {
      if (!lastPods.has(p.name)) diff.push({ type: 'removed', message: `Pod ${p.name} disappeared` });
    }
    // Status changes
    for (const p of last.pods || []) {
      const prev = (first.pods || []).find((fp: any) => fp.name === p.name);
      if (prev && prev.status !== p.status) {
        diff.push({ type: 'changed', message: `${p.name}: ${prev.status} → ${p.status}` });
      }
    }
    this.snapshotDiff = diff;
  }

  runAiAnalysis() {
    this.analyzing = true;
    this.http.get<any>(`${this.base}/anomalies`).subscribe(res => {
      const alerts = res.alerts || [];
      if (alerts.length > 0) {
        this.probableCause = alerts[0].message;
        this.blastRadius = `${alerts.length} resources affected across the namespace.`;
        this.healthScore = Math.max(20, 100 - (alerts.length * 15));
      } else {
        this.probableCause = 'No clear infrastructure anomalies detected. Investigating application logic.';
        this.blastRadius = 'Limited to selected deployment.';
        this.healthScore = 95;
      }
      this.analyzing = false;
    });
  }

  shareIncident() {
    this.sharing = true;
    this.http.post<any>(`${this.base}/incident/share`, {}).subscribe({
      next: (res) => {
        this.sharing = false;
        this.shareMsg = res.success ? '✓ Shared to webhooks' : res.message;
        setTimeout(() => this.shareMsg = '', 4000);
      },
      error: () => { this.sharing = false; },
    });
  }

  private startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    const startTime = this.active?.started_at ? new Date(this.active.started_at).getTime() : Date.now();
    this.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
      const s = (elapsed % 60).toString().padStart(2, '0');
      const h = Math.floor(elapsed / 3600);
      this.elapsedTime = h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
    }, 1000);
  }
}
