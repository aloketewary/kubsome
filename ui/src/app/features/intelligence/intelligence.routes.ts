import { Routes } from '@angular/router';

export const INTELLIGENCE_ROUTES: Routes = [
  { path: 'ai', title: 'AI Assistant — Kubsome', loadComponent: () => import('../ai/ai.component').then(m => m.AiComponent) },
  { path: 'search', title: 'Search — Kubsome', loadComponent: () => import('../search/search').then(m => m.SearchComponent) },
  { path: 'pins', title: 'Pins — Kubsome', loadComponent: () => import('../pins/pins').then(m => m.PinsComponent) },
  { path: 'watches', title: 'Watches — Kubsome', loadComponent: () => import('../watch-manager/watch-manager').then(m => m.WatchManagerComponent) },
  { path: 'profiles', title: 'Profiles — Kubsome', loadComponent: () => import('../profiles/profiles').then(m => m.ProfilesComponent) },
  { path: 'plugins', title: 'Plugins — Kubsome', loadComponent: () => import('../plugins/plugins').then(m => m.PluginsComponent) },
  { path: 'plugins/:id', title: 'Plugin Details — Kubsome', loadComponent: () => import('../plugins/plugins').then(m => m.PluginsComponent) },
  { path: 'settings', title: 'Settings — Kubsome', loadComponent: () => import('../settings/settings').then(m => m.SettingsComponent) },
];
