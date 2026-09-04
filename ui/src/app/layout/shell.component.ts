import { Component, OnInit, HostListener, inject, Input } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ContextsResponse } from '../core/models';
import { PreferencesService } from '../core/services/preferences.service';
import { ApiService } from '../core/services/api.service';
import { HelpDialogComponent } from '../shared/components/help-dialog.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, HelpDialogComponent],
  template: `
    <div class="sidebar-header" [class.header-mini]="collapsed">
      <div class="ctx-block">
        <div class="ctx-header">
          <span class="ctx-kicker">ACTIVE CONTEXT</span>
          <span class="ctx-state" [class.ctx-state-offline]="!clusterOk">{{ clusterOk ? 'ONLINE' : 'OFFLINE' }}</span>
        </div>
        <div class="ctx-readout">
          <div class="ctx-dot" [class.dot-ok]="clusterOk" [class.dot-bad]="!clusterOk" role="status" [attr.aria-label]="clusterOk ? 'Cluster connected' : 'Cluster unreachable'"></div>
          @if (!collapsed) {
            <div class="ctx-info">
              <span class="ctx-name">{{ currentContext }}</span>
            </div>
          }
        </div>
        @if (!collapsed) {
          <span class="ctx-meta">CONTROL PLANE / {{ clusterOk ? 'READY' : 'UNREACHABLE' }}</span>
        }
      </div>
    </div>

    <div class="nav-scroll">
      <!-- Favorites -->
    @if (favorites.length > 0) {
      <nav class="nav-section">
        <span class="nav-label" tabindex="-1">Favorites</span>
        @for (item of favorites; track item.path) {
          <div class="fav-row">
            <a [routerLink]="item.path" routerLinkActive="active" class="nav-item fav-item" tabindex="0">
              <i [class]="item.icon"></i>
              <span>{{ item.label }}</span>
            </a>
            <button class="fav-remove" (click)="removeFavorite(item.path)" title="Remove from favorites" aria-label="Remove {{ item.label }} from favorites">
              <i class="pi pi-times" aria-hidden="true"></i>
            </button>
          </div>
        }
      </nav>
    }

    <nav class="nav-section">
      <button class="nav-label" type="button" (click)="monitorCollapsed = !monitorCollapsed" (keydown)="onKey($event, toggleMonitor.bind(this))"
            aria-label="Toggle Monitor section" [attr.aria-expanded]="!monitorCollapsed">
        <i class="pi collapse-icon" [class.pi-chevron-down]="!monitorCollapsed" [class.pi-chevron-right]="monitorCollapsed" aria-hidden="true"></i>
        Monitor
      </button>
      @if (!monitorCollapsed) {
        @for (item of monitorItems; track item.path) {
          <div class="nav-row">
            <a [routerLink]="item.path" routerLinkActive="active" class="nav-item" tabindex="0">
              <i [class]="item.icon"></i>
              <span>{{ item.label }}</span>
              @if (item.badge) { <span class="nav-badge">{{ item.badge }}</span> }
            </a>
            <button class="star-btn" [class.starred]="isFavorite(item.path)" (click)="toggleFavorite(item.path)"
              [attr.aria-label]="isFavorite(item.path) ? 'Remove ' + item.label + ' from favorites' : 'Add ' + item.label + ' to favorites'"
              [attr.aria-pressed]="isFavorite(item.path)" title="Toggle favorite">
              <i class="pi" [class.pi-star-fill]="isFavorite(item.path)" [class.pi-star]="!isFavorite(item.path)" aria-hidden="true"></i>
            </button>
          </div>
        }
      }
    </nav>

    <nav class="nav-section">
      <button class="nav-label" type="button" (click)="opsCollapsed = !opsCollapsed" (keydown)="onKey($event, toggleOps.bind(this))"
            aria-label="Toggle Operations section" [attr.aria-expanded]="!opsCollapsed">
        <i class="pi collapse-icon" [class.pi-chevron-down]="!opsCollapsed" [class.pi-chevron-right]="opsCollapsed" aria-hidden="true"></i>
        Operations
      </button>
      @if (!opsCollapsed) {
        @for (item of opsItems; track item.path) {
          <div class="nav-row">
            <a [routerLink]="item.path" routerLinkActive="active" class="nav-item" tabindex="0">
              <i [class]="item.icon"></i>
              <span>{{ item.label }}</span>
              @if (item.badge) { <span class="nav-badge">{{ item.badge }}</span> }
            </a>
            <button class="star-btn" [class.starred]="isFavorite(item.path)" (click)="toggleFavorite(item.path)"
              [attr.aria-label]="isFavorite(item.path) ? 'Remove ' + item.label + ' from favorites' : 'Add ' + item.label + ' to favorites'"
              [attr.aria-pressed]="isFavorite(item.path)" title="Toggle favorite">
              <i class="pi" [class.pi-star-fill]="isFavorite(item.path)" [class.pi-star]="!isFavorite(item.path)" aria-hidden="true"></i>
            </button>
          </div>
        }
      }
    </nav>

    <nav class="nav-section">
      <button class="nav-label" type="button" (click)="infraCollapsed = !infraCollapsed" (keydown)="onKey($event, toggleInfra.bind(this))"
            aria-label="Toggle Infrastructure section" [attr.aria-expanded]="!infraCollapsed">
        <i class="pi collapse-icon" [class.pi-chevron-down]="!infraCollapsed" [class.pi-chevron-right]="infraCollapsed" aria-hidden="true"></i>
        Infrastructure
      </button>
      @if (!infraCollapsed) {
        @for (item of infraItems; track item.path) {
          <div class="nav-row">
            <a [routerLink]="item.path" routerLinkActive="active" class="nav-item" tabindex="0">
              <i [class]="item.icon"></i>
              <span>{{ item.label }}</span>
              @if (item.badge) { <span class="nav-badge">{{ item.badge }}</span> }
            </a>
            <button class="star-btn" [class.starred]="isFavorite(item.path)" (click)="toggleFavorite(item.path)"
              [attr.aria-label]="isFavorite(item.path) ? 'Remove ' + item.label + ' from favorites' : 'Add ' + item.label + ' to favorites'"
              [attr.aria-pressed]="isFavorite(item.path)" title="Toggle favorite">
              <i class="pi" [class.pi-star-fill]="isFavorite(item.path)" [class.pi-star]="!isFavorite(item.path)" aria-hidden="true"></i>
            </button>
          </div>
        }
      }
    </nav>

    <nav class="nav-section">
      <button class="nav-label" type="button" (click)="costCollapsed = !costCollapsed" (keydown)="onKey($event, toggleCost.bind(this))"
            aria-label="Toggle Cost and Analytics section" [attr.aria-expanded]="!costCollapsed">
        <i class="pi collapse-icon" [class.pi-chevron-down]="!costCollapsed" [class.pi-chevron-right]="costCollapsed" aria-hidden="true"></i>
        Cost & Analytics
      </button>
      @if (!costCollapsed) {
        @for (item of costItems; track item.path) {
          <div class="nav-row">
            <a [routerLink]="item.path" routerLinkActive="active" class="nav-item" tabindex="0">
              <i [class]="item.icon"></i>
              <span>{{ item.label }}</span>
              @if (item.badge) { <span class="nav-badge">{{ item.badge }}</span> }
            </a>
            <button class="star-btn" [class.starred]="isFavorite(item.path)" (click)="toggleFavorite(item.path)"
              [attr.aria-label]="isFavorite(item.path) ? 'Remove ' + item.label + ' from favorites' : 'Add ' + item.label + ' to favorites'"
              [attr.aria-pressed]="isFavorite(item.path)" title="Toggle favorite">
              <i class="pi" [class.pi-star-fill]="isFavorite(item.path)" [class.pi-star]="!isFavorite(item.path)" aria-hidden="true"></i>
            </button>
          </div>
        }
      }
    </nav>

    <nav class="nav-section">
      <button class="nav-label" type="button" (click)="aiCollapsed = !aiCollapsed" (keydown)="onKey($event, toggleAi.bind(this))"
            aria-label="Toggle Intelligence and Tools section" [attr.aria-expanded]="!aiCollapsed">
        <i class="pi collapse-icon" [class.pi-chevron-down]="!aiCollapsed" [class.pi-chevron-right]="aiCollapsed" aria-hidden="true"></i>
        Intelligence & Tools
      </button>
      @if (!aiCollapsed) {
        @for (item of aiItems; track item.path) {
          <a [routerLink]="item.path" routerLinkActive="active" class="nav-item" tabindex="0">
            <i [class]="item.icon"></i>
            <span>{{ item.label }}</span>
            @if (item.badge) { <span class="nav-badge">{{ item.badge }}</span> }
          </a>
        }
      }
    </nav>
    <nav class="nav-section">
      <a class="nav-item nav-item-more" (click)="openMore()" (keydown)="onKey($event, openMore.bind(this))" tabindex="0" role="button">
        <i class="pi pi-ellipsis-h"></i>
        <span>More...</span>
        <kbd>⌘K</kbd>
      </a>
    </nav>

    </div>

    <div class="nav-footer">
      <a class="nav-item" (click)="openHelp()" (keydown)="onKey($event, openHelp.bind(this))" tabindex="0" role="button">
        <i class="pi pi-question-circle"></i>
        <span>Help</span>
        <kbd>H</kbd>
      </a>
    </div>

    @if (helpVisible) {
      <div class="help-overlay" (click)="helpVisible = false" (keydown.escape)="helpVisible = false">
        <div class="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-dialog-title" (click)="$event.stopPropagation()">
          <div class="help-header">
            <span id="help-dialog-title">Kubsome Help</span>
            <button class="help-close" (click)="helpVisible = false" aria-label="Close help dialog" #helpCloseBtn>
              <i class="pi pi-times"></i>
            </button>
          </div>
          <div class="help-body">
            <app-help-dialog />
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: calc(100vh - 48px - 24px); overflow-y: auto; overflow-x: hidden; }
    :host-context(.rail) .nav-label { display: none; }
    :host-context(.rail) .nav-item span { display: none; }
    :host-context(.rail) .nav-item kbd { display: none; }
    :host-context(.rail) .nav-item { justify-content: center; padding: 8px; margin: 1px 2px; }
    :host-context(.rail) .nav-item i { margin: 0; }
    :host-context(.rail) .fav-remove, :host-context(.rail) .star-btn { display: none; }
    :host-context(.rail) .nav-footer .nav-item span { display: none; }
    :host-context(.rail) .header-mini { padding: 12px 4px 8px; }
    :host-context(.rail) .logo-area { justify-content: center; }
    :host-context(.rail) .ctx-block { justify-content: center; padding: 6px; }
    .sidebar-header {
      padding: 20px 12px 16px;
    }
    .logo-area {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
      padding-left: 8px;
    }
    .logo-icon {
      font-size: 20px;
      color: var(--accent);
    }
    .logo-text {
      font-weight: 800;
      font-size: 18px;
      letter-spacing: -0.02em;
    }
    .ctx-block {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 0;
      background: transparent;
      border: none;
      border-bottom: 1px solid rgba(94, 84, 75, 0.1);
    }
    .ctx-dot {
      width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
    }
    .dot-ok { background: #10b981; box-shadow: 0 0 6px rgba(16, 185, 129, 0.5); }
    .dot-bad { background: #f43f5e; box-shadow: 0 0 6px rgba(244, 63, 94, 0.5); animation: ctxPulse 2s ease-in-out infinite; }
    @keyframes ctxPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
    .ctx-name {
      font-size: 11px; font-weight: 600; color: rgba(245, 240, 235, 0.75);
      font-family: 'JetBrains Mono', monospace;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .logo-icon {
      font-size: 20px;
      color: var(--accent);
    }
    .logo-text {
      font-weight: 800;
      font-size: 18px;
      letter-spacing: -0.02em;
    }
    .nav-section {
      margin-bottom: 4px;
      padding-top: 8px;
      border-top: 1px solid rgba(94, 84, 75, 0.06);
    }
    .nav-section:first-of-type { border-top: none; padding-top: 0; }
    .nav-label {
      display: flex;
      width: 100%;
      align-items: center;
      gap: 4px;
      margin: 0;
      border: none;
      background: transparent;
      color: rgba(168, 158, 148, 0.62);
      cursor: pointer;
      font-family: var(--font-sans);
      font-size: 9px;
      font-weight: 750;
      letter-spacing: 0.08em;
      padding: 8px 12px 5px;
      text-align: left;
      text-transform: uppercase;
      user-select: none;
    }
    .nav-label:focus-visible { color: var(--accent); }
    .nav-label:hover { color: var(--text-secondary); }
    .collapse-icon {
      font-size: 8px;
      opacity: 0.5;
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 34px;
      padding: 7px 10px;
      margin: 2px 6px;
      border: 1px solid transparent;
      border-radius: 7px;
      color: rgba(168, 158, 148, 0.72);
      cursor: pointer;
      font-size: 12px;
      font-weight: 520;
      overflow: hidden;
      text-decoration: none;
      transition: color 0.15s var(--transition-smooth), background 0.15s var(--transition-smooth), border-color 0.15s var(--transition-smooth);
      white-space: nowrap;
    }
    .nav-item:hover {
      border-color: var(--border);
      background: var(--bg-hover);
      color: var(--text);
    }
    .nav-item.active {
      border-color: rgba(var(--accent-rgb), 0.22);
      background: var(--accent-subtle);
      color: var(--accent);
    }
    .nav-item:focus-visible {
      outline: 2px solid var(--focus-ring);
      outline-offset: -2px;
    }
    .nav-badge {
      font-size: 7px; font-weight: 800; padding: 1px 4px; border-radius: 0;
      background: transparent; color: rgba(208, 156, 96, 0.7); margin-left: 6px;
      text-transform: uppercase; letter-spacing: 0.06em;
      border: 1px solid rgba(208, 156, 96, 0.2);
    }
    .nav-item i {
      font-size: 12px;
      width: 16px;
      text-align: center;
      opacity: 0.4;
    }
    .nav-item:hover i { opacity: 0.7; }
    .nav-item.active i { opacity: 1; }
    .nav-item kbd {
      margin-left: auto;
      font-size: 9px;
      padding: 1px 4px;
      border-radius: 0;
      background: transparent;
      border: none;
      border-left: 1px solid rgba(94, 84, 75, 0.12);
      color: rgba(168, 158, 148, 0.35);
      font-family: 'JetBrains Mono', monospace;
      padding-left: 6px;
    }
    .fav-row, .nav-row {
      display: flex;
      align-items: center;
    }
    .fav-row .nav-item, .nav-row .nav-item { flex: 1; }
    .fav-remove, .star-btn {
      background: none;
      border: none;
      color: rgba(168, 158, 148, 0.4);
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      font-size: 10px;
      opacity: 0;
      transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
      outline: none;
    }
    .fav-row:hover .fav-remove, .nav-row:hover .star-btn { opacity: 0.6; }
    .fav-row .fav-remove:focus-visible, .nav-row .star-btn:focus-visible { opacity: 1; color: #f59e0b; box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.4); }
    .fav-remove:hover { opacity: 1 !important; color: #f43f5e; }
    .star-btn:hover { opacity: 1 !important; color: #f59e0b; }
    .star-btn.starred { opacity: 0.8; color: #f59e0b; }
    .star-btn.starred:hover { opacity: 1; }
    .nav-footer {
      margin-top: auto;
      padding-top: 6px;
      border-top: 1px solid rgba(94, 84, 75, 0.12);
    }
    .help-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.6);
      backdrop-filter: blur(4px); z-index: 9000;
      display: flex; align-items: center; justify-content: center;
    }
    .help-modal {
      width: min(650px, 90vw); max-height: 80vh;
      background: linear-gradient(180deg, rgba(13, 17, 28, 0.98) 0%, rgba(8, 11, 20, 1) 100%);
      border: 1px solid rgba(94, 84, 75, 0.2); border-radius: 14px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.7); display: flex; flex-direction: column;
      overflow: hidden;
      animation: helpIn 0.25s cubic-bezier(0.34,1.56,0.64,1);
    }
    @keyframes helpIn { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
    @media (max-width: 768px) {
      .help-modal { width: 100vw; height: 100vh; max-height: 100vh; border-radius: 0; }
    }
    .help-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 20px; border-bottom: 1px solid rgba(94, 84, 75, 0.12);
      font-size: 15px; font-weight: 600;
    }
    .help-close {
      background: none; border: none; color: rgba(168, 158, 148, 0.5);
      cursor: pointer; padding: 4px; border-radius: 4px;
    }
    .help-close:hover { background: rgba(245, 240, 235, 0.04); color: rgba(245, 240, 235, 0.85); }
    .help-close:focus-visible { outline: none; background: rgba(208, 156, 96, 0.04); color: #d09c60; box-shadow: 0 0 0 2px rgba(208, 156, 96, 0.3); }
    .help-body { padding: 20px; overflow-y: auto; }

    /* ─── Light Mode ──────────────────────────────────────────────── */
    :host-context([data-theme="light"]) .ctx-block {
      border-bottom-color: rgba(0, 0, 0, 0.06);
    }
    :host-context([data-theme="light"]) .ctx-name { color: rgba(0, 0, 0, 0.7); }
    :host-context([data-theme="light"]) .nav-label { color: rgba(0, 0, 0, 0.35); }
    :host-context([data-theme="light"]) .nav-label:focus-visible { color: #9a5129; }
    :host-context([data-theme="light"]) .nav-item { color: rgba(0, 0, 0, 0.4); }
    :host-context([data-theme="light"]) .nav-item:hover {
      color: rgba(0, 0, 0, 0.8);
    }
    :host-context([data-theme="light"]) .nav-item.active {
      color: #9a5129;
      border-left-color: #9a5129;
    }
    :host-context([data-theme="light"]) .nav-item:focus-visible {
      border-left-color: rgba(154, 81, 41, 0.3);
    }
    :host-context([data-theme="light"]) .nav-badge {
      color: rgba(154, 81, 41, 0.7); border-color: rgba(154, 81, 41, 0.15);
    }
    :host-context([data-theme="light"]) .nav-item i { opacity: 0.5; }
    :host-context([data-theme="light"]) .nav-item.active i { opacity: 1; }
    :host-context([data-theme="light"]) .nav-item kbd {
      border-left-color: rgba(0, 0, 0, 0.06);
      color: rgba(0, 0, 0, 0.25);
    }
    :host-context([data-theme="light"]) .fav-remove, :host-context([data-theme="light"]) .star-btn {
      color: rgba(0, 0, 0, 0.3);
    }
    :host-context([data-theme="light"]) .nav-footer {
      border-top-color: rgba(0, 0, 0, 0.06);
    }
    :host-context([data-theme="light"]) .help-modal {
      background: #ffffff;
      border-color: rgba(0, 0, 0, 0.1);
    }
    :host-context([data-theme="light"]) .help-header {
      border-bottom-color: rgba(0, 0, 0, 0.06);
    }
    :host-context([data-theme="light"]) .help-close { color: rgba(0, 0, 0, 0.4); }
    :host-context([data-theme="light"]) .help-close:hover { background: rgba(0, 0, 0, 0.04); color: rgba(0, 0, 0, 0.8); }

    .nav-item-more { opacity: 0.5; }
    .nav-item-more:hover { opacity: 1; }

    /* SaaS Noir navigation pass. */
    :host {
      height: 100%;
    }

    .sidebar-header {
      padding: 14px 8px 12px;
    }

    .ctx-block {
      padding: 9px 10px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--bg-elevated);
    }

    .ctx-dot {
      width: 6px;
      height: 6px;
    }

    .dot-ok,
    .dot-bad {
      box-shadow: none;
      animation: none;
    }

    .dot-bad {
      background: var(--danger);
    }

    .ctx-name {
      color: var(--text-secondary);
      font-family: var(--font-mono);
      font-size: 11px;
    }

    .nav-section {
      margin-bottom: 7px;
      padding-top: 7px;
      border-top-color: var(--border-subtle);
    }

    .nav-label {
      color: var(--text-muted);
      font-size: 10px;
      font-weight: 650;
      letter-spacing: 0.01em;
      text-transform: none;
    }

    .nav-item {
      min-height: 35px;
      color: var(--text-secondary);
      font-size: 13px;
    }

    .nav-item i {
      color: var(--text-muted);
      opacity: 1;
    }

    .nav-item:hover i,
    .nav-item.active i {
      color: currentColor;
      opacity: 1;
    }

    .nav-item.active {
      border-color: rgba(var(--accent-rgb), 0.24);
      background: var(--accent-subtle);
      color: var(--accent);
    }

    .nav-badge {
      border: 0;
      border-radius: 4px;
      background: var(--accent-subtle);
      color: var(--accent);
      font-size: 10px;
      letter-spacing: 0;
      padding: 2px 5px;
    }

    .nav-item kbd {
      border-left-color: var(--border);
      color: var(--text-muted);
      font-size: 10px;
    }

    .fav-remove,
    .star-btn {
      color: var(--text-muted);
      transition: color 0.15s var(--transition-smooth), opacity 0.15s var(--transition-smooth);
    }

    .fav-row .fav-remove:focus-visible,
    .nav-row .star-btn:focus-visible {
      color: var(--accent);
      box-shadow: 0 0 0 2px rgba(var(--accent-rgb), 0.24);
    }

    .help-overlay {
      background: rgba(5, 5, 5, 0.58);
      backdrop-filter: none;
    }

    .help-modal {
      background: var(--bg-card);
      border-color: var(--border);
      border-radius: 10px;
      box-shadow: var(--shadow-lg);
      animation: none;
    }

    .help-header {
      border-bottom-color: var(--border);
    }

    @media (prefers-reduced-motion: reduce) {
      .dot-bad,
      .help-modal {
        animation: none;
      }
    }

    :host-context([data-theme="light"]) .ctx-name,
    :host-context([data-theme="light"]) .nav-item {
      color: var(--text-secondary);
    }

    :host-context([data-theme="light"]) .nav-label {
      color: var(--text-muted);
    }

    :host-context([data-theme="light"]) .nav-item.active {
      color: var(--accent);
    }

    :host-context([data-theme="light"]) .nav-item kbd {
      color: var(--text-muted);
      border-left-color: var(--border);
    }

    /* Operational shell finish: token-led hierarchy, not decoration. */
    :host {
      scrollbar-color: var(--border) transparent;
      scrollbar-gutter: stable;
    }

    .ctx-block {
      position: relative;
      overflow: hidden;
      border-color: rgba(var(--accent-rgb), 0.22);
      background: linear-gradient(90deg, var(--accent-subtle), transparent 78%), var(--bg-elevated);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.025);
    }

    .ctx-block::before {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      width: 2px;
      background: var(--accent);
      content: '';
      opacity: 0.8;
    }

    .ctx-dot {
      margin-left: 2px;
    }

    .nav-section {
      border-top-color: var(--border-subtle);
    }

    .nav-label {
      min-height: 28px;
      padding-inline: 10px;
      color: var(--text-muted);
    }

    .nav-label:hover,
    .nav-label:focus-visible {
      color: var(--accent);
    }

    .nav-label .collapse-icon {
      color: currentColor;
      opacity: 0.7;
    }

    .nav-item {
      position: relative;
      border-color: transparent;
      transition: color 0.15s var(--transition-smooth), background 0.15s var(--transition-smooth), border-color 0.15s var(--transition-smooth), transform 0.15s var(--transition-smooth);
    }

    .nav-item::before {
      position: absolute;
      top: 7px;
      bottom: 7px;
      left: -1px;
      width: 2px;
      background: var(--accent);
      content: '';
      transform: scaleY(0);
      transition: transform 0.15s var(--transition-smooth);
    }

    .nav-item.active {
      box-shadow: inset 12px 0 20px -22px rgba(var(--accent-rgb), 0.9);
    }

    .nav-item.active::before {
      transform: scaleY(1);
    }

    .nav-item:active,
    .nav-label:active,
    .star-btn:active,
    .fav-remove:active {
      transform: translateY(1px);
    }

    .nav-item-more {
      border-top: 1px solid var(--border-subtle);
      margin-top: 4px;
      padding-top: 9px;
    }

    .nav-footer {
      border-top-color: var(--border);
    }

    .fav-remove:focus-visible,
    .star-btn:focus-visible,
    .help-close:focus-visible {
      outline: 2px solid var(--focus-ring);
      outline-offset: 2px;
      box-shadow: none;
    }

    .help-header {
      background: var(--bg-elevated);
    }

    :host-context(.rail) .nav-item::before {
      left: 0;
    }

    :host-context(.rail) .ctx-block {
      border-color: rgba(var(--accent-rgb), 0.2);
    }

    @media (prefers-reduced-motion: reduce) {
      .nav-item,
      .nav-item::before,
      .nav-item:active,
      .nav-label:active,
      .star-btn:active,
      .fav-remove:active {
        transition: none;
        transform: none;
      }
    }

    /* Pods/Jobs telemetry language for shell chrome. */
    :host {
      position: relative;
      isolation: isolate;
    }

    :host::before {
      position: absolute;
      z-index: 0;
      inset: 0;
      background-image: linear-gradient(rgba(var(--info-rgb), 0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(var(--info-rgb), 0.025) 1px, transparent 1px);
      background-size: 28px 28px;
      content: '';
      mask-image: linear-gradient(to bottom, black, transparent 88%);
      pointer-events: none;
    }

    :host > * {
      position: relative;
      z-index: 1;
    }

    .sidebar-header {
      padding: 12px 8px 13px;
    }

    .ctx-block {
      display: flex;
      flex-direction: column;
      gap: 7px;
      padding: 10px 11px 9px;
      border-left: 2px solid var(--accent);
      border-color: rgba(var(--accent-rgb), 0.28);
      background: linear-gradient(90deg, var(--accent-subtle), transparent 78%), var(--surface-card);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
    }

    .ctx-header,
    .ctx-readout {
      display: flex;
      align-items: center;
    }

    .ctx-header {
      justify-content: space-between;
      gap: 8px;
    }

    .ctx-kicker,
    .ctx-meta,
    .ctx-state {
      font-family: var(--font-mono);
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .ctx-kicker,
    .ctx-meta {
      color: var(--text-muted);
    }

    .ctx-state {
      color: var(--success);
    }

    .ctx-state-offline {
      color: var(--danger);
    }

    .ctx-readout {
      min-width: 0;
      gap: 8px;
    }

    .ctx-name {
      color: var(--text);
      font-size: 12px;
      font-weight: 650;
    }

    .ctx-meta {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .ctx-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
    }

    .dot-ok {
      background: var(--success);
      box-shadow: 0 0 0 3px var(--success-subtle);
    }

    .dot-bad {
      background: var(--danger);
      box-shadow: 0 0 0 3px var(--danger-subtle);
    }

    .nav-section {
      margin-bottom: 8px;
      padding-top: 8px;
      border-top-color: var(--border-subtle);
    }

    .nav-label {
      min-height: 27px;
      padding: 7px 10px 5px;
      color: var(--info);
      font-family: var(--font-mono);
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .nav-label:hover,
    .nav-label:focus-visible {
      color: var(--accent);
    }

    .nav-item {
      min-height: 36px;
      margin: 2px 5px;
      padding: 8px 10px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 550;
    }

    .nav-item i {
      width: 18px;
      font-size: 13px;
    }

    .nav-item.active {
      border-color: rgba(var(--accent-rgb), 0.3);
      background: linear-gradient(90deg, var(--accent-subtle), transparent 88%);
      color: var(--accent);
    }

    .nav-badge {
      border: 1px solid rgba(var(--accent-rgb), 0.24);
      border-radius: 3px;
      background: transparent;
      color: var(--accent);
      font-family: var(--font-mono);
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.08em;
      padding: 2px 5px;
    }

    .nav-item-more {
      margin-top: 6px;
      border-top-color: var(--border-subtle);
    }

    :host-context(.rail) .ctx-block {
      align-items: center;
      padding: 9px 5px;
    }

    :host-context(.rail) .ctx-header,
    :host-context(.rail) .ctx-meta {
      display: none;
    }

    :host-context(.rail) .ctx-readout {
      justify-content: center;
    }

    @media (prefers-reduced-motion: reduce) {
      .dot-ok,
      .dot-bad {
        box-shadow: none;
      }
    }

    /* Keep Help in dedicated bottom space while navigation scrolls. */
    :host {
      min-height: 0;
      overflow: hidden;
    }

    .nav-scroll {
      min-height: 0;
      flex: 1 1 auto;
      overflow-x: hidden;
      overflow-y: auto;
      scrollbar-color: var(--border) transparent;
      scrollbar-gutter: stable;
    }

    .nav-footer {
      position: relative;
      bottom: auto;
      z-index: 4;
      display: flex;
      flex: 0 0 52px;
      min-height: 52px;
      align-items: flex-end;
      margin-top: 0;
      padding: 8px 0 4px;
      border-top: 1px solid var(--border);
      background: linear-gradient(180deg, transparent, var(--surface-card) 18%), var(--surface-card);
    }

    .nav-footer .nav-item {
      width: 100%;
      margin-bottom: 0;
    }

    :host-context(.rail) .nav-footer {
      flex-basis: 52px;
      min-height: 52px;
      align-items: center;
      justify-content: center;
      padding: 8px 0 4px;
    }

    :host-context(.rail) .nav-footer .nav-item {
      width: 40px;
      min-height: 36px;
      margin: 0 auto;
      padding: 8px;
    }
  `],
})
export class ShellComponent implements OnInit {
  @Input() collapsed = false;
  private http = inject(HttpClient);
  private router = inject(Router);
  private api = inject(ApiService);

