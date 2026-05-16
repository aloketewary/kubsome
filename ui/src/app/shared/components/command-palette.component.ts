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
              placeholder="Search pages, pods, commands..."
              spellcheck="false"
              autocomplete="off"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded="true"
              aria-haspopup="listbox"
              aria-controls="palette-results-list"
              [attr.aria-activedescendant]="'item-' + activeIndex"
            />
            <kbd>ESC</kbd>
          </div>

          <div class="palette-results" id="palette-results-list" role="listbox">
            @if (filtered.length === 0 && query) {
              <div class="no-results">No results for "{{ query }}"</div>
            }
            @for (item of filtered; track $index) {
              <div
                class="palette-item"
                [class.active]="$index === activeIndex"
                [id]="'item-' + $index"
                role="option"
                [attr.aria-selected]="$index === activeIndex"
                (click)="executeItem(item)"
                (mouseenter)="activeIndex = $index"
              >
                <i [class]="item.icon"></i>
                <span class="item-label">{{ item.label }}</span>
                @if (item.hint) {
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
    {
      type: 'page',
      icon: 'pi pi-objects-column',
      label: 'Dashboard',
      hint: 'G D',
      action: () => this.go('/dashboard'),
    },
    {
      type: 'page',
      icon: 'pi pi-box',
      label: 'Pods',
      hint: 'G P',
      action: () => this.go('/pods'),
    },
    {
      type: 'page',
      icon: 'pi pi-bolt',
      label: 'Events',
      hint: 'G E',
      action: () => this.go('/events'),
    },
    {
      type: 'page',
      icon: 'pi pi-chart-bar',
      label: 'Metrics',
      action: () => this.go('/metrics'),
    },
    {
      type: 'page',
      icon: 'pi pi-send',
      label: 'Deployments',
      action: () => this.go('/deployments'),
    },
    {
      type: 'page',
      icon: 'pi pi-align-left',
      label: 'Logs',
      hint: 'G L',
      action: () => this.go('/logs'),
    },
    {
      type: 'page',
      icon: 'pi pi-clock',
      label: 'Jobs',
      action: () => this.go('/jobs'),
    },
    {
      type: 'page',
      icon: 'pi pi-shield',
      label: 'RBAC',
      action: () => this.go('/rbac'),
    },
    {
      type: 'page',
      icon: 'pi pi-globe',
      label: 'Network',
      action: () => this.go('/network'),
    },
    {
      type: 'page',
      icon: 'pi pi-exclamation-circle',
      label: 'Incident',
      action: () => this.go('/incident'),
    },
    {
      type: 'page',
      icon: 'pi pi-th-large',
      label: 'Namespace',
      action: () => this.go('/namespace'),
    },
    {
      type: 'page',
      icon: 'pi pi-sparkles',
      label: 'AI Assistant',
      action: () => this.go('/ai'),
    },
    {
      type: 'page',
      icon: 'pi pi-code',
      label: 'Terminal',
      hint: 'G T',
      action: () => this.go('/terminal'),
    },
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
    const q = this.query.toLowerCase();
    if (!q) {
      this.filtered = this.allItems.slice(0, 8);
    } else {
      this.filtered = this.allItems
        .filter(
          (item) =>
            item.label.toLowerCase().includes(q) || item.type.includes(q),
        )
        .slice(0, 10);
    }
    this.activeIndex = 0;
  }

  moveDown() {
    if (this.activeIndex < this.filtered.length - 1) this.activeIndex++;
  }

  moveUp() {
    if (this.activeIndex > 0) this.activeIndex--;
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
