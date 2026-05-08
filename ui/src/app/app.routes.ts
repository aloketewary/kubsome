import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent) },
  { path: 'pods', loadComponent: () => import('./features/pods/pods.component').then(m => m.PodsComponent) },
  { path: 'events', loadComponent: () => import('./features/events/events.component').then(m => m.EventsComponent) },
  { path: 'metrics', loadComponent: () => import('./features/metrics/metrics.component').then(m => m.MetricsComponent) },
  { path: 'deployments', loadComponent: () => import('./features/deployments/deployments.component').then(m => m.DeploymentsComponent) },
  { path: 'logs', loadComponent: () => import('./features/logs/logs.component').then(m => m.LogsComponent) },
  { path: 'jobs', loadComponent: () => import('./features/jobs/jobs.component').then(m => m.JobsComponent) },
  { path: 'namespace', loadComponent: () => import('./features/namespace/namespace.component').then(m => m.NamespaceComponent) },
  { path: 'rbac', loadComponent: () => import('./features/rbac/rbac.component').then(m => m.RbacComponent) },
  { path: 'network', loadComponent: () => import('./features/network/network.component').then(m => m.NetworkComponent) },
  { path: 'incident', loadComponent: () => import('./features/incident/incident.component').then(m => m.IncidentComponent) },
  { path: 'graph', loadComponent: () => import('./features/graph/graph.component').then(m => m.GraphComponent) },
  { path: 'yaml', loadComponent: () => import('./features/yaml-editor/yaml-editor.component').then(m => m.YamlEditorComponent) },
  { path: 'settings', loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent) },
  { path: 'search', loadComponent: () => import('./features/search/search.component').then(m => m.SearchComponent) },
  { path: 'ai', loadComponent: () => import('./features/ai/ai.component').then(m => m.AiComponent) },
  { path: 'terminal', loadComponent: () => import('./features/terminal/terminal.component').then(m => m.TerminalComponent) },
];