  currentContext = '...';
  clusterOk = true;
  helpVisible = false;
  monitorCollapsed = false;
  opsCollapsed = false;
  infraCollapsed = false;
  costCollapsed = false;
  aiCollapsed = false;

  private prefsService = inject(PreferencesService);
  favorites: { path: string; icon: string; label: string }[] = [];

  monitorItems: any[] = [
    { path: '/monitor/dashboard', icon: 'pi pi-objects-column', label: 'Dashboard' },
    { path: '/monitor/overview', icon: 'pi pi-desktop', label: 'Monitor' },
    { path: '/monitor/investigate', icon: 'pi pi-search', label: 'Investigate' },
    { path: '/monitor/metrics', icon: 'pi pi-chart-line', label: 'Metrics' },
    { path: '/monitor/events', icon: 'pi pi-bolt', label: 'Events' },
    { path: '/monitor/logs', icon: 'pi pi-align-left', label: 'Logs' },
  ];

  opsItems: any[] = [
    { path: '/operations/pods', icon: 'pi pi-box', label: 'Pods' },
    { path: '/operations/deployments', icon: 'pi pi-send', label: 'Deployments' },
    { path: '/operations/jobs', icon: 'pi pi-clock', label: 'Jobs' },
    { path: '/operations/resources', icon: 'pi pi-database', label: 'Resources' },
    { path: '/operations/incident', icon: 'pi pi-exclamation-circle', label: 'Incident' },
    { path: '/operations/terminal', icon: 'pi pi-code', label: 'Terminal' },
    { path: '/operations/runbooks', icon: 'pi pi-book', label: 'Runbooks' },
    { path: '/operations/yaml', icon: 'pi pi-file-edit', label: 'YAML' },
  ];

