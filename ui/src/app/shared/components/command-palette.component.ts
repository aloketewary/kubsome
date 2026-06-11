import { Component, inject, HostListener, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

interface PaletteItem {
  type: 'page' | 'pod' | 'deployment' | 'command';
  icon: string;
  label: string;
  hint?: string;
  action: () => void;
}

@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (visible) {
      <div class="overlay" (click)="close()">
        <div class="palette" (click)="$event.stopPropagation()">
          <div class="palette-input-wrap">
            <i class="pi pi-search"></i>
            <input
              #searchInput
              [(ngModel)]="query"
              (ngModelChange)="filter()"
              (keydown.escape)="close()"
              (keydown.arrowDown)="moveDown()"
              (keydown.arrowUp)="moveUp()"
              (keydown.enter)="execute()"
              role="combobox"
              aria-autocomplete="list"
              [attr.aria-expanded]="visible"
              aria-haspopup="listbox"
              aria-controls="palette-results"
              [attr.aria-activedescendant]="
                visible ? 'option-' + activeIndex : null
              "
              placeholder="Search pages, pods, commands..."
              spellcheck="false"
              autocomplete="off"
            />
            <kbd>ESC</kbd>
          </div>

          <div
            class="palette-results"
            id="palette-results"
            role="listbox"
            aria-label="Search results"
          >
            @if (filtered.length === 0 && query) {
              <div class="no-results">No results for "{{ query }}"</div>
            }
            @for (item of filtered; track $index) {
              <div
                class="palette-item"
                [class.active]="$index === activeIndex"
                role="option"
                [id]="'option-' + $index"
                [attr.aria-selected]="$index === activeIndex"
                (click)="executeItem(item)"
                (mouseenter)="activeIndex = $index"
              >
                <i [class]="item.icon"></i>
                <span class="item-label">{{ item.label }}</span>
                @if (item.hint && item.type === 'page') {
                  <span class="item-hint"
                    ><kbd>{{ item.hint }}</kbd></span
                  >
                } @else if (item.hint) {
                  <span class="item-hint">{{ item.hint }}</span>
                }
                <span class="item-type">{{ item.type }}</span>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
        z-index: 9999;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding-top: 20vh;
      }
      .palette {
        width: 640px;
        max-height: 480px;
        background: var(--bg-card);
        border: 1px solid var(--border-hover);
        border-radius: 20px;
        box-shadow: 0 32px 100px rgba(0, 0, 0, 0.8);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        animation: palette-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      }
      @keyframes palette-in {
        from {
          opacity: 0;
          transform: scale(0.98) translateY(-10px);
        }
        to {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }
      .palette-input-wrap {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 20px;
        border-bottom: 1px solid var(--border);
      }
      .palette-input-wrap i {
        color: var(--text-muted);
        font-size: 16px;
      }
      .palette-input-wrap input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        font-size: 15px;
        color: var(--text);
        font-family: inherit;
      }
      .palette-input-wrap input::placeholder {
        color: var(--text-muted);
      }
      .palette-input-wrap kbd {
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 4px;
        background: var(--bg-elevated);
        border: 1px solid var(--border);
        color: var(--text-muted);
      }
      .palette-results {
        overflow-y: auto;
        max-height: 340px;
        padding: 8px;
      }
      .palette-item {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 12px 16px;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.1s ease;
        margin-bottom: 2px;
      }
      .palette-item.active {
        background: var(--bg-hover);
        transform: translateX(4px);
      }
      .palette-item i {
        font-size: 14px;
        color: var(--text-muted);
        width: 20px;
        text-align: center;
      }
      .palette-item.active i {
        color: var(--accent);
      }
      .item-label {
        flex: 1;
        font-size: 13px;
      }
      .item-hint {
        font-size: 11px;
        color: var(--text-muted);
        display: flex;
        align-items: center;
      }
      .item-hint kbd {
        font-family: inherit;
        font-size: 9px;
        padding: 1px 4px;
        background: var(--bg-elevated);
        border: 1px solid var(--border);
        border-radius: 4px;
        color: var(--accent);
        font-weight: 600;
      }
      .item-type {
        font-size: 10px;
        color: var(--text-muted);
        background: var(--bg-elevated);
        padding: 2px 6px;
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .no-results {
        text-align: center;
        padding: 24px;
        color: var(--text-muted);
        font-size: 13px;
      }
    `,
  ],
})
export class CommandPaletteComponent implements OnInit {
  private router = inject(Router);
  private api = inject(ApiService);

  visible = false;
  query = '';
  activeIndex = 0;
  allItems: PaletteItem[] = [];
  filtered: PaletteItem[] = [];

  private pages: PaletteItem[] = [
    // Observe
    { type: 'page', icon: 'pi pi-objects-column', label: 'Dashboard', hint: 'G D', action: () => this.go('/dashboard') },
    { type: 'page', icon: 'pi pi-desktop', label: 'Monitor', action: () => this.go('/monitor') },
    { type: 'page', icon: 'pi pi-search', label: 'Investigate', action: () => this.go('/investigate') },
    { type: 'page', icon: 'pi pi-wave-pulse', label: 'Health Signals', action: () => this.go('/health-signals') },
    { type: 'page', icon: 'pi pi-chart-line', label: 'Metrics', hint: 'G M', action: () => this.go('/metrics') },
    { type: 'page', icon: 'pi pi-bolt', label: 'Events', hint: 'G E', action: () => this.go('/events') },
    { type: 'page', icon: 'pi pi-align-left', label: 'Logs', hint: 'G L', action: () => this.go('/logs') },
    { type: 'page', icon: 'pi pi-trophy', label: 'Scorecard', action: () => this.go('/scorecard') },
    { type: 'page', icon: 'pi pi-history', label: 'Timeline', action: () => this.go('/timeline') },
    { type: 'page', icon: 'pi pi-heart', label: 'Health Check', action: () => this.go('/doctor') },

    // Workloads
    { type: 'page', icon: 'pi pi-box', label: 'Pods', hint: 'G P', action: () => this.go('/pods') },
    { type: 'page', icon: 'pi pi-send', label: 'Deployments', action: () => this.go('/deployments') },
    { type: 'page', icon: 'pi pi-clock', label: 'Jobs', action: () => this.go('/jobs') },
    { type: 'page', icon: 'pi pi-database', label: 'Resources', action: () => this.go('/resources') },
    { type: 'page', icon: 'pi pi-th-large', label: 'Namespace', action: () => this.go('/namespace') },
    { type: 'page', icon: 'pi pi-shield', label: 'RBAC', action: () => this.go('/rbac') },
    { type: 'page', icon: 'pi pi-lock', label: 'Pull Secrets', action: () => this.go('/secrets') },
    { type: 'page', icon: 'pi pi-exclamation-circle', label: 'Incident', action: () => this.go('/incident') },
    { type: 'page', icon: 'pi pi-code', label: 'Terminal', hint: 'G T', action: () => this.go('/terminal') },
    { type: 'page', icon: 'pi pi-book', label: 'Runbooks', hint: 'G R', action: () => this.go('/runbooks') },
    { type: 'page', icon: 'pi pi-file-edit', label: 'YAML Editor', action: () => this.go('/yaml') },
    { type: 'page', icon: 'pi pi-copy', label: 'YAML Diff', action: () => this.go('/yaml-diff') },
    { type: 'page', icon: 'pi pi-file-check', label: 'Audit', action: () => this.go('/audit') },

    // Infrastructure
    { type: 'page', icon: 'pi pi-globe', label: 'Network', action: () => this.go('/network') },
    { type: 'page', icon: 'pi pi-sitemap', label: 'Service Map', action: () => this.go('/graph') },
    { type: 'page', icon: 'pi pi-server', label: 'Gateway', action: () => this.go('/gateway-monitor') },
    { type: 'page', icon: 'pi pi-sync', label: 'GitOps', action: () => this.go('/gitops') },
    { type: 'page', icon: 'pi pi-share-alt', label: 'Service Mesh', action: () => this.go('/mesh') },
    { type: 'page', icon: 'pi pi-link', label: 'Integrations', action: () => this.go('/integrations') },
    { type: 'page', icon: 'pi pi-arrows-h', label: 'Compare Clusters', action: () => this.go('/compare') },
    { type: 'page', icon: 'pi pi-verified', label: 'Policy', action: () => this.go('/policy') },
    { type: 'page', icon: 'pi pi-ban', label: 'Node Taints', action: () => this.go('/taints') },
    { type: 'page', icon: 'pi pi-cog', label: 'Node Operations', action: () => this.go('/node-ops') },
    { type: 'page', icon: 'pi pi-wrench', label: 'Resource Operations', action: () => this.go('/resource-ops') },

    // Cost & Analytics
    { type: 'page', icon: 'pi pi-chart-bar', label: 'Analytics', action: () => this.go('/analytics') },
    { type: 'page', icon: 'pi pi-dollar', label: 'Optimization', action: () => this.go('/cost') },
    { type: 'page', icon: 'pi pi-calculator', label: 'Cost Estimate', action: () => this.go('/cost-estimate') },
    { type: 'page', icon: 'pi pi-sliders-h', label: 'Right-Sizing', action: () => this.go('/rightsizing') },
    { type: 'page', icon: 'pi pi-server', label: 'Helm', action: () => this.go('/helm') },
    { type: 'page', icon: 'pi pi-link', label: 'Port Forwards', action: () => this.go('/port-forwards') },
    { type: 'page', icon: 'pi pi-bullseye', label: 'Blast Radius', action: () => this.go('/blast-radius') },
    { type: 'page', icon: 'pi pi-wallet', label: 'Chargeback', action: () => this.go('/chargeback') },
    { type: 'page', icon: 'pi pi-trash', label: 'Idle Resources', action: () => this.go('/idle-resources') },

    // Tools
    { type: 'page', icon: 'pi pi-sparkles', label: 'AI Assistant', hint: 'G A', action: () => this.go('/ai') },
    { type: 'page', icon: 'pi pi-arrows-alt', label: 'Log Correlation', action: () => this.go('/log-correlation') },
    { type: 'page', icon: 'pi pi-bookmark', label: 'Pins', action: () => this.go('/pins') },
    { type: 'page', icon: 'pi pi-eye', label: 'Watches', action: () => this.go('/watches') },
    { type: 'page', icon: 'pi pi-calendar', label: 'Schedules', action: () => this.go('/schedule') },
    { type: 'page', icon: 'pi pi-user', label: 'Profiles', action: () => this.go('/profiles') },
    { type: 'page', icon: 'pi pi-percentage', label: 'Usage Stats', action: () => this.go('/stats') },
    { type: 'page', icon: 'pi pi-cog', label: 'Settings', hint: 'G S', action: () => this.go('/settings') },
    { type: 'page', icon: 'pi pi-th-large', label: 'Custom Dashboard', action: () => this.go('/my-dashboard') },
  ];


  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      this.toggle();
    }
  }

  ngOnInit() {
    this.allItems = [...this.pages];
    this.filtered = this.allItems.slice(0, 8);

    // Load pods and deployments for search
    this.api.getPods().subscribe((res) => {
      const podItems: PaletteItem[] = res.pods.map((p) => ({
        type: 'pod' as const,
        icon:
          p.status === 'Running'
            ? 'pi pi-check-circle'
            : 'pi pi-exclamation-triangle',
        label: p.name,
        hint: p.status,
        action: () => this.go('/pods'),
      }));
      this.allItems = [...this.pages, ...podItems];
    });

    this.api.getDeployments().subscribe((res) => {
      const depItems: PaletteItem[] = res.deployments.map((d) => ({
        type: 'deployment' as const,
        icon: 'pi pi-send',
        label: d.name,
        hint: `${d.available}/${d.desired}`,
        action: () => this.go('/deployments'),
      }));
      this.allItems = [...this.allItems, ...depItems];
    });
  }

  toggle() {
    this.visible = !this.visible;
    if (this.visible) {
      this.query = '';
      this.activeIndex = 0;
      this.filtered = this.allItems.slice(0, 8);
      setTimeout(() => {
        document
          .querySelector<HTMLInputElement>('.palette-input-wrap input')
          ?.focus();
      }, 50);
    }
  }

  close() {
    this.visible = false;
  }

  filter() {
    const q = this.query.toLowerCase().trim();
    const cleanQ = q.replace(/\s+/g, '');
    if (!q) {
      this.filtered = this.allItems.slice(0, 8);
    } else {
      this.filtered = this.allItems
        .filter((item) => {
          const label = item.label.toLowerCase();
          const type = item.type.toLowerCase();
          const hint = (item.hint || '').toLowerCase();
          const cleanHint = hint.replace(/\s+/g, '');

          return (
            label.includes(q) ||
            type.includes(q) ||
            (hint && (hint.includes(q) || cleanHint.includes(cleanQ)))
          );
        })
        .slice(0, 10);
    }
    this.activeIndex = 0;
  }

  moveDown() {
    if (this.activeIndex < this.filtered.length - 1) {
      this.activeIndex++;
      this.scrollActiveIntoView();
    }
  }

  moveUp() {
    if (this.activeIndex > 0) {
      this.activeIndex--;
      this.scrollActiveIntoView();
    }
  }

  private scrollActiveIntoView() {
    setTimeout(() => {
      const activeEl = document.querySelector('.palette-item.active');
      activeEl?.scrollIntoView({ block: 'nearest' });
    });
  }

  execute() {
    if (this.filtered[this.activeIndex]) {
      this.executeItem(this.filtered[this.activeIndex]);
    }
  }

  executeItem(item: PaletteItem) {
    this.close();
    item.action();
  }

  private go(path: string) {
    this.router.navigate([path]);
  }
}
