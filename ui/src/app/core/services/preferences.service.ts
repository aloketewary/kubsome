import { Injectable, signal } from '@angular/core';

export interface UserPreferences {
  theme: 'dark' | 'light';
  refreshInterval: number;
  sidebarFavorites: string[];
  defaultNamespace: string;
  notifications: boolean;
}

const STORAGE_KEY = 'kubeasy_prefs';

const DEFAULTS: UserPreferences = {
  theme: 'dark',
  refreshInterval: 30000,
  sidebarFavorites: ['/dashboard', '/pods', '/logs'],
  defaultNamespace: '',
  notifications: true,
};

@Injectable({ providedIn: 'root' })
export class PreferencesService {
  prefs = signal<UserPreferences>(this.load());

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
      return stored ? { ...DEFAULTS, ...JSON.parse(stored) } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  }

  private save(prefs: UserPreferences): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }
}