  infraItems: any[] = [
    { path: '/infrastructure/network', icon: 'pi pi-globe', label: 'Network' },
    { path: '/infrastructure/graph', icon: 'pi pi-sitemap', label: 'Service Map' },
    { path: '/infrastructure/gitops', icon: 'pi pi-sync', label: 'GitOps' },
    { path: '/infrastructure/policy', icon: 'pi pi-verified', label: 'Policy' },
  ];

  costItems: any[] = [
    { path: '/cost-analytics/analytics', icon: 'pi pi-chart-bar', label: 'Analytics' },
    { path: '/cost-analytics/cost', icon: 'pi pi-dollar', label: 'Optimization' },
  ];

  aiItems: any[] = [
    { path: '/intelligence/ai', icon: 'pi pi-sparkles', label: 'AI Assistant' },
    { path: '/intelligence/settings', icon: 'pi pi-cog', label: 'Settings' },
  ];


  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    const tag = (event.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (event.key === 'h' || event.key === 'H') this.openHelp();

    // G + key navigation shortcuts
    if (this.pendingG) {
      this.pendingG = false;
      switch (event.key) {
        case 'd': this.router.navigate(['/monitor/dashboard']); break;
        case 'p': this.router.navigate(['/operations/pods']); break;
        case 'e': this.router.navigate(['/monitor/events']); break;
        case 'l': this.router.navigate(['/monitor/logs']); break;
        case 't': this.router.navigate(['/operations/terminal']); break;
        case 'a': this.router.navigate(['/intelligence/ai']); break;
        case 'm': this.router.navigate(['/monitor/metrics']); break;
        case 'r': this.router.navigate(['/operations/runbooks']); break;
        case 's': this.router.navigate(['/intelligence/settings']); break;
      }
      return;
    }
    if (event.key === 'g') {
      this.pendingG = true;
      setTimeout(() => this.pendingG = false, 500);
    }
  }

