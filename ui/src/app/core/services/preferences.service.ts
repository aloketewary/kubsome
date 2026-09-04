import { Injectable, signal } from '@angular/core';

export interface UserPreferences {
  theme: 'dark' | 'light';
  refreshInterval: number;
  sidebarFavorites: string[];
  defaultNamespace: string;
  notifications: boolean;
  dashboardWidgets: string[];
}

const STORAGE_KEY = 'kubsome_prefs';

const DEFAULTS: UserPreferences = {
  theme: 'dark',
  refreshInterval: 30000,
  sidebarFavorites: ['/monitor/dashboard', '/operations/pods', '/monitor/logs'],
  defaultNamespace: '',
  notifications: true,
  dashboardWidgets: ['hero', 'metrics', 'charts', 'uptime', 'events', 'actions'],
};

const LEGACY_ROUTE_MAP: Record<string, string> = {
  '/dashboard': '/monitor/dashboard',
  '/pods': '/operations/pods',
  '/logs': '/monitor/logs',
};

@Injectable({ providedIn: 'root' })
export class PreferencesService {
  prefs = signal<UserPreferences>(this.load());

  constructor() {
    // Apply saved theme on startup
    const theme = this.prefs().theme;
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }

  get<K extends keyof UserPreferences>(key: K): UserPreferences[K] {
    return this.prefs()[key];
  }

  set<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]): void {
    const updated = { ...this.prefs(), [key]: value };
    this.prefs.set(updated);
    this.save(updated);
  }

  private load(): UserPreferences {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return DEFAULTS;
      const parsed = { ...DEFAULTS, ...JSON.parse(stored) } as UserPreferences;
      return {
        ...parsed,
        sidebarFavorites: parsed.sidebarFavorites.map(path => LEGACY_ROUTE_MAP[path] ?? path),
      };
    } catch {
      return DEFAULTS;
    }
  }

  private save(prefs: UserPreferences): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (e) {
      console.warn('Failed to save preferences:', e);
    }
  }
}