  private pendingG = false;

  openHelp() { this.helpVisible = true; }

  toggleMonitor() { this.monitorCollapsed = !this.monitorCollapsed; }
  toggleOps() { this.opsCollapsed = !this.opsCollapsed; }
  toggleInfra() { this.infraCollapsed = !this.infraCollapsed; }
  toggleCost() { this.costCollapsed = !this.costCollapsed; }
  toggleAi() { this.aiCollapsed = !this.aiCollapsed; }

  onKey(event: KeyboardEvent, action: Function) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      action();
    }
  }

  ngOnInit() {
    this.loadFavorites();
    this.http.get<any>('/api/contexts').subscribe({
      next: (res) => { this.currentContext = res.current ?? 'none'; },
      error: () => { },
    });
    this.http.get<any>('/api/uptime').subscribe({
      next: (res) => { this.clusterOk = res.api_reachable && !res.cluster_down; },
      error: () => { this.clusterOk = false; },
    });
  }
  private get allItems() {
    return [...this.monitorItems, ...this.opsItems, ...this.infraItems, ...this.costItems, ...this.aiItems];
  }

  loadFavorites() {
    const paths = this.prefsService.get('sidebarFavorites');
    this.favorites = paths.map(p => this.allItems.find(i => i.path === p)).filter(Boolean) as any[];
  }

  toggleFavorite(path: string) {
    if (this.isFavorite(path)) {
      this.removeFavorite(path);
    } else {
      this.addFavorite(path);
    }
  }

  removeFavorite(path: string) {
    const paths = this.prefsService.get('sidebarFavorites').filter(p => p !== path);
    this.prefsService.set('sidebarFavorites', paths);
    this.loadFavorites();
  }

  addFavorite(path: string) {
    const paths = this.prefsService.get('sidebarFavorites');
    if (!paths.includes(path)) {
      this.prefsService.set('sidebarFavorites', [...paths, path]);
      this.loadFavorites();
    }
  }

  isFavorite(path: string): boolean {
    return this.prefsService.get('sidebarFavorites').includes(path);
  }

  openMore() {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
  }


}
